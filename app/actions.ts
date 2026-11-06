'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, requireFamily } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/server'
import { parseCOP, todayISO } from '@/lib/format'
import { priceFor, type PaidPlanId, type Period } from '@/lib/plans'
import { checkoutUrl, paymentsEnabled } from '@/lib/wompi'
import { broadcastBudgetAlert, budgetNotice } from '@/lib/ledger'
import type { Transaction } from '@/lib/types'
import { recordConsent } from '@/lib/consent'
import { familyByReferralCode, founderPriceApplies } from '@/lib/growth'
import { normalizeSource } from '@/lib/attribution'
import { safeNext } from '@/lib/safe-next'

export type FormState = { error?: string; ok?: string } | undefined

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const amount = (fd: FormData, k: string) => parseCOP(str(fd, k) || '0') ?? 0
const nullable = (v: string) => (v === '' ? null : v)
/** Primer día de un mes en formato YYYY-MM-01 */
const isMonthStart = (v: string) => /^\d{4}-\d{2}-01$/.test(v)

// ---------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email: str(fd, 'email'), password: str(fd, 'password') })
  if (error?.code === 'email_not_confirmed')
    return { error: 'Primero confirma tu correo: te enviamos un enlace al registrarte (revisa también la carpeta de spam).' }
  if (error) return { error: 'Correo o contraseña incorrectos.' }
  redirect(safeNext(fd.get('next')) ?? '/resumen')
}

export async function signUp(_: FormState, fd: FormData): Promise<FormState> {
  if (fd.get('accept') !== 'on') {
    return { error: 'Para crear la cuenta debes aceptar los términos y autorizar el tratamiento de tus datos.' }
  }
  if (str(fd, 'password').length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres.' }
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: str(fd, 'email'),
    password: str(fd, 'password'),
    options: {
      data: {
        full_name: str(fd, 'name'),
        ...(str(fd, 'ref') ? { ref: str(fd, 'ref').toUpperCase().slice(0, 10) } : {}),
        acq: { source: normalizeSource(str(fd, 'src')) || (str(fd, 'ref') ? 'referido' : 'directo'), campaign: normalizeSource(str(fd, 'cmp')) || null },
      },
    },
  })
  if (error) return { error: error.message }
  // Si el correo ya existía, Supabase devuelve un usuario sin identidades: no hay a quién asociar la aceptación
  if (data.user?.identities?.length) await recordConsent(data.user.id)
  if (!data.session) return { ok: 'Te enviamos un correo para confirmar tu cuenta. Abre el enlace y luego inicia sesión (revisa también la carpeta de spam).' }
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
  redirect(safeNext(fd.get('next')) ?? '/resumen')
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
  const acq = user.user_metadata?.acq
  if (acq && typeof acq === 'object') await createAdminClient().from('families').update({ acquisition: acq }).eq('id', fam.id)
  const ref = typeof user.user_metadata?.ref === 'string' ? user.user_metadata.ref : ''
  if (ref) {
    const inviter = await familyByReferralCode(ref)
    if (inviter && inviter.id !== fam.id) await createAdminClient().from('families').update({ referred_by: inviter.id }).eq('id', fam.id)
  }
  redirect('/familia')
}

export async function joinFamily(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('join_family', { code: str(fd, 'code'), member_name: str(fd, 'name') || 'Miembro' })
  if (error) return { error: error.message.includes('válido') ? 'Código no válido.' : error.message }
  redirect('/resumen')
}

export async function renameFamily(fd: FormData) {
  const { supabase, family } = await requireAdmin()
  await supabase.from('families').update({ name: str(fd, 'name') }).eq('id', family.id)
  revalidatePath('/familia')
}

export async function unlinkTelegram() {
  // El chat vinculado solo lo cambia el servidor (la base de datos lo bloquea desde el navegador)
  const { family } = await requireAdmin()
  await createAdminClient().from('families').update({ telegram_chat_id: null }).eq('id', family.id)
  revalidatePath('/familia')
}

/**
 * "Soy yo": genera un código de un solo uso (10 minutos) para unir tu usuario de Telegram a tu cuenta web.
 * Se escribe en el grupo con /soyyo CÓDIGO: así se comprueba que la cuenta de Telegram es tuya.
 */
