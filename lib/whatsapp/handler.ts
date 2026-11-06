import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { createAdminClient } from '../supabase/server'
import { applyEdit, broadcastBudgetAlert, budgetNotice, confirmTx, deleteTx, getFamilyTx, loadContext, memberName, recordMovement, setCategory } from '../ledger'
import { goalsHtml, planHtml, summaryHtml } from '../replies'
import { monthlyReport } from '../reports'
import { transcribe, transcriptionEnabled } from '../transcribe'
import { getMonthSummary } from '../finance'
import { money, monthLabel, monthStart } from '../format'
import { REFERRAL_DAYS } from '../plans'
import { LEGAL } from '../legal'
import type { ExtractionInput } from '../extract'
import type { Family, Member, Transaction } from '../types'
import { downloadMedia, markReadTyping, sendButtons, sendDocument, sendList, sendTemplate, sendText } from './api'
import { cardButtons, htmlToWa, waCard } from './format'

const db = createAdminClient()
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''
const MONEY_HINT = /(\d[\d.,]{2,}|\d+\s*(mil|k|m\b|millones|millón|lucas|barras))/i
const MAX_FILE_BYTES = 15 * 1024 * 1024
const EDIT_WINDOW_MS = 15 * 60_000

// ---------------------------------------------------------------------
// Tipos del webhook (solo lo que usamos)
// ---------------------------------------------------------------------
interface WaMessage {
  id: string
  from: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: { id: string; mime_type?: string; caption?: string }
  document?: { id: string; mime_type?: string; filename?: string; caption?: string }
  audio?: { id: string; mime_type?: string; voice?: boolean }
  interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } }
  button?: { payload?: string; text?: string }
}
export interface WaWebhook {
  object?: string
  entry?: { changes?: { value?: { messages?: WaMessage[]; contacts?: { wa_id: string; profile?: { name?: string } }[] } }[] }[]
}

const HELP = [
  '*🧾 Luka*',
  '',
  'Envíame fotos de *recibos, facturas o comprobantes* (Nequi, Daviplata, bancos, PDF) o notas de voz y los registro.',
  'También puedes escribir: _«mercado 185.000 en el D1»_, _«me pagaron 3.200.000»_, _«ahorré 200.000 para vacaciones»_.',
  '',
  'Escribe:',
  '• *resumen* — cómo va el mes',
  '• *pendientes* — movimientos por confirmar',
  '• *metas* — metas de ahorro',
  '• *reporte* — resumen del mes con archivo (*reporte anterior* para el mes pasado)',
  '• *panel* — enlace para entrar al panel',
  '• *plan* — tu plan y lecturas usadas',
  '• *invitar* — invita a otra familia y ganen un mes',
  '• *privacidad* — tus datos',
].join('\n')

type Linked = { member: Member; fam: Family }

// ---------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------

export async function handleWebhook(body: WaWebhook) {
  for (const entry of body.entry ?? [])
    for (const change of entry.changes ?? []) {
      const value = change.value
      for (const msg of value?.messages ?? []) {
        const name = value?.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name
        try {
          await handleMessage(msg, name)
        } catch (err) {
          console.error('Error atendiendo mensaje de WhatsApp', err)
          await sendText(msg.from, '😕 Tuve un problema con ese mensaje. Intenta de nuevo en un momento.').catch(() => {})
        }
      }
    }
}

async function handleMessage(msg: WaMessage, profileName?: string) {
  // Meta puede reenviar el mismo mensaje: cada uno se atiende una sola vez
  const { error: dup } = await db.from('wa_processed').insert({ message_id: msg.id })
  if (dup) return
  await markReadTyping(msg.id)

  const linked = await linkedMember(msg.from)
  const text = msg.text?.body?.trim() ?? ''
  if (!linked) return onboarding(msg.from, text, profileName)

  if (msg.type === 'interactive') {
    const id = msg.interactive?.button_reply?.id ?? msg.interactive?.list_reply?.id ?? ''
    return handleAction(linked, msg.from, id)
  }
  if (msg.type === 'text') return handleText(linked, msg, text)
  if (msg.type === 'image' && msg.image) return handleFile(linked, msg, msg.image.id, msg.image.mime_type ?? 'image/jpeg', msg.image.caption)
  if (msg.type === 'document' && msg.document) return handleFile(linked, msg, msg.document.id, msg.document.mime_type ?? '', msg.document.caption)
  if (msg.type === 'audio' && msg.audio) return handleAudio(linked, msg)
  return sendText(msg.from, 'Envíame la foto del recibo, un PDF, una nota de voz o escribe el gasto, por ejemplo «almuerzo 25.000».')
}

