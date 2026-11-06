import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { openMemberSession } from '@/lib/member-session'
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

  const session = await openMemberSession(members, tgEmail(data.user.id), {
    telegram_user_id: data.user.id,
    name: nameOf(data.user),
    via: 'telegram',
  })
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: 500 })

  return NextResponse.json({ next: startPath(data.startParam ?? (typeof body?.go === 'string' ? body.go : null)) })
}
