import { hasCronSecret } from '@/lib/secure'
import { ensureBotReady, sendMonthlyReport } from '@/lib/bot'
import { createAdminClient } from '@/lib/supabase/server'
import { monthStart } from '@/lib/format'
import type { Family } from '@/lib/types'

export const maxDuration = 300

/**
 * El día 1 de cada mes envía a cada grupo vinculado el resumen del mes anterior con el CSV de movimientos.
 * Vercel Cron llama esta ruta con `Authorization: Bearer $CRON_SECRET` (ver vercel.json).
 * Es seguro repetirla: cada familia recibe el resumen de un mes una sola vez.
 */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return new Response('No autorizado', { status: 401 })
  }

  const month = monthStart(-1)
  const db = createAdminClient()
  const { data } = await db
    .from('families')
    .select('*')
    .not('telegram_chat_id', 'is', null)
    .or(`last_report_month.is.null,last_report_month.lt.${month}`)

  await ensureBotReady()
  let sent = 0
  let empty = 0
  for (const fam of (data ?? []) as Family[]) {
    try {
      const ok = await sendMonthlyReport(fam.telegram_chat_id!, fam, month)
      if (ok) sent++
      else empty++
      await db.from('families').update({ last_report_month: month }).eq('id', fam.id)
    } catch (err) {
      console.error('No se pudo enviar el resumen mensual a', fam.id, err)
    }
  }
  return Response.json({ month, sent, empty })
}