export async function createTelegramLinkCode(): Promise<FormState> {
  const { member } = await requireFamily()
  if (member.telegram_user_id) return { error: 'Tu cuenta ya está unida a Telegram.' }
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const code = Array.from(bytes, (b) => alphabet[b % 32]).join('')
  const { error } = await createAdminClient()
    .from('telegram_link_codes')
    .upsert({ member_id: member.id, code, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() })
  if (error) return { error: 'No se pudo generar el código. Intenta de nuevo.' }
  return { ok: code }
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
  const { family, user } = await requireFamily()
  if (!paymentsEnabled) throw new Error('Los pagos todavía no están habilitados.')
  const plan = (str(fd, 'plan') === 'plus' ? 'plus' : 'familia') as PaidPlanId
  const period = (str(fd, 'period') === 'yearly' ? 'yearly' : 'monthly') as Period
  const founder = plan === 'familia' && (await founderPriceApplies(family))
  const amountInCents = priceFor(plan, period, founder) * 100
  const reference = `CF-${family.id.slice(0, 8)}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`.toUpperCase()

  // El pago lo crea el servidor con el precio calculado aquí (desde el navegador no se pueden crear pagos)
  const { error } = await createAdminClient().from('payments').insert({
    family_id: family.id,
    reference,
    plan,
    period,
    amount_in_cents: amountInCents,
    tier: founder ? 'founder' : 'standard',
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
  const { data: tx, error } = await supabase.from('transactions').insert({
    family_id: family.id,
    kind,
    status: 'confirmed',
    amount: value,
    occurred_on: str(fd, 'occurred_on') || todayISO(),
    merchant: nullable(str(fd, 'merchant')),
    description: nullable(str(fd, 'description')),
    category_id: kind === 'expense' || kind === 'income' ? nullable(str(fd, 'category_id')) : null,
    debt_id: kind === 'debt_payment' ? nullable(str(fd, 'debt_id')) : null,
    ...(kind === 'debt_payment' && isMonthStart(str(fd, 'applies_to_month')) ? { applies_to_month: str(fd, 'applies_to_month') } : {}),
    savings_goal_id: kind === 'saving' ? nullable(str(fd, 'savings_goal_id')) : null,
    member_id: nullable(str(fd, 'member_id')) ?? member.id,
    payment_method: nullable(str(fd, 'payment_method')),
    source: 'web',
  })
    .select()
    .single()
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  // Cuánto queda del presupuesto y, si cruzó un tope, alerta (también al grupo de Telegram)
  const notice = await budgetNotice(family, tx as Transaction)
  if (notice.alert) await broadcastBudgetAlert(family, notice.alert)
  return { ok: ['Movimiento registrado.', notice.line, notice.alert?.replaceAll('*', '')].filter(Boolean).join(' ') }
}

export async function updateTransaction(fd: FormData) {
  const { supabase, family } = await requireFamily()
  const patch: Record<string, unknown> = {}
  for (const k of ['category_id', 'debt_id', 'savings_goal_id', 'status', 'occurred_on', 'description', 'kind']) {
    if (fd.has(k)) patch[k] = nullable(str(fd, k))
  }
  if (fd.has('applies_to_month')) {
    const v = str(fd, 'applies_to_month')
    patch.applies_to_month = isMonthStart(v) ? v : null
  }
  if (fd.has('amount')) patch.amount = amount(fd, 'amount')
  const { data: tx } = await supabase.from('transactions').update(patch).eq('id', str(fd, 'id')).eq('family_id', family.id).select().maybeSingle()
  revalidatePath('/', 'layout')
  if (tx) {
    const notice = await budgetNotice(family, tx as Transaction)
    if (notice.alert) await broadcastBudgetAlert(family, notice.alert)
  }
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
  // La foto se borra con la llave del servidor (los miembros no tienen permiso de borrar archivos),
  // solo si es de esta familia
  if (data?.receipt_path?.startsWith(`${family.id}/`)) await createAdminClient().storage.from('recibos').remove([data.receipt_path])
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

// ---------------------------------------------------------------------
// Datos personales: borrar la cuenta o la familia (Ley 1581, derecho de supresión)
// ---------------------------------------------------------------------

const isTelegramOnly = (email?: string | null) => !!email?.endsWith('@telegram.invalid')

/** Borra las fotos de recibos de una familia (están en recibos/<family_id>/…). */
async function removeFamilyFiles(familyId: string) {
  const storage = createAdminClient().storage.from('recibos')
  for (let i = 0; i < 50; i++) {
    const { data } = await storage.list(familyId, { limit: 1000 })
    if (!data?.length) break
    await storage.remove(data.map((f) => `${familyId}/${f.name}`))
  }
}

/** Borra la familia con todos sus datos y las cuentas solo-Telegram que queden sin familia. */
async function destroyFamily(familyId: string) {
  const admin = createAdminClient()
  const { data: members } = await admin.from('family_members').select('user_id').eq('family_id', familyId)
  await removeFamilyFiles(familyId)
  const { error } = await admin.from('families').delete().eq('id', familyId)
  if (error) throw new Error(`No se pudo borrar la familia: ${error.message}`)
  for (const uid of new Set((members ?? []).map((m) => m.user_id).filter(Boolean) as string[])) {
    const { data: u } = await admin.auth.admin.getUserById(uid)
    if (!isTelegramOnly(u.user?.email)) continue
    const { count } = await admin.from('family_members').select('id', { count: 'exact', head: true }).eq('user_id', uid)
    if (!count) await admin.auth.admin.deleteUser(uid)
  }
}

export async function deleteFamily(_: FormState, fd: FormData): Promise<FormState> {
  const { family } = await requireAdmin()
  if (str(fd, 'confirm').toUpperCase() !== 'BORRAR') return { error: 'Escribe BORRAR para confirmar.' }
  await destroyFamily(family.id)
  revalidatePath('/', 'layout')
  redirect('/bienvenida')
}

export async function deleteMyAccount(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await requireFamily()
  if (str(fd, 'confirm').toUpperCase() !== 'BORRAR') return { error: 'Escribe BORRAR para confirmar.' }
  const admin = createAdminClient()
  const { data: mine } = await admin.from('family_members').select('id, family_id, role').eq('user_id', user.id)

  for (const m of mine ?? []) {
    const { data: others } = await admin.from('family_members').select('id, role').eq('family_id', m.family_id).neq('id', m.id)
    if (!others?.length) {
      // Era el único miembro: se borra la familia completa
      await destroyFamily(m.family_id)
      continue
    }
    if (m.role === 'admin' && !others.some((o) => o.role === 'admin'))
      return {
        error:
          'Eres el único administrador de tu familia. Antes de borrar tu cuenta nombra a otro administrador (en Familia) o borra la familia completa.',
      }
  }
  // Los movimientos que registró quedan en la familia, sin su nombre (member_id pasa a null)
  await admin.from('family_members').delete().eq('user_id', user.id)
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return { error: `No se pudo borrar la cuenta: ${error.message}` }
  await supabase.auth.signOut().catch(() => {})
  redirect('/login?cuenta=borrada')
}

// ---------------------------------------------------------------------
// Recuperar la contraseña
// ---------------------------------------------------------------------

export async function requestPasswordReset(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, 'email')
  if (!email) return { error: 'Escribe tu correo.' }
  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/auth/confirm?next=/nueva-clave`,
  })
  // Mismo mensaje exista o no la cuenta (no revelamos qué correos están registrados)
  return { ok: 'Si ese correo tiene cuenta en Luka, te llegará un enlace para crear una contraseña nueva.' }
}

export async function updatePassword(_: FormState, fd: FormData): Promise<FormState> {
  const password = str(fd, 'password')
  if (password.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres.' }
  if (password !== str(fd, 'confirm')) return { error: 'Las dos contraseñas no coinciden.' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/recuperar')
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: 'No se pudo cambiar la contraseña. Pide un enlace nuevo.' }
  redirect('/resumen')
}

// ---------------------------------------------------------------------
// Alertas e importación del presupuesto
// ---------------------------------------------------------------------

export async function saveAlertThreshold(fd: FormData) {
  const { supabase, family } = await requireAdmin()
  const value = Math.round(Number(str(fd, 'threshold')))
  if (!(value >= 50 && value <= 95)) return
  await supabase.from('families').update({ alert_threshold: value }).eq('id', family.id)
  revalidatePath('/', 'layout')
}

export type ImportState =
  | undefined
  | { error: string }
  | { ok: string }
  | {
      items: (import('@/lib/budget-import').BudgetItem & { target: string })[]
      existing: { id: string; name: string; kind: string; icon: string }[]
      debts: { id: string; name: string }[]
      file: string
    }

/** Paso 1: lee el Excel y propone categorías y montos (no guarda nada). */
export async function previewBudgetImport(_: ImportState, fd: FormData): Promise<ImportState> {
  const { supabase, family } = await requireAdmin()
  const file = fd.get('file')
  if (!(file instanceof File) || !file.size) return { error: 'Elige un archivo .xlsx o .csv.' }
  const { MAX_FILE_BYTES, interpretBudgetSheet, sheetToText } = await import('@/lib/budget-import')
  if (file.size > MAX_FILE_BYTES) return { error: 'El archivo es muy grande (máx. 2 MB).' }
  let text: string
  try {
    text = await sheetToText(Buffer.from(await file.arrayBuffer()), file.name)
  } catch (e) {
    console.error('Error leyendo el archivo del presupuesto', file.name, file.type, file.size, e)
    return { error: e instanceof Error && /^(Formato|No pude|No encontré)/.test(e.message) ? e.message : 'No pude abrir el archivo. Guárdalo como .csv e inténtalo de nuevo.' }
  }
  if (!text.trim()) return { error: 'El archivo está vacío.' }
  const { data: cats } = await supabase.from('categories').select('*').eq('family_id', family.id).order('name')
  const existing = (cats ?? []) as import('@/lib/types').Category[]
  const { data: debtRows } = await supabase.from('debts').select('id, name').eq('family_id', family.id).eq('active', true)
  const debts = (debtRows ?? []) as { id: string; name: string }[]
  let result: Awaited<ReturnType<typeof interpretBudgetSheet>>
  try {
    result = await interpretBudgetSheet(text, existing, debts)
  } catch (e) {
    console.error('Error leyendo presupuesto', e)
    return { error: 'No pude leer el presupuesto en este momento. Intenta de nuevo.' }
  }
  if (!result?.understood || !result.items.length) return { error: 'No encontré categorías con montos en ese archivo.' }
  const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c]))
  return {
    file: file.name,
    existing: existing.map((c) => ({ id: c.id, name: c.name, kind: c.kind, icon: c.icon })),
    debts,
    items: result.items.map((it) => {
      if (it.kind === 'debt') {
        const d = debts.find((x) => x.name.toLowerCase() === (it.existing_debt ?? it.name).toLowerCase())
        return { ...it, monthly_amount: Math.max(0, Math.round(it.monthly_amount)), target: d ? d.id : 'new' }
      }
      const match = (it.existing_category && byName.get(it.existing_category.toLowerCase())) || byName.get(it.name.toLowerCase())
      return { ...it, monthly_amount: Math.max(0, Math.round(it.monthly_amount)), target: match ? match.id : 'new' }
    }),
  }
}

/** Paso 2: aplica lo que la persona revisó: actualiza presupuestos o crea categorías nuevas. */
export async function applyBudgetImport(_: ImportState, fd: FormData): Promise<ImportState> {
  const { supabase, family } = await requireAdmin()
  let rows: { include: boolean; name: string; kind: string; icon: string; amount: number; target: string; balance?: number | null; rate?: number | null }[]
  try {
    rows = JSON.parse(str(fd, 'rows'))
  } catch {
    return { error: 'No se pudo leer la selección.' }
  }
  const { data: cats } = await supabase.from('categories').select('id, name').eq('family_id', family.id)
  const ids = new Set((cats ?? []).map((c) => c.id))
  const { data: debtRows } = await supabase.from('debts').select('id').eq('family_id', family.id)
  const debtIds = new Set((debtRows ?? []).map((d) => d.id))
  let updated = 0
  let created = 0
  let debtsCount = 0
  for (const r of rows.filter((r) => r.include).slice(0, 40)) {
    const amountValue = Math.max(0, Math.round(Number(r.amount) || 0))
    if (r.kind === 'debt') {
      // Cada deuda por separado: cuota mensual, saldo y tasa (si venían en la hoja)
      const debt: Record<string, unknown> = { monthly_payment: amountValue }
      if (r.balance != null && Number(r.balance) > 0) debt.balance = Math.round(Number(r.balance))
      if (r.rate != null && Number(r.rate) > 0) debt.annual_rate = Number(r.rate) / 100
      if (r.target !== 'new' && debtIds.has(r.target)) {
        const { error } = await supabase.from('debts').update(debt).eq('id', r.target).eq('family_id', family.id)
        if (!error) debtsCount++
      } else {
        const name = String(r.name ?? '').trim().slice(0, 60)
        if (!name) continue
        const balance = (debt.balance as number | undefined) ?? 0
        const { error } = await supabase.from('debts').insert({ family_id: family.id, name, ...debt, balance, original_amount: balance })
        if (!error) debtsCount++
      }
      continue
    }
    if (r.target !== 'new' && ids.has(r.target)) {
      const { error } = await supabase.from('categories').update({ monthly_budget: amountValue }).eq('id', r.target).eq('family_id', family.id)
      if (!error) updated++
      continue
    }
    const name = String(r.name ?? '').trim().slice(0, 40)
    if (!name) continue
    const { error } = await supabase.from('categories').upsert(
      {
        family_id: family.id,
        name,
        kind: r.kind === 'income' ? 'income' : 'expense',
        icon: String(r.icon || '•').slice(0, 4),
        monthly_budget: amountValue,
      },
      { onConflict: 'family_id,name' },
    )
    if (!error) created++
  }
  revalidatePath('/', 'layout')
  return {
    ok: `Listo: se actualizaron ${updated} categoría(s), se crearon ${created} nueva(s)${debtsCount ? ` y se cargaron ${debtsCount} deuda(s)` : ''}.${debtsCount ? ' Completa el saldo de cada deuda en Deudas si no venía en el archivo.' : ''}`,
  }
}
