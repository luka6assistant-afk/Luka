/**
 * La Mini App de Telegram corre dentro de un iframe en Telegram Web (web.telegram.org).
 * Ahí las cookies de sesión solo viajan si son SameSite=None; Secure. En las apps de
 * Telegram para celular y escritorio es un navegador embebido y funcionan igual.
 * En desarrollo (http) se dejan los valores por defecto (SameSite=Lax).
 */
export const COOKIE_OPTIONS = (process.env.NEXT_PUBLIC_APP_URL ?? '').startsWith('https://')
  ? ({ sameSite: 'none', secure: true } as const)
  : undefined
