import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'

/** Compara dos secretos en tiempo constante (no revela cuántos caracteres coinciden). */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

/** ¿La petición trae `Authorization: Bearer <CRON_SECRET>`? (Vercel Cron la envía así) */
export function hasCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  return !!secret && safeEqual(request.headers.get('authorization'), `Bearer ${secret}`)
}
