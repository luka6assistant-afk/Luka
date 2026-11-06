import 'server-only'
import { createAdminClient, createClient } from './supabase/server'

/**
 * Abre una sesión del panel para una persona que llega desde un chat (Mini App de Telegram o enlace de WhatsApp),
 * sin contraseña. Usa la cuenta web que ya tenga unida; si no tiene, crea una cuenta interna (correo que nunca
 * recibe mensajes) y la une a sus registros de miembro.
 */
export async function openMemberSession(
  members: { id: string; user_id: string | null }[],
  syntheticEmail: string,
  metadata: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!members.length) return { ok: false, error: 'No encontramos tu familia.' }
  const admin = createAdminClient()

  let userId = members.find((m) => m.user_id)?.user_id ?? undefined
  let email: string
  if (userId) {
    const { data: u, error } = await admin.auth.admin.getUserById(userId)
    if (error || !u.user?.email) return { ok: false, error: 'No encontramos tu cuenta.' }
    email = u.user.email
  } else {
    email = syntheticEmail
    const { error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: metadata })
    if (error && error.code !== 'email_exists' && error.code !== 'user_already_exists') return { ok: false, error: 'No pudimos crear tu acceso. Intenta de nuevo.' }
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (linkError || !link.properties?.hashed_token) return { ok: false, error: 'No pudimos abrir tu sesión. Intenta de nuevo.' }
  userId = link.user.id

  // Une los registros de miembro sin cuenta con esta cuenta (uno por familia)
  for (const m of members.filter((m) => !m.user_id)) {
    await admin.from('family_members').update({ user_id: userId }).eq('id', m.id).is('user_id', null)
  }

  const supabase = await createClient()
  const { error: otpError } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token })
  if (otpError) return { ok: false, error: 'No pudimos abrir tu sesión. Intenta de nuevo.' }
  return { ok: true }
}
