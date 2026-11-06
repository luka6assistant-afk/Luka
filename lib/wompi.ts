import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'
import { createAdminClient } from './supabase/server'

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

const PUBLIC_KEY = process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY ?? ''
const isTest = PUBLIC_KEY.startsWith('pub_test_')
/** Los pagos solo se muestran si Wompi está configurado (llave pública real, no la de ejemplo). */
export const paymentsEnabled = /^pub_(test|prod)_.{8,}/.test(PUBLIC_KEY)
export const WOMPI_API = isTest ? 'https://sandbox.wompi.co/v1' : 'https://production.wompi.co/v1'

/** Firma de integridad del Web Checkout: SHA256(referencia + monto_en_centavos + moneda + secreto). */
export function integritySignature(reference: string, amountInCents: number, currency = 'COP'): string {
  return sha256(`${reference}${amountInCents}${currency}${process.env.WOMPI_INTEGRITY_SECRET}`)
}

export function checkoutUrl(opts: { reference: string; amountInCents: number; redirectUrl: string; email?: string }): string {
  const params = new URLSearchParams({
    'public-key': PUBLIC_KEY,
    currency: 'COP',
    'amount-in-cents': String(opts.amountInCents),
    reference: opts.reference,
    'signature:integrity': integritySignature(opts.reference, opts.amountInCents),
    'redirect-url': opts.redirectUrl,
  })
  if (opts.email) params.set('customer-data:email', opts.email)
  return `https://checkout.wompi.co/p/?${params}`
}

export interface WompiEvent {
  event: string
  data: { transaction?: WompiTransaction }
  environment: 'test' | 'prod'
  signature: { properties: string[]; checksum: string }
  timestamp: number
}

export interface WompiTransaction {
  id: string
  reference: string
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR'
  amount_in_cents: number
  currency: string
  payment_method_type?: string
}

/**
 * Verifica la firma de un evento: SHA256(valores de signature.properties en orden + timestamp + secreto de eventos).
 * Las propiedades se leen del evento (Wompi puede cambiarlas).
 */
export function verifyEvent(evt: WompiEvent, secret = process.env.WOMPI_EVENTS_SECRET ?? ''): boolean {
  if (!secret || !evt?.signature?.properties || !evt.signature.checksum) return false
  const values = evt.signature.properties.map((path) => {
    const v = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], evt.data)
    return v === undefined || v === null ? '' : String(v)
  })
  const expected = sha256(values.join('') + String(evt.timestamp) + secret)
  const a = Buffer.from(expected)
  const b = Buffer.from(String(evt.signature.checksum).toLowerCase())
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Consulta una transacción directamente en Wompi (fuente confiable, no depende del navegador). */
export async function fetchTransaction(id: string): Promise<WompiTransaction | null> {
  const res = await fetch(`${WOMPI_API}/transactions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${PUBLIC_KEY}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const body = (await res.json()) as { data?: WompiTransaction }
  return body.data ?? null
}

export type ApplyResult = 'applied' | 'applied_referral' | 'already_applied' | 'not_approved' | 'amount_mismatch' | 'not_found'

/** Registra el estado de la transacción y, si fue aprobada, extiende el plan (una sola vez). */
export async function applyTransaction(tx: WompiTransaction): Promise<ApplyResult> {
  if (tx.currency && tx.currency !== 'COP') return 'amount_mismatch'
  const db = createAdminClient()
  const { data, error } = await db.rpc('apply_payment', {
    ref: tx.reference,
    tx_id: tx.id,
    tx_status: tx.status,
    tx_amount: tx.amount_in_cents,
    tx_method: tx.payment_method_type ?? null,
  })
  if (error) throw error
  if (data === 'applied_referral') {
    const { notifyReferralReward } = await import('./growth')
    await notifyReferralReward(tx.reference).catch((e) => console.error('Aviso de referido', e))
  }
  return data as ApplyResult
}
