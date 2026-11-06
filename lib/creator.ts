import 'server-only'
import { notFound, redirect } from 'next/navigation'
import { createAdminClient, createClient } from './supabase/server'
import { computeAccess } from './plans'
import { monthStart } from './format'
import type { Family } from './types'

/** Solo los correos de ADMIN_EMAILS (dueños del producto) entran a /admin. Para el resto la página no existe. */
export async function requireCreator(path: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`)
  const admins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (!user.email || !admins.includes(user.email.toLowerCase())) notFound()
  return user
}

export interface AccountRow {
  id: string
  email: string
  name: string
  via: 'web' | 'telegram'
  created_at: string
  last_sign_in_at: string | null
  families: { name: string; role: string }[]
  consent: string | null
  source: string | null
  campaign: string | null
}

export interface FamilyRow {
  id: string
  name: string
  created_at: string
  plan: string
  status: string
  active: boolean
  until: string
  telegram: boolean
  members: number
  webMembers: number
  telegramMembers: number
  tx30: number
  lastTx: string | null
  aiThisMonth: number
  admins: string[]
  source: string | null
  campaign: string | null
  connected: boolean
  paying: boolean
}

/** Cuentas y familias creadas, para el panel del creador. Usa la llave secreta (salta RLS): solo servidor. */
export async function loadAccounts() {
  const db = createAdminClient()
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)

  const users: { id: string; email?: string; created_at: string; last_sign_in_at?: string; user_metadata?: Record<string, unknown> }[] = []
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(error.message)
    users.push(...data.users)
    if (data.users.length < 1000) break
  }

  const [{ data: families }, { data: members }, { data: txs }, { data: usage }, { data: consents }] = await Promise.all([
    db.from('families').select('*').order('created_at', { ascending: false }),
    db.from('family_members').select('family_id, user_id, telegram_user_id, whatsapp_phone, role, display_name'),
    db.from('transactions').select('family_id, occurred_on').gte('occurred_on', since).limit(100_000),
    db.from('ai_usage').select('family_id, count').eq('month', monthStart(0)),
    db.from('legal_consents').select('user_id, document, version, accepted_at').order('accepted_at', { ascending: false }),
  ])

  const famById = new Map((families ?? []).map((f) => [f.id as string, f as Family & { created_at: string }]))
  const emailById = new Map(users.map((u) => [u.id, u.email ?? '']))

  const accounts: AccountRow[] = users
    .map((u) => {
      const mine = (members ?? []).filter((m) => m.user_id === u.id)
      const c = (consents ?? []).find((x) => x.user_id === u.id)
      const tg = (u.email ?? '').endsWith('@telegram.invalid')
      return {
        id: u.id,
        email: tg ? '' : (u.email ?? ''),
        name: String(u.user_metadata?.full_name ?? u.user_metadata?.name ?? mine[0]?.display_name ?? ''),
        via: (tg ? 'telegram' : 'web') as AccountRow['via'],
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        families: mine.map((m) => ({ name: famById.get(m.family_id)?.name ?? '—', role: m.role })),
        consent: c ? `${c.version} · ${new Date(c.accepted_at).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}` : null,
        source: (u.user_metadata?.acq as { source?: string } | undefined)?.source ?? (tg ? 'telegram' : null),
        campaign: (u.user_metadata?.acq as { campaign?: string | null } | undefined)?.campaign ?? null,
      }
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  const familyRows: FamilyRow[] = (families ?? []).map((f) => {
    const fam = f as Family & { created_at: string }
    const fm = (members ?? []).filter((m) => m.family_id === fam.id)
    const ft = (txs ?? []).filter((t) => t.family_id === fam.id)
    const used = (usage ?? []).find((u) => u.family_id === fam.id)?.count ?? 0
    const a = computeAccess(fam, used)
    return {
      id: fam.id,
      name: fam.name,
      created_at: fam.created_at,
      plan: a.plan.name,
      status: a.active ? `${a.daysLeft} día(s)` : 'Vencido',
      active: a.active,
      until: a.until.toISOString(),
      telegram: !!fam.telegram_chat_id,
      members: fm.length,
      webMembers: fm.filter((m) => m.user_id && !(emailById.get(m.user_id) ?? '').endsWith('@telegram.invalid')).length,
      telegramMembers: fm.filter((m) => m.telegram_user_id).length,
      tx30: ft.length,
      lastTx: ft.map((t) => t.occurred_on).sort().at(-1) ?? null,
      aiThisMonth: used,
      admins: fm.filter((m) => m.role === 'admin' && m.user_id).map((m) => emailById.get(m.user_id!) || m.display_name),
      source: (fam as Family & { acquisition?: { source?: string } | null }).acquisition?.source ?? null,
      campaign: (fam as Family & { acquisition?: { campaign?: string | null } | null }).acquisition?.campaign ?? null,
      connected: !!fam.telegram_chat_id || fm.some((m) => m.whatsapp_phone),
      paying: a.plan.id !== 'trial' && a.active,
    }
  })

  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  return { accounts, families: familyRows, newLast7: accounts.filter((a) => a.created_at > weekAgo).length }
}
