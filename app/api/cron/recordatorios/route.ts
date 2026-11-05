import { bot, ensureBotReady } from '@/lib/bot'
import { createAdminClient } from '@/lib/supabase/server'
import { computeAccess } from '@/lib/plans'
import type { Family } from '@/lib/types'

export const maxDuration = 60

/**
 * Recordatorio diario por Telegram cuando la prueba o el plan vence en ≤ 3 días o acaba de vencer.
 * Vercel Cron llama esta ruta con `Authorization: Bearer $CRON_SECRET` (ver vercel.json).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('No autorizado', { status: 401 })
  }

  const db = createAdminClient()
  const { data } = await db.from('families').select('*').not('telegram_chat_id', 'is', null)
  const app = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const twoDaysAgo = Date.now() - 2 * 86_400_000
  let sent = 0

  await ensureBotReady()
  for (const fam of (data ?? []) as Family[]) {
    const a = computeAccess(fam, 0)
    const msLeft = a.until.getTime() - Date.now()
    const dueSoon = msLeft > 0 && a.daysLeft <= 3
    const justExpired = msLeft <= 0 && msLeft > -2 * 86_400_000
    if (!dueSoon && !justExpired) continue
    if (fam.last_reminder_at && new Date(fam.last_reminder_at).getTime() > twoDaysAgo) continue

    const what = a.plan.id === 'trial' ? 'La prueba gratis' : `El plan ${a.plan.name}`
    const text = justExpired
      ? `⛔ ${what} venció y dejé de leer los recibos. Renueven aquí para seguir: ${app}/plan`
      : `⏳ ${what} vence en ${a.daysLeft} día(s). Para no perder el registro automático, renueven aquí: ${app}/plan`
    try {
      await bot.api.sendMessage(fam.telegram_chat_id!, text)
      await db.from('families').update({ last_reminder_at: new Date().toISOString() }).eq('id', fam.id)
      sent++
    } catch (err) {
      console.error('No se pudo enviar recordatorio a', fam.id, err)
    }
  }
  return Response.json({ sent })
}
