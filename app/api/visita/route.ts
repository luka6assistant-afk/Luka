import { createAdminClient } from '@/lib/supabase/server'
import { normalizeSource } from '@/lib/attribution'

/**
 * Conteo anónimo de visitas a la portada y descargas de la plantilla, por fuente.
 * No recibe ni guarda datos personales: solo suma 1 al contador del día.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { source?: unknown; kind?: unknown } | null
  const source = normalizeSource(typeof body?.source === 'string' ? body.source : '') || 'directo'
  const kind = body?.kind === 'plantilla' ? 'plantilla' : 'visita'
  await createAdminClient().rpc('bump_landing_stat', { src: source, k: kind })
  return new Response(null, { status: 204 })
}
