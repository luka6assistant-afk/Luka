import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from './supabase/server'
import { hasCurrentConsent } from './consent'
import type { Family, Member } from './types'

/** Usuario web + su familia. Redirige si falta algo. */
export const requireFamily = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!(await hasCurrentConsent(supabase, user.id))) redirect('/aceptar')

  const { data: member } = await supabase
    .from('family_members')
    .select('*, families(*)')
    .eq('user_id', user.id)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (!member) redirect('/bienvenida')

  const { families, ...m } = member as Member & { families: Family }
  return { supabase, user, member: m as Member, family: families, isAdmin: m.role === 'admin' }
})

/** Para acciones que solo puede hacer el administrador de la familia. */
export async function requireAdmin() {
  const ctx = await requireFamily()
  if (!ctx.isAdmin) throw new Error('Solo el administrador de la familia puede hacer esto.')
  return ctx
}
