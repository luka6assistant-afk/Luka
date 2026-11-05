import { NextResponse } from 'next/server'

/**
 * Diagnóstico de la configuración: dice qué llaves faltan o son rechazadas, sin mostrarlas.
 * Uso: /api/health?clave=CRON_SECRET
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || new URL(request.url).searchParams.get('clave') !== secret)
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Se prueba el valor tal cual (como lo usa la app): espacios o comillas sobrantes hacen fallar las llaves
  const env = (k: string) => process.env[k] ?? ''
  const shape = (v: string) =>
    /^\s|\s$|["']/.test(v)
      ? 'tiene espacios o comillas sobrantes'
      : !v
      ? 'vacía'
      : v.startsWith('sb_publishable_')
        ? 'publishable'
        : v.startsWith('sb_secret_')
          ? 'secret'
          : v.startsWith('eyJ')
            ? 'JWT'
            : `formato desconocido (${v.length} caracteres)`
  const check = async (fn: () => Promise<Response>) => {
    try {
      const r = await fn()
      return r.ok ? 'OK' : `rechazada (${r.status})`
    } catch (e) {
      return `error: ${(e as Error).message}`
    }
  }

  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const anon = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const service = env('SUPABASE_SERVICE_ROLE_KEY')
  const appUrl = env('NEXT_PUBLIC_APP_URL')

  const result = {
    supabase_url: /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) ? 'OK' : `revisar: "${url}"`,
    supabase_publica: `${shape(anon)} → ${url ? await check(() => fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon } })) : 'sin URL'}`,
    supabase_secreta: `${shape(service)} → ${
      url
        ? await check(() =>
            fetch(`${url}/rest/v1/families?select=id&limit=1`, { headers: { apikey: service, Authorization: `Bearer ${service}` } }),
          )
        : 'sin URL'
    }`,
    claude: env('ANTHROPIC_API_KEY')
      ? await check(() =>
          fetch('https://api.anthropic.com/v1/models?limit=1', {
            headers: { 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' },
          }),
        )
      : 'vacía',
    telegram: env('TELEGRAM_BOT_TOKEN')
      ? await check(() => fetch(`https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/getMe`))
      : 'vacía',
    deepgram: env('DEEPGRAM_API_KEY')
      ? await check(() => fetch('https://api.deepgram.com/v1/projects', { headers: { Authorization: `Token ${env('DEEPGRAM_API_KEY')}` } }))
      : 'vacía (notas de voz apagadas)',
    app_url: appUrl.startsWith('https://') && !appUrl.endsWith('/') ? appUrl : `revisar: "${appUrl}"`,
    telegram_webhook_secret: env('TELEGRAM_WEBHOOK_SECRET') ? 'OK' : 'vacía',
    telegram_bot_username: env('TELEGRAM_BOT_USERNAME') || 'vacía',
    admin_emails: env('ADMIN_EMAILS') ? 'OK' : 'vacía',
  }
  return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } })
}
