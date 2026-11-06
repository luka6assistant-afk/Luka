import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { openMemberSession } from '@/lib/member-session'
import { hashToken } from '@/lib/whatsapp/handler'

/**
 * Enlace de un solo uso que Luka envía por WhatsApp (comando «panel») para entrar al panel sin contraseña.
 * Vence en 15 minutos y se borra al usarlo.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('t') ?? ''
  const fail = () => NextResponse.redirect(new URL('/login?aviso=enlace', url.origin))
  if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) return fail()

  const admin = createAdminClient()
  // Se borra al leerlo: así el enlace no se puede usar dos veces
  const { data: row } = await admin.from('wa_login_tokens').delete().eq('token_hash', hashToken(token)).select('member_id, expires_at').maybeSingle()
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return fail()

  const { data: member } = await admin.from('family_members').select('id, user_id, whatsapp_phone, display_name').eq('id', row.member_id).maybeSingle()
  if (!member?.whatsapp_phone) return fail()

  // Todas las familias en las que está este número (normalmente una)
  const { data: members } = await admin.from('family_members').select('id, user_id').eq('whatsapp_phone', member.whatsapp_phone)
  const session = await openMemberSession(members ?? [member], `wa-${member.whatsapp_phone}@whatsapp.invalid`, {
    whatsapp_phone: member.whatsapp_phone,
    name: member.display_name,
    via: 'whatsapp',
  })
  if (!session.ok) return fail()
  // redirect() conserva las cookies de sesión que acaba de escribir Supabase
  redirect('/resumen')
}
