import 'server-only'
import { Bot, InlineKeyboard, InputFile, type Context } from 'grammy'
import type { Message, User } from 'grammy/types'
import { createAdminClient } from './supabase/server'
import type { Extraction, ExtractionInput } from './extract'
import { transcribe, transcriptionEnabled } from './transcribe'
import { money, monthLabel, monthStart, dateLabel } from './format'
import { monthlyReport } from './reports'
import { PLANS, REFERRAL_DAYS, getAccess } from './plans'
import { LEGAL } from './legal'
import { FEATURES } from './features'
import { debtsHtml, escapeHtml, goalsHtml, planHtml, summaryHtml } from './replies'
import { alertHtml, applyEdit, budgetNotice, confirmTx, deleteTx, getFamilyTx, loadContext, memberName, recordMovement, setCategory } from './ledger'
import { KIND_LABEL, type Category, type Debt, type Family, type Member, type SavingsGoal, type Transaction } from './types'

const db = createAdminClient()
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? ''
const MINI_APP = process.env.TELEGRAM_MINIAPP_NAME ?? ''

/**
 * Botón que abre el panel dentro de Telegram (Mini App).
 * En chats privados se usa un botón web_app; en grupos Telegram no los permite, así que se usa
 * el enlace directo t.me/bot/app?startapp=… (requiere crear la Mini App con /newapp en BotFather).
 * Sin Mini App configurada, abre el panel web en el navegador.
 */
function panelKeyboard(ctx: Context, start = 'resumen', label = '📊 Abrir panel'): InlineKeyboard | undefined {
  if (!APP_URL.startsWith('https://')) return undefined
  if (ctx.chat?.type === 'private') return new InlineKeyboard().webApp(label, `${APP_URL}/tg?go=${start}`)
  if (BOT_USERNAME && MINI_APP) return new InlineKeyboard().url(label, `https://t.me/${BOT_USERNAME}/${MINI_APP}?startapp=${start}`)
  return new InlineKeyboard().url(label, `${APP_URL}/resumen`)
}

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN ?? 'missing-token')

let initPromise: Promise<void> | null = null
export function ensureBotReady() {
  initPromise ??= bot.init()
  return initPromise
}

// ---------------------------------------------------------------------
// Ayudantes de datos
// ---------------------------------------------------------------------

async function familyForChat(chatId: number): Promise<Family | null> {
  const { data } = await db.from('families').select('*').eq('telegram_chat_id', chatId).maybeSingle()
  return data as Family | null
}

function nameOf(u: User): string {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Alguien'
}

/**
 * Aviso de privacidad (Ley 1581): se muestra una sola vez a cada miembro de Telegram,
 * antes de procesar su primer mensaje. Seguir usando el bot es autorización por conducta inequívoca.
 */
