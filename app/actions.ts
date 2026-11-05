'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, requireFamily } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/server'
import { parseCOP, todayISO } from '@/lib/format'
import { priceFor, type PaidPlanId, type Period } from '@/lib/plans'
import { checkoutUrl } from '@/lib/wompi'
import { recordConsent } from '@/lib/consent'
import { safeNext } from '@/lib/safe-next'

export type FormState = { error?: string; ok?: string } | undefined

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const amount = (fd: FormData, k: string) => parseCOP(str(fd, k) || '0') ?? 0
const nullable = (v: string) => (v === '' ? null : v)

// ---------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email: str(fd, 'email'), password: str(fd, 'password') })
  if (error) return { error: 'Correo o contraseña incorrectos.' }
  redirect(safeNext(fd.get('next')) ?? '/')
}

export async function signUp(_: FormState, fd: FormData): Promise<FormState> {
  if (fd.get('accept') !== 'on') {
    return { error: 'Para crear la cuenta debes aceptar los términos y autorizar el tratamiento de tus datos.' }
  }
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: str(fd, 'email'),
    password: str(fd, 'password'),
    options: { data: { full_name: str(fd, 'name') } },
  })
  if (error) return { error: error.message }
  // Si el correo ya existía, Supabase devuelve un usuario sin identidades: no hay a quién asociar la aceptación
  if (data.user?.identities?.length) await recordConsent(data.user.id)
  if (!data.session) return { ok: 'Revisa tu correo para confirmar la cuenta y luego inicia sesión.' }
  redirect(safeNext(fd.get('next')) ?? '/bienvenida')
}

