import { requireFamily } from '@/lib/session'
import { listTransactions, transactionsCsv } from '@/lib/reports'

/**
 * Descarga de datos (Ley 1581: acceso del titular).
 * ?tipo=movimientos → CSV con todos los movimientos de la familia
 * ?tipo=personales  → JSON con la cuenta, la membresía y las autorizaciones aceptadas
 */
export async function GET(request: Request) {
  const { supabase, user, member, family } = await requireFamily()
  const tipo = new URL(request.url).searchParams.get('tipo')
  const today = new Date().toISOString().slice(0, 10)

  if (tipo === 'personales') {
    const [{ data: memberships }, { data: consents }] = await Promise.all([
      supabase.from('family_members').select('display_name, role, telegram_user_id, privacy_notice_at, created_at, families(name)').eq('user_id', user.id),
      supabase.from('legal_consents').select('document, version, accepted_at, ip, user_agent').eq('user_id', user.id),
    ])
    const data = {
      generado: new Date().toISOString(),
      cuenta: {
        correo: user.email?.endsWith('@telegram.invalid') ? null : user.email,
        nombre: user.user_metadata?.full_name ?? member.display_name,
        creada: user.created_at,
        ultimo_ingreso: user.last_sign_in_at,
      },
      familias: memberships ?? [],
      autorizaciones: consents ?? [],
      nota: 'Los movimientos de la familia se descargan aparte en CSV desde Mis datos.',
    }
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="luka-mis-datos-${today}.json"`,
        'cache-control': 'no-store',
      },
    })
  }

  const rows = await listTransactions(supabase, family.id)
  return new Response(new Uint8Array(transactionsCsv(rows)), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="luka-movimientos-${today}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
