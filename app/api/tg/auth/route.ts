import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { startPath, verifyInitData, type TelegramWebAppUser } from '@/lib/telegram-auth'

/** Correo interno para quien entra solo por Telegram (nunca recibe correos). */
const tgEmail = (id: number) => `tg-${id}@telegram.invalid`
const nameOf = (u: TelegramWebAppUser) => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Telegram'

/**
 * Inicio de sesión de la Mini App: valida el initData firmado por Telegram, busca a la persona
 * entre los miembros que ya escribieron en un chat vinculado y le abre una sesión de Supabase.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { initData?: unknown; go?: unknown } | null
  const initData = typeof body?.initData === 'string' ? body.initData : ''
  const data = verifyInitData(initData, process.env.TELEGRAM_BOT_TOKEN ?? '')
  if (!data) return NextResponse.json({ error: 'No pudimos verificar que vienes de Telegram. Cierra y vuelve a abrir el panel.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: members } = await admin
    .from('family_members')
    .select('id, family_id, user_id')
    .eq('telegram_user_id', data.user.id)
    .order('created_at')
  if (!members?.length)
    return NextResponse.json(
      {
        error:
          'Todavía no te conozco. Escribe en el grupo de tu familia donde está el bot (por ejemplo, un gasto) y vuelve a abrir el panel.',
      },
      { status: 403 },
    )

  // Cuenta: la que ya tenga vinculada (por ejemplo, con "Soy yo" en el panel) o una nueva solo de Telegram
  let userId = members.find((m) => m.user_id)?.user_id as string | undefined
  let email: string
  if (userId) {
    const { data: u, error } = await admin.auth.admin.getUserById(userId)
    if (error || !u.user?.email) return NextResponse.json({ error: 'No encontramos tu cuenta.' }, { status: 500 })
    email = u.user.email
  } else {
    email = tgEmail(data.user.id)
    const { error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { telegram_user_id: data.user.id, name: nameOf(data.user), via: 'telegram' },
    })
    if (error && error.code !== 'email_exists' && error.code !== 'user_already_exists')
      return NextResponse.json({ error: 'No pudimos crear tu acceso. Intenta de nuevo.' }, { status: 500 })
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (linkError || !link.properties?.hashed_token)
    return NextResponse.json({ error: 'No pudimos abrir tu sesión. Intenta de nuevo.' }, { status: 500 })
  userId = link.user.id

  // Une los miembros de Telegram sin cuenta con esta cuenta (uno por familia)
  for (const m of members.filter((m) => !m.user_id)) {
    await admin.from('family_members').update({ user_id: userId }).eq('id', m.id).is('user_id', null)
  }

  const supabase = await createClient()
  const { error: otpError } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token })
  if (otpError) return NextResponse.json({ error: 'No pudimos abrir tu sesión. Intenta de nuevo.' }, { status: 500 })

  return NextResponse.json({ next: startPath(data.startParam ?? (typeof body?.go === 'string' ? body.go : null)) })
}