/** Aceptación de una versión nueva de los términos o la política (usuarios existentes). */
export async function acceptLegal(_: FormState, fd: FormData): Promise<FormState> {
  if (fd.get('accept') !== 'on') return { error: 'Debes marcar la casilla para continuar.' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  await recordConsent(user.id)
  redirect(safeNext(fd.get('next')) ?? '/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ---------------------------------------------------------------------
// Familia
// ---------------------------------------------------------------------

export async function createFamily(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const name = str(fd, 'family') || 'Mi familia'
  const { data: fam, error } = await supabase
    .from('families')
    .insert({ name, created_by: user.id })
    .select('id')
    .single()
  if (error || !fam) return { error: error?.message ?? 'No se pudo crear la familia.' }
  const { error: mErr } = await supabase
    .from('family_members')
    .insert({ family_id: fam.id, user_id: user.id, display_name: str(fd, 'name') || user.email!, role: 'admin' })
  if (mErr) return { error: mErr.message }
  redirect('/familia')
}

export async function joinFamily(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('join_family', { code: str(fd, 'code'), member_name: str(fd, 'name') || 'Miembro' })
  if (error) return { error: error.message.includes('válido') ? 'Código no válido.' : error.message }
  redirect('/')
}

export async function renameFamily(fd: FormData) {
  const { supabase, family } = await requireAdmin()
  await supabase.from('families').update({ name: str(fd, 'name') }).eq('id', family.id)
  revalidatePath('/familia')
}

export async function unlinkTelegram() {
  const { supabase, family } = await requireAdmin()
  await supabase.from('families').update({ telegram_chat_id: null }).eq('id', family.id)
  revalidatePath('/familia')
}

export async function linkMemberToMe(fd: FormData) {
  // Une un miembro creado por Telegram con la cuenta web actual
  const { supabase, member, family } = await requireFamily()
  if (member.telegram_user_id) return
  const { data: tm } = await supabase
    .from('family_members')
    .select('*')
    .eq('id', str(fd, 'member_id'))
    .eq('family_id', family.id)
    .is('user_id', null)
    .maybeSingle()
  if (!tm) return
  const admin = createAdminClient()
  await admin.from('transactions').update({ member_id: member.id }).eq('member_id', tm.id)
  await admin.from('family_members').delete().eq('id', tm.id)
  await admin
    .from('family_members')
    .update({ telegram_user_id: tm.telegram_user_id, privacy_notice_at: tm.privacy_notice_at })
    .eq('id', member.id)
  revalidatePath('/familia')
}

export async function setMemberRole(fd: FormData) {
  const { supabase, family } = await requireAdmin()
  const role = str(fd, 'role') === 'admin' ? 'admin' : 'member'
  const { error } = await supabase.from('family_members').update({ role }).eq('id', str(fd, 'id')).eq('family_id', family.id)
  if (error) throw new Error(error.message.includes('administrador') ? 'La familia debe tener al menos un administrador.' : error.message)
  revalidatePath('/', 'layout')
}

export async function removeMember(fd: FormData) {
  const { supabase, family, member } = await requireAdmin()
  const id = str(fd, 'id')
  if (id === member.id) throw new Error('No puedes eliminarte a ti mismo.')
  const { error } = await supabase.from('family_members').delete().eq('id', id).eq('family_id', family.id)
  if (error) throw new Error(error.message)
  revalidatePath('/familia')
}

// ---------------------------------------------------------------------
// Planes y pagos (Wompi)
// ---------------------------------------------------------------------

export async function startCheckout(fd: FormData) {
  const { supabase, family, user } = await requireFamily()
  const plan = (str(fd, 'plan') === 'plus' ? 'plus' : 'familia') as PaidPlanId
  const period = (str(fd, 'period') === 'yearly' ? 'yearly' : 'monthly') as Period
  const amountInCents = priceFor(plan, period) * 100
  const reference = `CF-${family.id.slice(0, 8)}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`.toUpperCase()

  const { error } = await supabase.from('payments').insert({
    family_id: family.id,
    reference,
    plan,
    period,
    amount_in_cents: amountInCents,
    created_by: user.id,
  })
  if (error) throw new Error(`No se pudo iniciar el pago: ${error.message}`)

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  redirect(checkoutUrl({ reference, amountInCents, redirectUrl: `${base}/plan/resultado`, email: user.email }))
}

// ---------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------

export async function addTransaction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, family, member } = await requireFamily()
  const kind = str(fd, 'kind')
  const value = amount(fd, 'amount')
  if (value <= 0) return { error: 'Escribe un monto válido.' }
  const { error } = await supabase.from('transactions').insert({
    family_id: family.id,
    kind,
    status: 'confirmed',
    amount: value,
    occurred_on: str(fd, 'occurred_on') || todayISO(),
    merchant: nullable(str(fd, 'merchant')),
    description: nullable(str(fd, 'description')),
    category_id: kind === 'expense' || kind === 'income' ? nullable(str(fd, 'category_id')) : null,
    debt_id: kind === 'debt_payment' ? nullable(str(fd, 'debt_id')) : null,
    savings_goal_id: kind === 'saving' ? nullable(str(fd, 'savings_goal_id')) : null,
    member_id: nullable(str(fd, 'member_id')) ?? member.id,
    payment_method: nullable(str(fd, 'payment_method')),
    source: 'web',
  })
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { ok: 'Movimiento registrado.' }
}

export async function updateTransaction(fd: FormData) {
  const { supabase, family } = await requireFamily()
  const patch: Record<string, unknown> = {}
  for (const k of ['category_id', 'debt_id', 'savings_goal_id', 'status', 'occurred_on', 'description', 'kind']) {
    if (fd.has(k)) patch[k] = nullable(str(fd, k))
  }
  if (fd.has('amount')) patch.amount = amount(fd, 'amount')
  await supabase.from('transactions').update(patch).eq('id', str(fd, 'id')).eq('family_id', family.id)
  revalidatePath('/', 'layout')
}

export async function deleteTransaction(fd: FormData) {
  const { supabase, family } = await requireFamily()
  const { data } = await supabase
    .from('transactions')
    .delete()
    .eq('id', str(fd, 'id'))
    .eq('family_id', family.id)
    .select('receipt_path')
    .maybeSingle()
  if (data?.receipt_path) await supabase.storage.from('recibos').remove([data.receipt_path])
  revalidatePath('/', 'layout')
}

// ---------------------------------------------------------------------
// Presupuesto
// ---------------------------------------------------------------------

export async function saveBudgets(fd: FormData) {
  const { supabase, family } = await requireAdmin()
  const updates = [...fd.keys()]
    .filter((k) => k.startsWith('budget:'))
    .map((k) =>
      supabase
        .from('categories')
        .update({ monthly_budget: amount(fd, k) })
        .eq('id', k.slice(7))
        .eq('family_id', family.id),
    )
  await Promise.all(updates)
  revalidatePath('/', 'layout')
}

export async function addCategory(fd: FormData) {
  const { supabase, family } = await requireAdmin()
  const name = str(fd, 'name')
  if (!name) return
  await supabase.from('categories').insert({
    family_id: family.id,
    name,
    kind: str(fd, 'kind') === 'income' ? 'income' : 'expense',
    icon: str(fd, 'icon') || '•',
    monthly_budget: amount(fd, 'monthly_budget'),
  })
  revalidatePath('/', 'layout')
}

export async function deleteCategory(fd: FormData) {
  const { supabase, family } = await requireAdmin()
  await supabase.from('categories').delete().eq('id', str(fd, 'id')).eq('family_id', family.id)
  revalidatePath('/', 'layout')
}

// ---------------------------------------------------------------------
// Deudas y ahorros
// ---------------------------------------------------------------------

export async function saveDebt(fd: FormData) {
  const { supabase, family } = await requireAdmin()
  const id = str(fd, 'id')
  const row = {
    family_id: family.id,
    name: str(fd, 'name'),
    creditor: nullable(str(fd, 'creditor')),
    balance: amount(fd, 'balance'),
    original_amount: amount(fd, 'original_amount') || amount(fd, 'balance'),
    annual_rate: (Number(str(fd, 'annual_rate').replace(',', '.')) || 0) / 100,
    monthly_payment: amount(fd, 'monthly_payment'),
    due_day: Number(str(fd, 'due_day')) || null,
  }
  if (!row.name) return
  if (id) await supabase.from('debts').update(row).eq('id', id).eq('family_id', family.id)
  else await supabase.from('debts').insert(row)
  revalidatePath('/', 'layout')
}

export async function archiveDebt(fd: FormData) {
  const { supabase, family } = await requireAdmin()
  await supabase.from('debts').update({ active: false }).eq('id', str(fd, 'id')).eq('family_id', family.id)
  revalidatePath('/', 'layout')
}

export async function saveGoal(fd: FormData) {
  const { supabase, family } = await requireAdmin()
  const id = str(fd, 'id')
  const row = {
    family_id: family.id,
    name: str(fd, 'name'),
    target_amount: amount(fd, 'target_amount'),
    target_date: nullable(str(fd, 'target_date')),
    ...(id ? {} : { current_amount: amount(fd, 'current_amount') }),
  }
  if (!row.name) return
  if (id) await supabase.from('savings_goals').update(row).eq('id', id).eq('family_id', family.id)
  else await supabase.from('savings_goals').insert(row)
  revalidatePath('/', 'layout')
}

export async function archiveGoal(fd: FormData) {
  const { supabase, family } = await requireAdmin()
  await supabase.from('savings_goals').update({ active: false }).eq('id', str(fd, 'id')).eq('family_id', family.id)
  revalidatePath('/', 'layout')
}

/** Abono o aporte rápido: crea un movimiento y el trigger actualiza el saldo. */
export async function quickMovement(fd: FormData) {
  const { supabase, family, member } = await requireFamily()
  const kind = str(fd, 'kind') === 'saving' ? 'saving' : 'debt_payment'
  const value = amount(fd, 'amount')
  if (value <= 0) return
  await supabase.from('transactions').insert({
    family_id: family.id,
    kind,
    amount: value,
    debt_id: kind === 'debt_payment' ? str(fd, 'target_id') : null,
    savings_goal_id: kind === 'saving' ? str(fd, 'target_id') : null,
    description: kind === 'saving' ? 'Aporte a ahorro' : 'Abono a deuda',
    member_id: member.id,
    occurred_on: todayISO(),
    source: 'web',
  })
  revalidatePath('/', 'layout')
}