async function linkedMember(phone: string): Promise<Linked | null> {
  const { data } = await db.from('family_members').select('*, families(*)').eq('whatsapp_phone', phone).maybeSingle()
  if (!data) return null
  const { families, ...member } = data as Member & { families: Family }
  return { member: member as Member, fam: families }
}

// ---------------------------------------------------------------------
// Conectar el número con la familia
// ---------------------------------------------------------------------

async function onboarding(phone: string, text: string, profileName?: string) {
  // El botón del panel envía «… Código: ABCDEFGHJK·1a2b3c4d» (familia · miembro)
  const m = text.toUpperCase().match(/\b([A-Z2-9]{10})\b(?:\s*[·.\-]\s*([0-9A-F]{8}))?/)
  if (!m)
    return sendText(
      phone,
      [
        '👋 ¡Hola! Soy *Luka*, el contador de la familia.',
        `Para empezar necesito el código de tu familia: entra a ${APP_URL} → *Familia* → *Conectar WhatsApp* y toca el botón.`,
        `¿Aún no tienes cuenta? Créala gratis en ${APP_URL}/registro`,
      ].join('\n\n'),
    )

  const { data: fam } = await db.from('families').select('*').eq('link_code', m[1]).maybeSingle()
  if (!fam) return sendText(phone, 'Ese código no existe. Revísalo en el panel → *Familia* → *Conectar WhatsApp*.')

  const now = new Date().toISOString()
  const { data: members } = await db.from('family_members').select('id, whatsapp_phone, privacy_notice_at').eq('family_id', fam.id)
  const short = m[2]?.toLowerCase()
  const existing = short ? members?.find((x) => x.id.startsWith(short) && !x.whatsapp_phone) : undefined
  if (existing) {
    await db.from('family_members').update({ whatsapp_phone: phone, privacy_notice_at: existing.privacy_notice_at ?? now }).eq('id', existing.id)
  } else {
    const { error } = await db
      .from('family_members')
      .insert({ family_id: fam.id, whatsapp_phone: phone, display_name: (profileName ?? '').slice(0, 60) || 'Miembro', privacy_notice_at: now })
    if (error) return sendText(phone, '😕 No pude conectar tu número. Intenta de nuevo en un momento.')
  }
  return sendText(
    phone,
    [
      `✅ ¡Listo! Tu WhatsApp quedó conectado a *${fam.name}*.`,
      '📸 Prueba ya: envíame la foto de un recibo o escribe, por ejemplo, «mercado 85.000 en el D1».',
      `🔒 Lo que me envíes (recibos, montos, mensajes) lo lee una IA, lo ve tu familia y se trata según la Política de tratamiento de datos: ${APP_URL}/privacidad. Si sigues enviándome información, nos autorizas a tratarla.`,
      HELP,
    ].join('\n\n'),
  )
}

// ---------------------------------------------------------------------
// Texto: comandos, correcciones y gastos escritos
// ---------------------------------------------------------------------

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/^\//, '').trim()

