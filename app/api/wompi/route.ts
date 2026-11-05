import { applyTransaction, verifyEvent, type WompiEvent } from '@/lib/wompi'

/**
 * Webhook de eventos de Wompi (configurar en el dashboard: URL de eventos → /api/wompi).
 * Wompi reintenta si no recibe 200, así que solo respondemos error cuando falló algo de nuestro lado.
 */
export async function POST(request: Request) {
  let evt: WompiEvent
  try {
    evt = (await request.json()) as WompiEvent
  } catch {
    return new Response('JSON inválido', { status: 400 })
  }
  if (!verifyEvent(evt)) {
    console.warn('Evento de Wompi con firma inválida')
    return new Response('Firma inválida', { status: 401 })
  }
  if (evt.event !== 'transaction.updated' || !evt.data.transaction) return new Response('ok')

  try {
    const result = await applyTransaction(evt.data.transaction)
    console.log('Wompi', evt.data.transaction.reference, evt.data.transaction.status, result)
  } catch (err) {
    console.error('Error aplicando pago de Wompi', err)
    return new Response('Error', { status: 500 }) // Wompi reintentará
  }
  return new Response('ok')
}