async function sendPrivacyNoticeOnce(ctx: Context, member: Member) {
  if (member.privacy_notice_at) return
  await ctx.reply(
    [
      `🔒 Hola ${escapeHtml(member.display_name)}. Antes de seguir:`,
      `Los recibos, montos y mensajes que envíes al bot los lee una IA y quedan visibles para tu familia. Los guardamos y tratamos según la <a href="${APP_URL}/privacidad">Política de tratamiento de datos</a> y los <a href="${APP_URL}/terminos">Términos</a>, incluida su transmisión a proveedores fuera de Colombia.`,
      'Si sigues enviando información al bot, nos autorizas a tratarla. Si no estás de acuerdo, no le envíes información y escribe /privacidad para saber cómo borrar tus datos.',
    ].join('\n\n'),
    { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
  )
  await db.from('family_members').update({ privacy_notice_at: new Date().toISOString() }).eq('id', member.id)
  member.privacy_notice_at = new Date().toISOString()
}

async function ensureMember(familyId: string, u: User): Promise<Member> {
  const { data: existing } = await db
    .from('family_members')
    .select('*')
    .eq('family_id', familyId)
    .eq('telegram_user_id', u.id)
    .maybeSingle()
  if (existing) return existing as Member
  const { data } = await db
    .from('family_members')
    .insert({ family_id: familyId, telegram_user_id: u.id, display_name: nameOf(u) })
    .select()
    .single()
  return data as Member
}



async function downloadTelegramFile(fileId: string): Promise<Buffer> {
  const file = await bot.api.getFile(fileId)
  const res = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`)
  if (!res.ok) throw new Error(`No se pudo descargar el archivo (${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

// ---------------------------------------------------------------------
// Presentación
// ---------------------------------------------------------------------

function txCard(tx: Transaction, cats: Category[], debts: Debt[], goals: SavingsGoal[], who: string, ex?: Extraction) {
  const cat = cats.find((c) => c.id === tx.category_id)
  const lines = [
    `${tx.status === 'pending' ? '🕓 <b>Por confirmar</b>' : '✅ <b>Registrado</b>'} · ${KIND_LABEL[tx.kind]}`,
    `💵 <b>${money(tx.amount)}</b>`,
    tx.merchant ? `🏪 ${escapeHtml(tx.merchant)}` : null,
    tx.description ? `📝 ${escapeHtml(tx.description)}` : null,
    tx.kind === 'expense' || tx.kind === 'income' ? `🏷 ${cat ? `${cat.icon} ${cat.name}` : 'Sin categoría'}` : null,
    tx.kind === 'debt_payment' ? `💳 ${escapeHtml(debts.find((d) => d.id === tx.debt_id)?.name ?? 'Deuda sin identificar')}` : null,
    tx.kind === 'saving' ? `🐷 ${escapeHtml(goals.find((g) => g.id === tx.savings_goal_id)?.name ?? 'Meta sin identificar')}` : null,
    `📅 ${dateLabel(tx.occurred_on)} · 👤 ${escapeHtml(who)}${tx.payment_method ? ` · ${escapeHtml(tx.payment_method)}` : ''}`,
    tx.transcript ? `🎙 <i>«${escapeHtml(tx.transcript)}»</i>` : null,
    ex?.notes ? `⚠️ <i>${escapeHtml(ex.notes)}</i>` : null,
  ]
  return lines.filter(Boolean).join('\n')
}

function txKeyboard(tx: Transaction) {
  const kb = new InlineKeyboard()
  if (tx.status === 'pending') kb.text('✅ Confirmar', `ok:${tx.id}`)
  kb.text('✏️ Editar', `ed:${tx.id}`).row()
  kb.text('🏷 Categoría', `cat:${tx.id}`).text('🗑 Eliminar', `del:${tx.id}`)
  return kb
}




const HELP = [
  '<b>🧾 Luka</b>',
  '',
  'Envíen al chat fotos o capturas de <b>recibos, facturas o comprobantes</b> (Nequi, Daviplata, bancos, PDF) y los registro.',
  'También pueden escribir: <i>"mercado 185.000 en el D1"</i>, <i>"me pagaron el sueldo 3.200.000"</i>, <i>"abono 400 mil a la tarjeta"</i>, <i>"ahorré 200.000 para vacaciones"</i>.',
  '',
  '/resumen — cómo va el mes y el presupuesto',
  '/pendientes — movimientos por confirmar',
  ...(FEATURES.debts ? ['/deudas — saldos y fecha estimada de pago'] : []),
  '/meta — metas de ahorro y cuánto falta',
  '/reporte — resumen del mes con el archivo de movimientos (/reporte anterior para el mes pasado)',
  '/panel — abrir el panel aquí mismo en Telegram',
  '/plan — plan, lecturas usadas y pago',
  '/invitar — invita a otra familia y ganen un mes gratis',
  '/vincular CÓDIGO — conectar este chat con la familia',
  '/privacidad — cómo tratamos tus datos',
].join('\n')

// ---------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------

const isGroup = (ctx: Context) => ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup'
const botName = () => BOT_USERNAME || bot.botInfo?.username || ''
/** Enlace que abre Telegram para elegir o crear un grupo y agregar a Luka con el código de la familia. */
const addToGroupUrl = (code: string) => `https://t.me/${botName()}?startgroup=${encodeURIComponent(code)}`

/**
 * /start CÓDIGO: llega cuando agregan a Luka con el botón "Conectar con Telegram" del panel
 * (enlace t.me/bot?startgroup=CÓDIGO). En un grupo conecta la familia sin escribir nada más.
 */
bot.command('start', async (ctx) => {
  const code = ctx.match.trim()
  if (code && isGroup(ctx)) return linkChat(ctx, code)
  if (code)
    return ctx.reply(
      'Para conectar tu familia, Luka tiene que estar en un grupo de Telegram. Toca el botón y elige el grupo de la familia o crea uno nuevo.',
      { reply_markup: new InlineKeyboard().url('➕ Agregar Luka a un grupo', addToGroupUrl(code)) },
    )
  return ctx.reply(HELP, { parse_mode: 'HTML' })
})

bot.command(['ayuda', 'help'], (ctx) => ctx.reply(HELP, { parse_mode: 'HTML' }))

bot.command('vincular', (ctx) => {
  const code = ctx.match.trim()
  if (!code)
    return ctx.reply(
      `Para conectar este grupo, en el panel → Familia toquen «Conectar con Telegram». También pueden escribir /vincular seguido del código que aparece ahí. Guía con video: ${APP_URL}/como-conectar`,
      { link_preview_options: { is_disabled: true } },
    )
  return linkChat(ctx, code)
})

async function linkChat(ctx: Context, raw: string) {
  const code = raw.trim().toUpperCase()
  if (!ctx.chat) return
  const { data: fam } = await db.from('families').select('*').eq('link_code', code).maybeSingle()
  if (!fam) return ctx.reply('Ese código no existe. Revísenlo en el panel → Familia, o usen el botón «Conectar con Telegram» que hay ahí.')
  // Una familia vinculada no se puede mover a otro chat con el código: primero hay que desvincularla en el panel
  if (fam.telegram_chat_id && fam.telegram_chat_id !== ctx.chat.id)
    return ctx.reply('Esa familia ya está conectada a otro chat. Si quieren cambiarlo, el administrador debe desvincularlo primero en el panel → Familia.')
  const other = await familyForChat(ctx.chat.id)
  if (other && other.id !== fam.id) return ctx.reply('Este chat ya está conectado a otra familia.')
  await db.from('families').update({ telegram_chat_id: ctx.chat.id }).eq('id', fam.id)
  if (ctx.from) {
    const m = await ensureMember(fam.id, ctx.from)
    await db.from('family_members').update({ privacy_notice_at: new Date().toISOString() }).eq('id', m.id)
  }
  return ctx.reply(
    [
      `✅ ¡Listo! Este grupo quedó conectado a <b>${escapeHtml(fam.name)}</b>.`,
      '📸 Prueben ya: envíen la foto de un recibo o escriban, por ejemplo, «mercado 85.000 en el D1».',
      `🔒 Lo que envíen al bot (recibos, montos, mensajes) lo lee una IA, lo ve toda la familia y se trata según la <a href="${APP_URL}/privacidad">Política de tratamiento de datos</a>.`,
      HELP,
    ].join('\n\n'),
    { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
  )
}

/** Si agregan a Luka a un grupo sin el botón del panel, explica cómo conectarlo (si nadie lo conecta en unos segundos). */
bot.on('message:new_chat_members', async (ctx) => {
  if (!ctx.message.new_chat_members.some((u) => u.id === ctx.me.id)) return
  await new Promise((r) => setTimeout(r, 5000)) // el /start del botón del panel llega casi al mismo tiempo
  if (await familyForChat(ctx.chat.id)) return
  return ctx.reply(
    [
      '👋 ¡Hola! Soy Luka, el contador de la familia.',
      'Para conectar este grupo, quien creó la familia en el panel debe entrar a Familia y tocar «Conectar con Telegram», o escribir aquí /vincular seguido del código que aparece en esa página.',
      `Guía con video: ${APP_URL}/como-conectar`,
    ].join('\n\n'),
    { link_preview_options: { is_disabled: true } },
  )
})

/** Telegram cambia el identificador del grupo al convertirlo en supergrupo: se actualiza para no perder la conexión. */
bot.on('message:migrate_to_chat_id', async (ctx) => {
  await db.from('families').update({ telegram_chat_id: ctx.message.migrate_to_chat_id }).eq('telegram_chat_id', ctx.chat.id)
})

/** "Soy yo": une el usuario de Telegram de quien escribe con su cuenta web, usando el código del panel. */
bot.command('soyyo', async (ctx) => {
  const fam = await requireFamily(ctx)
  if (!fam || !ctx.from) return
  const code = ctx.match.trim().toUpperCase()
  if (!/^[A-Z0-9]{8}$/.test(code))
    return ctx.reply('Escribe /soyyo seguido del código que aparece en el panel → Familia → Conectar mi Telegram.')
  const { data: link } = await db.from('telegram_link_codes').select('member_id, expires_at').eq('code', code).maybeSingle()
  if (!link || new Date(link.expires_at).getTime() < Date.now())
    return ctx.reply('Ese código no existe o ya venció. Generen uno nuevo en el panel → Familia.')
  const { data: web } = await db.from('family_members').select('*').eq('id', link.member_id).eq('family_id', fam.id).maybeSingle()
  if (!web) return ctx.reply('Ese código no es de esta familia.')
  if (web.telegram_user_id) return ctx.reply('Esa cuenta ya está unida a Telegram.')
  const { data: tg } = await db.from('family_members').select('*').eq('family_id', fam.id).eq('telegram_user_id', ctx.from.id).maybeSingle()
  if (tg?.user_id) return ctx.reply('Tu usuario de Telegram ya está unido a una cuenta web.')
  if (tg) {
    // Los movimientos que registró desde Telegram pasan a su cuenta web
    await db.from('transactions').update({ member_id: web.id }).eq('member_id', tg.id)
    await db.from('family_members').delete().eq('id', tg.id)
  }
  await db
    .from('family_members')
    .update({ telegram_user_id: ctx.from.id, privacy_notice_at: tg?.privacy_notice_at ?? new Date().toISOString() })
    .eq('id', web.id)
  await db.from('telegram_link_codes').delete().eq('member_id', web.id)
  return ctx.reply(`✅ Listo, ${escapeHtml(web.display_name)}: tu Telegram quedó unido a tu cuenta.`, { parse_mode: 'HTML' })
})

bot.command('privacidad', (ctx) =>
  ctx.reply(
    [
      '<b>🔒 Tus datos</b>',
      `Política de tratamiento de datos: ${APP_URL}/privacidad`,
      `Términos y condiciones: ${APP_URL}/terminos`,
      '',
      `Puedes descargar o borrar tus datos tú mismo: abre /panel → 🔒 Mis datos. También puedes escribir a ${LEGAL.email} indicando tu usuario de Telegram.`,
    ].join('\n'),
    { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
  ),
)

/** Middleware: el resto de funciones requieren un chat vinculado. */
async function requireFamily(ctx: Context): Promise<Family | null> {
  const fam = await familyForChat(ctx.chat!.id)
  if (!fam) {
    await ctx.reply('Este chat aún no está vinculado. Creen la familia en el panel web y luego escriban /vincular CÓDIGO.')
    return null
  }
  return fam
}

/** El módulo de deudas está fuera del MVP; cuando se active será del plan Plus. */
async function requireDebts(ctx: Context, fam: Family): Promise<boolean> {
  if (!FEATURES.debts) {
    await ctx.reply('💳 El plan para salir de deudas llega pronto. Por ahora, los abonos y cuotas se registran como gasto en la categoría Deudas.')
    return false
  }
  const access = await getAccess(db, fam)
  if (access.active && access.plan.debts) return true
  await ctx.reply(`💎 El plan de deudas está en ${PLANS.plus.name}. Mejoren el plan aquí: ${APP_URL}/plan`)
  return false
}

bot.command('plan', async (ctx) => {
  const fam = await requireFamily(ctx)
  if (!fam) return
  return ctx.reply(await planHtml(fam), { parse_mode: 'HTML' })
})

bot.command('panel', (ctx) => {
  const kb = panelKeyboard(ctx)
  if (!kb) return ctx.reply(APP_URL ? `📊 Panel: ${APP_URL}/resumen` : 'Configuren NEXT_PUBLIC_APP_URL para mostrar el enlace.')
  return ctx.reply('📊 El panel de la familia: movimientos, presupuesto, metas y gráficos.', { reply_markup: kb })
})

bot.command('resumen', async (ctx) => {
  const fam = await requireFamily(ctx)
  if (!fam) return
  return ctx.reply(await summaryHtml(fam), {
    parse_mode: 'HTML',
    reply_markup: panelKeyboard(ctx, 'resumen', '📊 Ver detalle en el panel'),
  })
})

bot.command('pendientes', async (ctx) => {
  const fam = await requireFamily(ctx)
  if (!fam) return
  const { data } = await db
    .from('transactions')
    .select('*')
    .eq('family_id', fam.id)
    .eq('status', 'pending')
    .order('created_at')
    .limit(10)
  const txs = (data ?? []) as Transaction[]
  if (!txs.length) return ctx.reply('No hay nada pendiente 🎉')
  const { categories, debts, goals } = await loadContext(fam.id)
  const { data: members } = await db.from('family_members').select('id, display_name').eq('family_id', fam.id)
  for (const tx of txs) {
    const who = members?.find((m) => m.id === tx.member_id)?.display_name ?? '—'
    await ctx.reply(txCard(tx, categories, debts, goals, who), { parse_mode: 'HTML', reply_markup: txKeyboard(tx) })
  }
})

bot.command('deudas', async (ctx) => {
  const fam = await requireFamily(ctx)
  if (!fam) return
  if (!(await requireDebts(ctx, fam))) return
  return ctx.reply(await debtsHtml(fam), { parse_mode: 'HTML' })
})

/** Envía al chat el resumen de un mes con el CSV de movimientos. Lo usa /reporte y el cron del día 1. */
export async function sendMonthlyReport(chatId: number, fam: Family, month: string): Promise<boolean> {
  const r = await monthlyReport(db, fam, month, APP_URL)
  if (!r) return false
  await bot.api.sendMessage(chatId, r.text, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } })
  await bot.api.sendDocument(chatId, new InputFile(r.csv, r.filename), { caption: `🧾 Movimientos de ${r.filename.slice(5, 12)}` })
  return true
}

bot.command('reporte', async (ctx) => {
  const fam = await requireFamily(ctx)
  if (!fam) return
  // /reporte → mes actual hasta hoy · /reporte anterior → mes pasado completo
  const previous = /anterior|pasado/i.test(ctx.match)
  const month = monthStart(previous ? -1 : 0)
  const sent = await sendMonthlyReport(ctx.chat.id, fam, month)
  if (!sent) return ctx.reply(`No hay movimientos en ${monthLabel(month)}.${previous ? '' : ' Para ver el mes pasado escriban /reporte anterior.'}`)
})

bot.command('invitar', async (ctx) => {
  const fam = await requireFamily(ctx)
  if (!fam) return
  const url = `${APP_URL}/r/${fam.referral_code ?? ''}`
  return ctx.reply(
    [
      '🎁 <b>Invita a otra familia y ganen un mes</b>',
      `Compartan este enlace. Cuando la familia que inviten pague su primer plan, las dos reciben ${REFERRAL_DAYS} días gratis.`,
      '',
      url,
    ].join('\n'),
    { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
  )
})

bot.command(['meta', 'metas', 'ahorros'], async (ctx) => {
  const fam = await requireFamily(ctx)
  if (!fam) return
  return ctx.reply(await goalsHtml(fam), { parse_mode: 'HTML' })
})

// ---------------------------------------------------------------------
// Registro de movimientos
// ---------------------------------------------------------------------

async function registerFrom(
  ctx: Context,
  input: ExtractionInput,
  source: Transaction['source'],
  file?: { buf: Buffer; ext: string; mime: string },
  transcript?: string,
) {
  const fam = await requireFamily(ctx)
  if (!fam || !ctx.from) return
  const msg = ctx.message as Message
  const member = await ensureMember(fam.id, ctx.from)
  if (!member.privacy_notice_at) {
    // La autorización debe ser previa: mostramos el aviso y procesamos desde el siguiente envío
    await sendPrivacyNoticeOnce(ctx, member)
    await ctx.reply('Si estás de acuerdo, vuelve a enviar el recibo o el mensaje y lo registro. 👍', {
      reply_parameters: { message_id: msg.message_id },
    })
    return
  }
  if (source !== 'telegram_text') await ctx.replyWithChatAction('typing')
  const r = await recordMovement({
    fam,
    member,
    input,
    source,
    file: file ? { ...file, key: String(msg.message_id) } : undefined,
    transcript,
    sentAtMs: msg.date * 1000,
    telegram: { chatId: ctx.chat!.id, messageId: msg.message_id },
  })
  const reply = { reply_parameters: { message_id: msg.message_id } }
  if (r.status === 'blocked') return void (await ctx.reply(r.text, reply))
  if (r.status === 'error') {
    // En texto libre no interrumpimos la conversación familiar con errores
    if (source !== 'telegram_text') await ctx.reply(r.text, reply)
    return
  }
  if (r.status === 'not_financial') {
    if (source !== 'telegram_text')
      await ctx.reply(`No encontré un monto en ${source === 'telegram_audio' ? 'la nota de voz' : 'esa imagen'}. Si es un gasto, escríbanlo, ej: "farmacia 35.000".`, reply)
    return
  }
  let text = txCard(r.tx, r.ctx.categories, r.ctx.debts, r.ctx.goals, member.display_name, r.ex)
  if (r.notice.line) text += `

${escapeHtml(r.notice.line)}`
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: txKeyboard(r.tx), ...reply })
  if (r.notice.alert) await ctx.reply(alertHtml(r.notice.alert), { parse_mode: 'HTML' })
}

bot.on('message:photo', async (ctx) => {
  const photo = ctx.message.photo.at(-1)!
  const buf = await downloadTelegramFile(photo.file_id)
  await registerFrom(
    ctx,
    { type: 'image', base64: buf.toString('base64'), mediaType: 'image/jpeg', caption: ctx.message.caption },
    'telegram_photo',
    { buf, ext: 'jpg', mime: 'image/jpeg' },
  )
})

const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const

bot.on('message:document', async (ctx) => {
  const doc = ctx.message.document
  const mime = doc.mime_type ?? ''
  if ((doc.file_size ?? 0) > 15 * 1024 * 1024) return ctx.reply('El archivo es muy grande (máx. 15 MB).')
  if (mime === 'application/pdf') {
    const buf = await downloadTelegramFile(doc.file_id)
    return registerFrom(ctx, { type: 'pdf', base64: buf.toString('base64'), caption: ctx.message.caption }, 'telegram_photo', {
      buf,
      ext: 'pdf',
      mime,
    })
  }
  if (mime in IMAGE_TYPES) {
    const buf = await downloadTelegramFile(doc.file_id)
    return registerFrom(
      ctx,
      { type: 'image', base64: buf.toString('base64'), mediaType: mime as keyof typeof IMAGE_TYPES, caption: ctx.message.caption },
      'telegram_photo',
      { buf, ext: IMAGE_TYPES[mime as keyof typeof IMAGE_TYPES], mime },
    )
  }
})

// Notas de voz y audios: se transcriben y se procesan como texto
const MAX_AUDIO_SECONDS = 90
bot.on(['message:voice', 'message:audio'], async (ctx) => {
  const audio = ctx.message.voice ?? ctx.message.audio
  if (!audio) return
  if (!transcriptionEnabled()) return ctx.reply('Las notas de voz todavía no están activadas. Escríbanlo o envíen la foto del recibo.')
  if (audio.duration > MAX_AUDIO_SECONDS)
    return ctx.reply(`La nota de voz es muy larga (máx. ${MAX_AUDIO_SECONDS} s). Cuéntenmelo en una más corta.`, {
      reply_parameters: { message_id: ctx.message.message_id },
    })
  if (!(await familyForChat(ctx.chat.id))) return requireFamily(ctx)
  await ctx.replyWithChatAction('typing')
  let text = ''
  try {
    text = await transcribe(await downloadTelegramFile(audio.file_id), audio.mime_type ?? 'audio/ogg')
  } catch (err) {
    console.error('Error transcribiendo', err)
  }
  if (!text)
    return ctx.reply('😕 No entendí la nota de voz. ¿Me la repiten o la escriben?', { reply_parameters: { message_id: ctx.message.message_id } })
  await registerFrom(ctx, { type: 'text', text }, 'telegram_audio', undefined, text)
})

// Texto libre: solo si menciona un monto (ej. "almuerzo 25.000", "40 mil de gasolina")
const MONEY_HINT = /(\d[\d.,]{2,}|\d+\s*(mil|k|m\b|millones|millón|lucas|barras))/i
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text
  if (text.startsWith('/')) return
  const isPrivate = ctx.chat.type === 'private'
  const repliesToBot = ctx.message.reply_to_message?.from?.id === ctx.me.id
  if (repliesToBot && (await handleEditReply(ctx, ctx.message.reply_to_message!.message_id, text))) return
  const mentionsBot = text.includes(`@${ctx.me.username}`)
  if (!MONEY_HINT.test(text) && !repliesToBot && !mentionsBot) {
    if (isPrivate) await ctx.reply(HELP, { parse_mode: 'HTML' })
    return
  }
  if (!(await familyForChat(ctx.chat.id))) return
  await registerFrom(ctx, { type: 'text', text: text.replace(`@${ctx.me.username}`, '').trim() }, 'telegram_text')
})

// ---------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------

async function txForCallback(ctx: Context, id: string) {
  const fam = await familyForChat(ctx.chat!.id)
  if (!fam) return null
  const tx = await getFamilyTx(fam.id, id)
  return tx ? { fam, tx } : null
}

async function refreshCard(ctx: Context, fam: Family, tx: Transaction) {
  const { categories, debts, goals } = await loadContext(fam.id)
  const notice = await budgetNotice(fam, tx)
  const card = txCard(tx, categories, debts, goals, await memberName(tx.member_id))
  await ctx.editMessageText(notice.line ? `${card}

${escapeHtml(notice.line)}` : card, {
    parse_mode: 'HTML',
    reply_markup: txKeyboard(tx),
  })
  if (notice.alert) await ctx.reply(alertHtml(notice.alert), { parse_mode: 'HTML' })
}

bot.callbackQuery(/^ed:(.+)$/, async (ctx) => {
  const found = await txForCallback(ctx, ctx.match[1])
  if (!found) return ctx.answerCallbackQuery('No encontrado')
  await ctx.answerCallbackQuery()
  const prompt = await ctx.reply(
    '✏️ ¿Qué cambio? Respondan a este mensaje, por ejemplo: «son 125.000», «fue ayer», «era del Éxito», «es un ingreso», «categoría Salud».',
    { reply_markup: { force_reply: true, input_field_placeholder: 'Ej: son 125.000' } },
  )
  await db.from('transactions').update({ edit_prompt_message_id: prompt.message_id }).eq('id', found.tx.id)
})

/** Aplica una corrección escrita en respuesta al mensaje "✏️ ¿Qué cambio?". Devuelve true si la atendió. */
async function handleEditReply(ctx: Context, promptId: number, instruction: string): Promise<boolean> {
  const fam = await familyForChat(ctx.chat!.id)
  if (!fam) return false
  const { data } = await db
    .from('transactions')
    .select('*')
    .eq('family_id', fam.id)
    .eq('edit_prompt_message_id', promptId)
    .maybeSingle()
  if (!data) return false
  await ctx.replyWithChatAction('typing')
  const r = await applyEdit(fam, data as Transaction, instruction)
  if (!r.ok) {
    await ctx.reply(r.text)
    return true
  }
  const notice = await budgetNotice(fam, r.tx)
  const card = txCard(r.tx, r.ctx.categories, r.ctx.debts, r.ctx.goals, await memberName(r.tx.member_id))
  await ctx.reply(`✏️ Corregido

${card}${notice.line ? `

${escapeHtml(notice.line)}` : ''}`, {
    parse_mode: 'HTML',
    reply_markup: txKeyboard(r.tx),
  })
  if (notice.alert) await ctx.reply(alertHtml(notice.alert), { parse_mode: 'HTML' })
  return true
}

bot.callbackQuery(/^ok:(.+)$/, async (ctx) => {
  const found = await txForCallback(ctx, ctx.match[1])
  if (!found) return ctx.answerCallbackQuery('No encontrado')
  const saved = await confirmTx(found.tx)
  await ctx.answerCallbackQuery('Confirmado ✅')
  await refreshCard(ctx, found.fam, saved)
})

bot.callbackQuery(/^del:(.+)$/, async (ctx) => {
  const found = await txForCallback(ctx, ctx.match[1])
  if (!found) return ctx.answerCallbackQuery('No encontrado')
  await deleteTx(found.tx)
  await ctx.answerCallbackQuery('Borrado')
  await ctx.editMessageText(`🗑 Borrado: ${money(found.tx.amount)} ${found.tx.description ? `— ${escapeHtml(found.tx.description)}` : ''}`, {
    parse_mode: 'HTML',
  })
})

bot.callbackQuery(/^cat:(.+)$/, async (ctx) => {
  const found = await txForCallback(ctx, ctx.match[1])
  if (!found) return ctx.answerCallbackQuery('No encontrado')
  const { categories } = await loadContext(found.fam.id)
  const kb = new InlineKeyboard()
  // Callback data máx. 64 bytes: usamos el índice de la categoría en la lista ordenada
  categories.forEach((c, i) => {
    kb.text(`${c.icon} ${c.name}`, `sc:${found.tx.id}:${i}`)
    if (i % 2 === 1) kb.row()
  })
  await ctx.answerCallbackQuery()
  await ctx.editMessageReplyMarkup({ reply_markup: kb })
})

bot.callbackQuery(/^sc:(.+):(\d+)$/, async (ctx) => {
  const found = await txForCallback(ctx, ctx.match[1])
  if (!found) return ctx.answerCallbackQuery('No encontrado')
  const r = await setCategory(found.tx, Number(ctx.match[2]))
  if (!r) return ctx.answerCallbackQuery('Categoría no válida')
  await ctx.answerCallbackQuery(`${r.category.icon} ${r.category.name}`)
  await refreshCard(ctx, found.fam, r.tx)
})

bot.catch((err) => console.error('Error del bot', err.error))
