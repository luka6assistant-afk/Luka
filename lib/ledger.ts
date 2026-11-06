import 'server-only'
import { createAdminClient } from './supabase/server'
import { extractTransaction, interpretEdit, type EditPatch, type Extraction, type ExtractionInput } from './extract'
import { getMonthSummary } from './finance'
import { money, todayISO } from './format'
import { getAccess } from './plans'
import { FEATURES } from './features'
import type { Category, Debt, Family, Member, SavingsGoal, Transaction } from './types'

/**
 * Núcleo común de los canales de chat (Telegram y WhatsApp): leer y registrar movimientos,
 * corregirlos, confirmarlos, borrarlos y cambiarles la categoría. Cada canal solo decide cómo mostrarlo.
 */

const db = createAdminClient()
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export async function loadContext(familyId: string) {
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
export type LedgerContext = Awaited<ReturnType<typeof loadContext>>

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
export function findByName<T extends { name: string }>(list: T[], name: string | null): T | undefined {
  if (!name) return undefined
  const n = norm(name)
  return list.find((x) => norm(x.name) === n) ?? list.find((x) => norm(x.name).includes(n) || n.includes(norm(x.name)))
}

export async function budgetWarning(familyId: string, categoryId: string | null): Promise<string | null> {
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

export type RecordResult =
  | { status: 'blocked'; text: string }
  | { status: 'error'; text: string }
  | { status: 'not_financial' }
  | { status: 'ok'; tx: Transaction; ex: Extraction; ctx: LedgerContext; warning: string | null }

/** Lee el contenido con IA y registra el movimiento (o explica por qué no). */
export async function recordMovement(opts: {
  fam: Family
  member: Member
  input: ExtractionInput
  source: Transaction['source']
  file?: { buf: Buffer; ext: string; mime: string; key: string }
  transcript?: string
  sentAtMs?: number
  telegram?: { chatId: number; messageId: number }
}): Promise<RecordResult> {
  const { fam, member } = opts
  const ctx = await loadContext(fam.id)

  const access = await getAccess(db, fam)
  if (!access.active)
    return {
      status: 'blocked',
      text: `⏳ ${access.plan.id === 'trial' ? 'La prueba gratis terminó' : 'El plan venció'}. Los recibos no se están leyendo. Renueven aquí: ${APP_URL}/plan`,
    }
  if (access.remaining <= 0)
    return {
      status: 'blocked',
      text: `📦 Ya usaron las ${access.plan.aiLimit} lecturas con IA de este mes (plan ${access.plan.name}). Pueden registrarlo a mano en el panel o pasarse a Plus: ${APP_URL}/plan`,
    }

  let ex: Extraction | null
  try {
    ex = await extractTransaction(opts.input, { categories: ctx.categories, debts: FEATURES.debts ? ctx.debts : [], goals: ctx.goals, senderName: member.display_name })
    await db.rpc('increment_ai_usage', { fid: fam.id })
  } catch (err) {
    console.error('Error extrayendo', err)
    return { status: 'error', text: '😕 No pude leer eso ahora. Intenten de nuevo en un momento.' }
  }
  if (!ex || !ex.is_financial || ex.amount <= 0) return { status: 'not_financial' }

  let receiptPath: string | null = null
  if (opts.file) {
    receiptPath = `${fam.id}/${todayISO()}-${opts.file.key}.${opts.file.ext}`
    const { error } = await db.storage.from('recibos').upload(receiptPath, opts.file.buf, { contentType: opts.file.mime, upsert: true })
    if (error) {
      console.error('Error subiendo recibo', error)
      receiptPath = null
    }
  }

  if (!FEATURES.debts && ex.kind === 'debt_payment') {
    // Sin módulo de deudas (MVP): un abono es un gasto en la categoría "Deudas"
    ex = { ...ex, kind: 'expense', category_name: 'Deudas', debt_name: null }
  }
  const category = ex.kind === 'expense' || ex.kind === 'income' ? findByName(ctx.categories.filter((c) => c.kind === ex!.kind), ex.category_name) : undefined
  const debt = ex.kind === 'debt_payment' ? findByName(ctx.debts, ex.debt_name) : undefined
  const goal = ex.kind === 'saving' ? findByName(ctx.goals, ex.savings_goal_name) : undefined
  const needsReview = ex.confidence !== 'alta' || (ex.kind === 'debt_payment' && !debt) || (ex.kind === 'saving' && !goal)

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
      source: opts.source,
      receipt_path: receiptPath,
      raw_extraction: ex,
      telegram_chat_id: opts.telegram?.chatId ?? null,
      telegram_message_id: opts.telegram?.messageId ?? null,
      transcript: opts.transcript ?? null,
      latency_ms: opts.sentAtMs ? Math.max(0, Date.now() - opts.sentAtMs) : null,
    })
    .select()
    .single()
  if (error || !tx) {
    console.error('Error guardando', error)
    return { status: 'error', text: '😕 No pude guardar el movimiento.' }
  }
  const warning = tx.status === 'confirmed' && tx.kind === 'expense' ? await budgetWarning(fam.id, tx.category_id) : null
  return { status: 'ok', tx: tx as Transaction, ex, ctx, warning }
}

