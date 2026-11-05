import { createHmac, timingSafeEqual } from 'node:crypto'

export interface TelegramWebAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

export interface VerifiedInitData {
  user: TelegramWebAppUser
  startParam: string | null
  authDate: Date
}

/**
 * Valida el initData que Telegram entrega a la Mini App.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * secret = HMAC_SHA256(key="WebAppData", msg=bot_token)
 * hash   = hex(HMAC_SHA256(key=secret, msg=data_check_string))
 * data_check_string = "clave=valor" de todos los campos menos hash, ordenados y unidos con \n.
 */
export function verifyInitData(
  initData: string,
  botToken: string,
  { maxAgeSeconds = 3600, now = Date.now() }: { maxAgeSeconds?: number; now?: number } = {},
): VerifiedInitData | null {
  if (!initData || !botToken) return null
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expected = createHmac('sha256', secret).update(dataCheckString).digest()
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) return null

  const authDate = Number(params.get('auth_date'))
  if (!Number.isFinite(authDate) || now / 1000 - authDate > maxAgeSeconds || authDate - now / 1000 > 60) return null

  let user: TelegramWebAppUser
  try {
    user = JSON.parse(params.get('user') ?? '')
  } catch {
    return null
  }
  if (!user || typeof user.id !== 'number') return null
  return { user, startParam: params.get('start_param'), authDate: new Date(authDate * 1000) }
}

/** Páginas a las que puede llevar un botón del bot (?startapp=…). */
export const START_PATHS: Record<string, string> = {
  resumen: '/',
  movimientos: '/movimientos',
  pendientes: '/movimientos?estado=pending',
  presupuesto: '/presupuesto',
  metas: '/ahorros',
  familia: '/familia',
  plan: '/plan',
}

export function startPath(param: string | null | undefined) {
  return (param && START_PATHS[param]) || '/'
}
