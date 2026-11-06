import 'server-only'
import { Bot, InlineKeyboard, InputFile, type Context } from 'grammy'
import type { Message, User } from 'grammy/types'
import { createAdminClient } from './supabase/server'
import { extractTransaction, interpretEdit, type EditPatch, type Extraction, type ExtractionInput } from './extract'
import { transcribe, transcriptionEnabled } from './transcribe'
import { getMonthSummary, debtPayoff, requiredMonthly } from './finance'
import { money, monthLabel, monthStart, todayISO, dateLabel } from './format'
import { monthlyReport } from './reports'
import { PLANS, REFERRAL_DAYS, getAccess } from './plans'
import { LEGAL } from './legal'
import { FEATURES } from './features'
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

async function loadContext(familyId: string) {
  const [{ data: categories }, { data: debts }, { data: goals }] = await Promise.all([
    db.from('categories').select('*').eq('family_id', familyId).order('name'),
    db.from('debts').select('*').eq('family_id', familyId).eq('active', true).order('name'),
    db.from('savings_goals').select('*').eq('family_id', familyId).eq('active', true).order('name'),
  ])
  return {
    categories: (categories ?? []) as Category[],
    debts: (debts ?? []) as Debt[],
    goals: (goals ?? []) as SavingsGoal[],
  }
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
function findByName<T extends { name: string }>(list: T[], name: string | null): T | undefined {
  if (!name) return undefined
  const n = norm(name)
  return list.find((x) => norm(x.name) === n) ?? list.find((x) => norm(x.name).includes(n) || n.includes(norm(x.name)))
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

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function bar(ratio: number) {
  const filled = Math.min(10, Math.round(ratio * 10))
  return '▓'.repeat(filled) + '░'.repeat(10 - filled)
}

async function budgetWarning(familyId: string, categoryId: string | null): Promise<string | null> {
  if (!categoryId) return null
  const s = await getMonthSummary(db, familyId)
  const line = s.byCategory.find((c) => c.category.id === categoryId)
  if (!line || line.budget <= 0) return null
  const pct = line.spent / line.budget
  if (pct >= 1) return `🚨 ${line.category.name}: ya se pasaron del presupuesto (${money(line.spent)} de ${money(line.budget)}).`
  if (pct >= 0.8) return `⚠️ ${line.category.name}: van en ${Math.round(pct * 100)}% del presupuesto del mes.`
  if (line.projected > line.budget)
    return `📈 ${line.category.name}: a este ritmo cerrarían el mes en ${money(line.projected)} (presupuesto ${money(line.budget)}).`
  return null
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

bot.command(['start', 'ayuda', 'help'], (ctx) => ctx.reply(HELP, { parse_mode: 'HTML' }))

bot.command('vincular', async (ctx) => {
  const code = ctx.match.trim().toUpperCase()
  if (!code) return ctx.reply('Escriban /vincular seguido del código que aparece en el panel web, ej: /vincular A1B2C3')
  const { data: fam } = await db.from('families').select('*').eq('link_code', code).maybeSingle()
  if (!fam) return ctx.reply('Ese código no existe. Revísenlo en el panel web → Familia.')
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
      `✅ Este chat quedó vinculado a <b>${escapeHtml(fam.name)}</b>.`,
      `🔒 Lo que envíen al bot (recibos, montos, mensajes) lo lee una IA, lo ve toda la familia y se trata según la <a href="${APP_URL}/privacidad">Política de tratamiento de datos</a>.`,
      HELP,
    ].join('\n\n'),
    { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
  )
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
  const a = await getAccess(db, fam)
  const status = a.active
    ? `${a.plan.id === 'trial' ? 'Prueba gratis' : `Activo hasta el ${a.until.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}`} · quedan ${a.daysLeft} día(s)`
    : '⛔ Vencido: los recibos no se están leyendo'
  return ctx.reply(
    [
      `<b>Plan ${a.plan.name}</b>`,
      status,
      `Lecturas con IA este mes: ${a.used} de ${a.plan.aiLimit}`,
      '',
      `Pagar o cambiar de plan: ${APP_URL}/plan`,
    ].join('\n'),
    { parse_mode: 'HTML' },
  )
})

bot.command('panel', (ctx) => {
  const kb = panelKeyboard(ctx)
  if (!kb) return ctx.reply(APP_URL ? `📊 Panel: ${APP_URL}/resumen` : 'Configuren NEXT_PUBLIC_APP_URL para mostrar el enlace.')
  return ctx.reply('📊 El panel de la familia: movimientos, presupuesto, metas y gráficos.', { reply_markup: kb })
})

bot.command('resumen', async (ctx) => {
  const fam = await requireFamily(ctx)
  if (!fam) return
  const s = await getMonthSummary(db, fam.id)
  const lines = [
    `<b>📊 Resumen ${monthLabel(s.month)}</b>`,
    `Ingresos: <b>${money(s.income)}</b>`,
    `Gastos: <b>${money(s.expenses)}</b>${s.totalBudget > 0 ? ` de ${money(s.totalBudget)} presupuestado` : ''}`,
    s.debtPayments ? `Abonos a deudas: ${money(s.debtPayments)}` : null,
    s.savings ? `Ahorro: ${money(s.savings)}` : null,
    `Disponible: <b>${money(s.net)}</b>`,
    `Proyección de gasto al cierre: ${money(s.projectedExpenses)}`,
    '',
    ...s.byCategory
      .filter((c) => c.spent > 0 || c.budget > 0)
      .slice(0, 12)
      .map((c) =>
        c.budget > 0
          ? `${c.category.icon} ${c.category.name}\n${bar(c.spent / c.budget)} ${money(c.spent)} / ${money(c.budget)}${c.spent > c.budget ? ' 🚨' : ''}`
          : `${c.category.icon} ${c.category.name}: ${money(c.spent)} (sin presupuesto)`,
      ),
    s.uncategorized ? `❔ Sin categoría: ${money(s.uncategorized)}` : null,
    s.pendingCount ? `\n🕓 Hay ${s.pendingCount} movimiento(s) por confirmar → /pendientes` : null,
  ]
  return ctx.reply(lines.filter((l) => l !== null).join('\n'), {
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
  const { debts } = await loadContext(fam.id)
  if (!debts.length) return ctx.reply(`No hay deudas registradas. Agréguenlas en el panel: ${APP_URL}/deudas`)
  const total = debts.reduce((s, d) => s + Number(d.balance), 0)
  const lines = debts.map((d) => {
    const plan = debtPayoff(Number(d.balance), Number(d.annual_rate), Number(d.monthly_payment))
    const eta =
      plan.months === null
        ? '⚠️ la cuota no cubre los intereses'
        : plan.months === 0
          ? '🎉 pagada'
          : `≈ ${plan.months} meses (${monthLabel(plan.payoffDate!)}), intereses ≈ ${money(plan.totalInterest)}`
    return `💳 <b>${escapeHtml(d.name)}</b>: ${money(d.balance)}\n   Cuota ${money(d.monthly_payment)}${d.due_day ? ` · paga el ${d.due_day}` : ''} · ${eta}`
  })
  return ctx.reply([`<b>Deudas — total ${money(total)}</b>`, '', ...lines].join('\n'), { parse_mode: 'HTML' })
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
  const { goals } = await loadContext(fam.id)
  if (!goals.length) return ctx.reply(`No hay metas de ahorro. Creen una en el panel: ${APP_URL}/ahorros`)
  const lines = goals.map((g) => {
    const pct = Number(g.target_amount) > 0 ? Number(g.current_amount) / Number(g.target_amount) : 0
    const need = requiredMonthly(g)
    return [
      `🐷 <b>${escapeHtml(g.name)}</b>`,
      `${bar(pct)} ${Math.round(pct * 100)}% · ${money(g.current_amount)} de ${money(g.target_amount)}`,
      need ? `   Para llegar a tiempo: ${money(need)}/mes` : null,
    ]
      .filter(Boolean)
      .join('\n')
  })
  return ctx.reply(lines.join('\n\n'), { parse_mode: 'HTML' })
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
  const { categories, debts, goals } = await loadContext(fam.id)

  const access = await getAccess(db, fam)
  if (!access.active) {
    await ctx.reply(
      `⏳ ${access.plan.id === 'trial' ? 'La prueba gratis terminó' : 'El plan venció'}. Los recibos no se están leyendo. Renueven aquí: ${APP_URL}/plan`,
      { reply_parameters: { message_id: msg.message_id } },
    )
    return
  }
  if (access.remaining <= 0) {
    await ctx.reply(
      `📦 Ya usaron las ${access.plan.aiLimit} lecturas con IA de este mes (plan ${access.plan.name}). Pueden registrarlo a mano en el panel o pasarse a Plus: ${APP_URL}/plan`,
      { reply_parameters: { message_id: msg.message_id } },
    )
    return
  }

  if (source !== 'telegram_text') await ctx.replyWithChatAction('typing')

  let ex: Extraction | null
  try {
    ex = await extractTransaction(input, { categories, debts: FEATURES.debts ? debts : [], goals, senderName: member.display_name })
    await db.rpc('increment_ai_usage', { fid: fam.id })
  } catch (err) {
    console.error('Error extrayendo', err)
    if (source !== 'telegram_text') await ctx.reply('😕 No pude leer eso ahora. Intenten de nuevo en un momento.', { reply_parameters: { message_id: msg.message_id } })
    return
  }
  if (!ex || !ex.is_financial || ex.amount <= 0) {
    // En texto libre nos quedamos callados para no interrumpir la conversación familiar
    if (source !== 'telegram_text')
      await ctx.reply(`No encontré un monto en ${source === 'telegram_audio' ? 'la nota de voz' : 'esa imagen'}. Si es un gasto, escríbanlo, ej: "farmacia 35.000".`, {
        reply_parameters: { message_id: msg.message_id },
      })
    return
  }

  let receiptPath: string | null = null
  if (file) {
    receiptPath = `${fam.id}/${todayISO()}-${msg.message_id}.${file.ext}`
    const { error } = await db.storage.from('recibos').upload(receiptPath, file.buf, { contentType: file.mime, upsert: true })
    if (error) {
      console.error('Error subiendo recibo', error)
      receiptPath = null
    }
  }

  if (!FEATURES.debts && ex.kind === 'debt_payment') {
    // Sin módulo de deudas (MVP): un abono es un gasto en la categoría "Deudas"
    ex = { ...ex, kind: 'expense', category_name: 'Deudas', debt_name: null }
  }
  const category = ex.kind === 'expense' || ex.kind === 'income'
    ? findByName(categories.filter((c) => c.kind === ex.kind), ex.category_name)
    : undefined
  const debt = ex.kind === 'debt_payment' ? findByName(debts, ex.debt_name) : undefined
  const goal = ex.kind === 'saving' ? findByName(goals, ex.savings_goal_name) : undefined
  const needsReview =
    ex.confidence !== 'alta' ||
    (ex.kind === 'debt_payment' && !debt) ||
    (ex.kind === 'saving' && !goal)

  const { data: tx, error } = await db
    .from('transactions')
    .insert({
      family_id: fam.id,
      kind: ex.kind,
      status: needsReview ? 'pending' : 'confirmed',
      amount: ex.amount,
      occurred_on: /^\d{4}-\d{2}-\d{2}$/.test(ex.occurred_on) ? ex.occurred_on : todayISO(),
      merchant: ex.merchant,
      description: ex.description,
      category_id: category?.id ?? null,
      debt_id: debt?.id ?? null,
      savings_goal_id: goal?.id ?? null,
      member_id: member.id,
      payment_method: ex.payment_method,
      source,
      receipt_path: receiptPath,
      raw_extraction: ex,
      telegram_chat_id: ctx.chat!.id,
      telegram_message_id: msg.message_id,
      transcript: transcript ?? null,
    })
    .select()
    .single()
  if (error || !tx) {
    console.error('Error guardando', error)
    await ctx.reply('😕 No pude guardar el movimiento.')
    return
  }

  let text = txCard(tx as Transaction, categories, debts, goals, member.display_name, ex)
  if (tx.status === 'confirmed' && tx.kind === 'expense') {
    const warn = await budgetWarning(fam.id, tx.category_id)
    if (warn) text += `\n\n${warn}`
  }
  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: txKeyboard(tx as Transaction),
    reply_parameters: { message_id: msg.message_id },
  })
  // Métrica del PRD: tiempo desde que la persona envió el mensaje hasta la confirmación del bot
  await db.from('transactions').update({ latency_ms: Date.now() - msg.date * 1000 }).eq('id', tx.id)
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
  const { data } = await db.from('transactions').select('*').eq('id', id).eq('family_id', fam.id).maybeSingle()
  return data ? { fam, tx: data as Transaction } : null
}

async function refreshCard(ctx: Context, famId: string, tx: Transaction) {
  const { categories, debts, goals } = await loadContext(famId)
  const { data: m } = await db.from('family_members').select('display_name').eq('id', tx.member_id).maybeSingle()
  await ctx.editMessageText(txCard(tx, categories, debts, goals, m?.display_name ?? '—'), {
    parse_mode: 'HTML',
    reply_markup: txKeyboard(tx),
  })
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
  const tx = data as Transaction
  const { categories, debts, goals } = await loadContext(fam.id)
  await ctx.replyWithChatAction('typing')
  let patch: EditPatch | null = null
  try {
    patch = await interpretEdit(
      {
        tipo: tx.kind,
        monto: Number(tx.amount),
        fecha: tx.occurred_on,
        comercio: tx.merchant,
        descripcion: tx.description,
        categoria: categories.find((c) => c.id === tx.category_id)?.name ?? null,
        medio_de_pago: tx.payment_method,
      },
      instruction,
      { categories, goals },
    )
    await db.rpc('increment_ai_usage', { fid: fam.id })
  } catch (err) {
    console.error('Error interpretando corrección', err)
  }
  if (!patch?.understood) {
    await ctx.reply('No entendí el cambio 🤔. Prueben con algo como «son 125.000» o «fue ayer».')
    return true
  }
  const update: Record<string, unknown> = { status: 'confirmed', edit_prompt_message_id: null }
  if (patch.amount !== null && patch.amount > 0) update.amount = patch.amount
  if (patch.occurred_on && /^\d{4}-\d{2}-\d{2}$/.test(patch.occurred_on)) update.occurred_on = patch.occurred_on
  if (patch.merchant !== null) update.merchant = patch.merchant
  if (patch.description !== null) update.description = patch.description
  if (patch.payment_method !== null) update.payment_method = patch.payment_method
  const kind = patch.kind ?? tx.kind
  if (patch.kind) update.kind = patch.kind
  if (kind === 'expense' || kind === 'income') {
    const cat = findByName(categories.filter((c) => c.kind === kind), patch.category_name)
    if (cat) update.category_id = cat.id
    else if (patch.kind && patch.kind !== tx.kind) update.category_id = null
    update.savings_goal_id = null
  }
  if (kind === 'saving') {
    const goal = findByName(goals, patch.savings_goal_name)
    if (goal) update.savings_goal_id = goal.id
    update.category_id = null
    if (!goal && !tx.savings_goal_id) update.status = 'pending'
  }
  const { data: saved } = await db.from('transactions').update(update).eq('id', tx.id).select().single()
  const { data: m } = await db.from('family_members').select('display_name').eq('id', tx.member_id).maybeSingle()
  await ctx.reply(`✏️ Corregido\n\n${txCard(saved as Transaction, categories, debts, goals, m?.display_name ?? '—')}`, {
    parse_mode: 'HTML',
    reply_markup: txKeyboard(saved as Transaction),
  })
  return true
}

bot.callbackQuery(/^ok:(.+)$/, async (ctx) => {
  const found = await txForCallback(ctx, ctx.match[1])
  if (!found) return ctx.answerCallbackQuery('No encontrado')
  const { data } = await db.from('transactions').update({ status: 'confirmed' }).eq('id', found.tx.id).select().single()
  await ctx.answerCallbackQuery('Confirmado ✅')
  await refreshCard(ctx, found.fam.id, data as Transaction)
})

bot.callbackQuery(/^del:(.+)$/, async (ctx) => {
  const found = await txForCallback(ctx, ctx.match[1])
  if (!found) return ctx.answerCallbackQuery('No encontrado')
  await db.from('transactions').delete().eq('id', found.tx.id)
  if (found.tx.receipt_path) await db.storage.from('recibos').remove([found.tx.receipt_path])
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
  const { categories } = await loadContext(found.fam.id)
  const cat = categories[Number(ctx.match[2])]
  if (!cat) return ctx.answerCallbackQuery('Categoría no válida')
  const kind = found.tx.kind === 'expense' || found.tx.kind === 'income' ? cat.kind : found.tx.kind
  const { data } = await db
    .from('transactions')
    .update({ category_id: cat.id, kind, debt_id: kind === found.tx.kind ? found.tx.debt_id : null, savings_goal_id: kind === found.tx.kind ? found.tx.savings_goal_id : null })
    .eq('id', found.tx.id)
    .select()
    .single()
  await ctx.answerCallbackQuery(`${cat.icon} ${cat.name}`)
  await refreshCard(ctx, found.fam.id, data as Transaction)
})

bot.catch((err) => console.error('Error del bot', err.error))