/** Movimiento de una familia (verifica que le pertenezca). */
export async function getFamilyTx(familyId: string, id: string): Promise<Transaction | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await db.from('transactions').select('*').eq('id', id).eq('family_id', familyId).maybeSingle()
  return (data as Transaction) ?? null
}

export async function confirmTx(tx: Transaction): Promise<Transaction> {
  const { data } = await db.from('transactions').update({ status: 'confirmed' }).eq('id', tx.id).select().single()
  return data as Transaction
}

export async function deleteTx(tx: Transaction) {
  await db.from('transactions').delete().eq('id', tx.id)
  if (tx.receipt_path?.startsWith(`${tx.family_id}/`)) await db.storage.from('recibos').remove([tx.receipt_path])
}

/** Cambia la categoría (el índice es la posición en la lista ordenada por nombre). */
export async function setCategory(tx: Transaction, index: number) {
  const { categories } = await loadContext(tx.family_id)
  const cat = categories[index]
  if (!cat) return null
  const kind = tx.kind === 'expense' || tx.kind === 'income' ? cat.kind : tx.kind
  const { data } = await db
    .from('transactions')
    .update({
      category_id: cat.id,
      kind,
      debt_id: kind === tx.kind ? tx.debt_id : null,
      savings_goal_id: kind === tx.kind ? tx.savings_goal_id : null,
    })
    .eq('id', tx.id)
    .select()
    .single()
  return { tx: data as Transaction, category: cat }
}

/** Aplica una corrección en lenguaje natural («son 125.000», «fue ayer»). */
export async function applyEdit(fam: Family, tx: Transaction, instruction: string): Promise<{ ok: false; text: string } | { ok: true; tx: Transaction; ctx: LedgerContext }> {
  const ctx = await loadContext(fam.id)
  let patch: EditPatch | null = null
  try {
    patch = await interpretEdit(
      {
        tipo: tx.kind,
        monto: Number(tx.amount),
        fecha: tx.occurred_on,
        comercio: tx.merchant,
        descripcion: tx.description,
        categoria: ctx.categories.find((c) => c.id === tx.category_id)?.name ?? null,
        medio_de_pago: tx.payment_method,
      },
      instruction,
      { categories: ctx.categories, goals: ctx.goals },
    )
    await db.rpc('increment_ai_usage', { fid: fam.id })
  } catch (err) {
    console.error('Error interpretando corrección', err)
  }
  if (!patch?.understood) return { ok: false, text: 'No entendí el cambio 🤔. Prueben con algo como «son 125.000» o «fue ayer».' }

  const update: Record<string, unknown> = { status: 'confirmed', edit_prompt_message_id: null }
  if (patch.amount !== null && patch.amount > 0) update.amount = patch.amount
  if (patch.occurred_on && /^\d{4}-\d{2}-\d{2}$/.test(patch.occurred_on)) update.occurred_on = patch.occurred_on
  if (patch.merchant !== null) update.merchant = patch.merchant
  if (patch.description !== null) update.description = patch.description
  if (patch.payment_method !== null) update.payment_method = patch.payment_method
  const kind = patch.kind ?? tx.kind
  if (patch.kind) update.kind = patch.kind
  if (kind === 'expense' || kind === 'income') {
    const cat = findByName(ctx.categories.filter((c) => c.kind === kind), patch.category_name)
    if (cat) update.category_id = cat.id
    else if (patch.kind && patch.kind !== tx.kind) update.category_id = null
    update.savings_goal_id = null
  }
  if (kind === 'saving') {
    const goal = findByName(ctx.goals, patch.savings_goal_name)
    if (goal) update.savings_goal_id = goal.id
    update.category_id = null
    if (!goal && !tx.savings_goal_id) update.status = 'pending'
  }
  const { data: saved } = await db.from('transactions').update(update).eq('id', tx.id).select().single()
  return { ok: true, tx: saved as Transaction, ctx }
}

export async function memberName(memberId: string | null) {
  if (!memberId) return '—'
  const { data } = await db.from('family_members').select('display_name').eq('id', memberId).maybeSingle()
  return data?.display_name ?? '—'
}