async function handleText(l: Linked, msg: WaMessage, text: string) {
  const phone = msg.from
  const cmd = normalize(text)
  const word = cmd.split(/\s+/)[0]

  // ¿Responde a «✏️ ¿Qué cambio?»?
  if (l.member.wa_edit_tx && l.member.wa_edit_at && Date.now() - new Date(l.member.wa_edit_at).getTime() < EDIT_WINDOW_MS && !COMMANDS.has(word)) {
    await db.from('family_members').update({ wa_edit_tx: null, wa_edit_at: null }).eq('id', l.member.id)
    const tx = await getFamilyTx(l.fam.id, l.member.wa_edit_tx)
    if (tx) {
      const r = await applyEdit(l.fam, tx, text)
      if (!r.ok) return sendText(phone, r.text)
      return sendCard(l, phone, r.tx, '✏️ Corregido\n\n')
    }
  }

  switch (word) {
    case 'hola':
    case 'ayuda':
    case 'menu':
    case 'help':
    case 'inicio':
    case 'start':
      return sendText(phone, HELP)
    case 'resumen':
      return sendText(phone, htmlToWa(await summaryHtml(l.fam, 'escribe *pendientes*')))
    case 'metas':
    case 'meta':
    case 'ahorros':
      return sendText(phone, htmlToWa(await goalsHtml(l.fam)))
    case 'plan':
      return sendText(phone, htmlToWa(await planHtml(l.fam)))
    case 'pendientes':
      return sendPending(l, phone)
    case 'reporte':
      return sendReport(l.fam, phone, /anterior|pasado/.test(cmd) ? monthStart(-1) : monthStart(0))
    case 'panel':
      return sendText(phone, `📊 Entra al panel con este enlace (vence en 15 minutos, no lo compartas):\n${await panelLink(l.member.id)}`)
    case 'invitar':
      return sendText(
        phone,
        `🎁 *Invita a otra familia y ganen un mes*\nComparte este enlace. Cuando la familia que invites pague su primer plan, las dos reciben ${REFERRAL_DAYS} días gratis.\n\n${APP_URL}/r/${l.fam.referral_code ?? ''}`,
      )
    case 'privacidad':
      return sendText(
        phone,
        `*🔒 Tus datos*\nPolítica de tratamiento de datos: ${APP_URL}/privacidad\nTérminos: ${APP_URL}/terminos\n\nPuedes descargar o borrar tus datos tú mismo: escribe *panel* y entra a 🔒 Mis datos. También puedes escribir a ${LEGAL.email}.`,
      )
  }

  if (!MONEY_HINT.test(text)) return sendText(phone, 'No entendí 🤔. Envíame el gasto con su monto (ej. «almuerzo 25.000»), la foto del recibo o escribe *ayuda*.')
  return register(l, msg, { type: 'text', text }, 'whatsapp_text')
}

const COMMANDS = new Set(['hola', 'ayuda', 'menu', 'help', 'inicio', 'start', 'resumen', 'metas', 'meta', 'ahorros', 'plan', 'pendientes', 'reporte', 'panel', 'invitar', 'privacidad'])

// ---------------------------------------------------------------------
// Archivos y notas de voz
// ---------------------------------------------------------------------

const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

async function handleFile(l: Linked, msg: WaMessage, mediaId: string, mime: string, caption?: string) {
  const isPdf = mime === 'application/pdf'
  const base = mime.split(';')[0]
  if (!isPdf && !(base in IMAGE_TYPES)) return sendText(msg.from, 'Por ahora leo fotos (JPG, PNG) y PDF.')
  const file = await downloadMedia(mediaId)
  if (file.buf.length > MAX_FILE_BYTES) return sendText(msg.from, 'El archivo es muy grande (máx. 15 MB).')
  const input: ExtractionInput = isPdf
    ? { type: 'pdf', base64: file.buf.toString('base64'), caption }
    : { type: 'image', base64: file.buf.toString('base64'), mediaType: base as 'image/jpeg' | 'image/png' | 'image/webp', caption }
  return register(l, msg, input, 'whatsapp_photo', { buf: file.buf, ext: isPdf ? 'pdf' : IMAGE_TYPES[base], mime: base })
}

