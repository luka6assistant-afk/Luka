import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safe-next'

const TYPES: EmailOtpType[] = ['signup', 'email', 'recovery', 'email_change', 'invite', 'magiclink']

/**
 * Enlaces de los correos de Supabase (confirmar cuenta, recuperar contraseña).
 * Las plantillas de correo apuntan aquí: /auth/confirm?token_hash=…&type=…&next=…
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const fallback = type === 'recovery' ? '/nueva-clave' : '/bienvenida'
  const next = safeNext(url.searchParams.get('next')) ?? fallback

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    // redirect() conserva las cookies de sesión que acaba de escribir Supabase
    if (!error) redirect(next)
  }
  return NextResponse.redirect(new URL('/login?aviso=enlace', url.origin))
}
