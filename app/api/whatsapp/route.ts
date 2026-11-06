import { after } from 'next/server'
import { safeEqual } from '@/lib/secure'
import { verifySignature } from '@/lib/whatsapp/api'
import { handleWebhook, type WaWebhook } from '@/lib/whatsapp/handler'

// Leer un recibo con Claude puede tomar varios segundos
export const maxDuration = 60

/**
 * Verificación del webhook: Meta llama con hub.mode=subscribe, hub.verify_token y hub.challenge
 * cuando se configura la URL en la app de Meta.
 */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams
  if (p.get('hub.mode') === 'subscribe' && safeEqual(p.get('hub.verify_token'), process.env.WHATSAPP_VERIFY_TOKEN)) {
    return new Response(p.get('hub.challenge') ?? '', { status: 200 })
  }
  return new Response('No autorizado', { status: 403 })
}

/**
 * Mensajes de WhatsApp. Se verifica la firma de Meta (X-Hub-Signature-256), se responde 200 de inmediato
 * y el mensaje se procesa después con `after()`, para que Meta no reintente mientras Claude lee el recibo.
 */
export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifySignature(raw, request.headers.get('x-hub-signature-256'))) return new Response('Firma inválida', { status: 401 })
  let body: WaWebhook
  try {
    body = JSON.parse(raw) as WaWebhook
  } catch {
    return new Response('JSON inválido', { status: 400 })
  }
  after(async () => {
    try {
      await handleWebhook(body)
    } catch (err) {
      console.error('Error procesando webhook de WhatsApp', err)
    }
  })
  return new Response('ok')
}