async function handleAudio(l: Linked, msg: WaMessage) {
  if (!transcriptionEnabled()) return sendText(msg.from, 'Las notas de voz todavía no están activadas. Escríbelo o envía la foto del recibo.')
  const file = await downloadMedia(msg.audio!.id)
  if (file.buf.length > 3 * 1024 * 1024) return sendText(msg.from, 'La nota de voz es muy larga. Cuéntamelo en una más corta.')
  let text = ''
  try {
    text = await transcribe(file.buf, (msg.audio!.mime_type ?? 'audio/ogg').split(';')[0])
  } catch (err) {
    console.error('Error transcribiendo', err)
  }
  if (!text) return sendText(msg.from, '😕 No entendí la nota de voz. ¿Me la repites o la escribes?', msg.id)
  return register(l, msg, { type: 'text', text }, 'whatsapp_audio', undefined, text)
}

async function register(
  l: Linked,
  msg: WaMessage,
  input: ExtractionInput,
  source: Transaction['source'],
  file?: { buf: Buffer; ext: string; mime: string },
  transcript?: string,
) {
  const r = await recordMovement({
    fam: l.fam,
    member: l.member,
    input,
    source,
    file: file ? { ...file, key: msg.id.slice(-16).replace(/[^A-Za-z0-9]/g, '') } : undefined,
    transcript,
    sentAtMs: Number(msg.timestamp) * 1000,
  })
  if (r.status === 'blocked' || r.status === 'error') return sendText(msg.from, r.text, msg.id)
  if (r.status === 'not_financial')
    return sendText(msg.from, `No encontré un monto en ${source === 'whatsapp_audio' ? 'la nota de voz' : source === 'whatsapp_text' ? 'el mensaje' : 'esa imagen'}. Si es un gasto, escríbelo, ej: «farmacia 35.000».`, msg.id)
  let body = waCard(r.tx, r.ctx, l.member.display_name, r.ex)
  if (r.notice.line) body += `\n\n${r.notice.line}`
  await sendButtons(msg.from, body, cardButtons(r.tx), msg.id)
  await announce(l, msg.from, r.notice.alert)
}

/** Envía la alerta de presupuesto a quien registró y al grupo de Telegram de la familia, si lo tiene. */
async function announce(l: Linked, phone: string, alert: string | null) {
  if (!alert) return
  await sendText(phone, alert)
  await broadcastBudgetAlert(l.fam, alert)
}

/** Tarjeta actualizada (con lo que queda del presupuesto) y alerta si cruzó un tope. */
async function sendCard(l: Linked, phone: string, tx: Transaction, prefix = '') {
  const notice = await budgetNotice(l.fam, tx)
  const card = waCard(tx, await loadContext(l.fam.id), await memberName(tx.member_id))
  await sendButtons(phone, `${prefix}${card}${notice.line ? `\n\n${notice.line}` : ''}`, cardButtons(tx))
  await announce(l, phone, notice.alert)
}

// ---------------------------------------------------------------------
// Botones y lista de categorías
// ---------------------------------------------------------------------

const PAGE = 9

async function handleAction(l: Linked, phone: string, id: string) {
  const [action, txId, arg] = id.split(':')
  const tx = txId ? await getFamilyTx(l.fam.id, txId) : null
  if (!tx) return sendText(phone, 'Ese movimiento ya no existe.')

  if (action === 'ok') {
    return sendCard(l, phone, await confirmTx(tx), '✅ Confirmado\n\n')
  }
  if (action === 'ed') {
    await db.from('family_members').update({ wa_edit_tx: tx.id, wa_edit_at: new Date().toISOString() }).eq('id', l.member.id)
    return sendText(phone, '✏️ ¿Qué cambio? Escríbeme, por ejemplo: «son 125.000», «fue ayer», «era del Éxito», «es un ingreso», «categoría Salud».')
  }
  if (action === 'del') {
    await deleteTx(tx)
    return sendText(phone, `🗑 Borrado: ${money(tx.amount)}${tx.description ? ` — ${tx.description}` : ''}`)
  }
  if (action === 'cat' || action === 'cp') {
    const { categories } = await loadContext(l.fam.id)
    const page = action === 'cp' ? Number(arg) || 0 : 0
    const slice = categories.slice(page * PAGE, page * PAGE + PAGE)
    const rows = slice.map((c, i) => ({ id: `sc:${tx.id}:${page * PAGE + i}`, title: `${c.icon} ${c.name}` }))
    if (categories.length > (page + 1) * PAGE) rows.push({ id: `cp:${tx.id}:${page + 1}`, title: 'Más categorías ›' })
    return sendList(phone, `🏷 Elige la categoría para ${money(tx.amount)}${tx.merchant ? ` (${tx.merchant})` : ''}`, 'Ver categorías', rows)
  }
  if (action === 'sc') {
    const r = await setCategory(tx, Number(arg))
    if (!r) return sendText(phone, 'Esa categoría ya no existe.')
    return sendCard(l, phone, r.tx)
  }
}

async function sendPending(l: Linked, phone: string) {
  const { data } = await db.from('transactions').select('*').eq('family_id', l.fam.id).eq('status', 'pending').order('created_at').limit(5)
  const txs = (data ?? []) as Transaction[]
  if (!txs.length) return sendText(phone, 'No hay nada pendiente 🎉')
  const ctx = await loadContext(l.fam.id)
  for (const tx of txs) await sendButtons(phone, waCard(tx, ctx, await memberName(tx.member_id)), cardButtons(tx))
}

async function sendReport(fam: Family, phone: string, month: string) {
  const r = await monthlyReport(db, fam, month, APP_URL)
  if (!r) return sendText(phone, `No hay movimientos en ${monthLabel(month)}.`)
  await sendText(phone, htmlToWa(r.text).replace('/pendientes', '*pendientes*'))
  await sendDocument(phone, r.csv, 'text/csv', r.filename, `🧾 Movimientos de ${r.filename.slice(5, 12)}`)
}

// ---------------------------------------------------------------------
// Enlace de un solo uso para entrar al panel
// ---------------------------------------------------------------------

export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex')

async function panelLink(memberId: string) {
  const token = randomBytes(32).toString('base64url')
  await db.from('wa_login_tokens').insert({ token_hash: hashToken(token), member_id: memberId, expires_at: new Date(Date.now() + 15 * 60_000).toISOString() })
  return `${APP_URL}/api/wa/login?t=${token}`
}

// ---------------------------------------------------------------------
// Resumen del día 1 (fuera de las 24 horas solo se puede escribir con una plantilla aprobada por Meta)
// ---------------------------------------------------------------------

/**
 * Plantilla esperada (categoría Utilidad, español): encabezado de tipo Documento y cuerpo con 3 variables:
 * {{1}} mes, {{2}} gastos, {{3}} ingresos. Su nombre va en WHATSAPP_TEMPLATE_RESUMEN.
 */
export async function sendWhatsAppMonthlyReport(fam: Family, month: string): Promise<number> {
  const template = process.env.WHATSAPP_TEMPLATE_RESUMEN
  if (!template) return 0
  const { data: members } = await db.from('family_members').select('whatsapp_phone').eq('family_id', fam.id).not('whatsapp_phone', 'is', null)
  if (!members?.length) return 0
  const r = await monthlyReport(db, fam, month, APP_URL)
  if (!r) return 0
  const s = await getMonthSummary(db, fam.id, month)
  const { uploadMedia } = await import('./api')
  const mediaId = await uploadMedia(r.csv, 'text/csv', r.filename)
  const [y, mo] = month.split('-').map(Number)
  const label = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, mo - 1, 1)))
  let sent = 0
  for (const m of members) {
    try {
      await sendTemplate(m.whatsapp_phone!, template, [
        { type: 'header', parameters: [{ type: 'document', document: { id: mediaId, filename: r.filename } }] },
        { type: 'body', parameters: [{ type: 'text', text: label }, { type: 'text', text: money(s.expenses) }, { type: 'text', text: money(s.income) }] },
      ])
      sent++
    } catch (err) {
      console.error('No se pudo enviar el resumen por WhatsApp a', fam.id, err)
    }
  }
  return sent
}
