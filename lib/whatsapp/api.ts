import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Cliente mínimo de la API de WhatsApp (Cloud API de Meta).
 * https://developers.facebook.com/docs/whatsapp/cloud-api
 */

const VERSION = process.env.WHATSAPP_API_VERSION || 'v23.0'
const GRAPH = `https://graph.facebook.com/${VERSION}`
const token = () => process.env.WHATSAPP_TOKEN ?? ''
const phoneId = () => process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''

export const whatsappEnabled = () => !!(token() && phoneId() && process.env.WHATSAPP_APP_SECRET)

/** Verifica la firma X-Hub-Signature-256 que Meta pone en cada webhook (HMAC-SHA256 del cuerpo con el App Secret). */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret || !header?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest()
  const got = Buffer.from(header.slice(7), 'hex')
  return got.length === expected.length && timingSafeEqual(got, expected)
}

async function call(path: string, body: unknown) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${JSON.stringify(json).slice(0, 300)}`)
  return json as { messages?: { id: string }[]; id?: string }
}

const send = (to: string, payload: Record<string, unknown>, replyTo?: string) =>
  call(`${phoneId()}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    ...(replyTo ? { context: { message_id: replyTo } } : {}),
    ...payload,
  })

/** WhatsApp limita el cuerpo de los mensajes interactivos a 1.024 caracteres y el de texto a 4.096. */
const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s)

export const sendText = (to: string, body: string, replyTo?: string) =>
  send(to, { type: 'text', text: { body: clip(body, 4096), preview_url: false } }, replyTo)

/** Hasta 3 botones de respuesta (título máx. 20 caracteres, id máx. 256). */
export const sendButtons = (to: string, body: string, buttons: { id: string; title: string }[], replyTo?: string) =>
  send(
    to,
    {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: clip(body, 1024) },
        action: { buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: clip(b.title, 20) } })) },
      },
    },
    replyTo,
  )

/** Lista desplegable: hasta 10 filas (título máx. 24 caracteres, descripción máx. 72). */
export const sendList = (to: string, body: string, button: string, rows: { id: string; title: string; description?: string }[]) =>
  send(to, {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: clip(body, 1024) },
      action: {
        button: clip(button, 20),
        sections: [{ title: 'Opciones', rows: rows.slice(0, 10).map((r) => ({ id: r.id, title: clip(r.title, 24), ...(r.description ? { description: clip(r.description, 72) } : {}) })) }],
      },
    },
  })

/** Sube un archivo a WhatsApp y devuelve su id (para enviarlo como documento). */
export async function uploadMedia(buf: Buffer, mime: string, filename: string): Promise<string> {
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', mime)
  form.append('file', new Blob([new Uint8Array(buf)], { type: mime }), filename)
  const res = await fetch(`${GRAPH}/${phoneId()}/media`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: form })
  const json = (await res.json().catch(() => ({}))) as { id?: string }
  if (!res.ok || !json.id) throw new Error(`WhatsApp media ${res.status}: ${JSON.stringify(json).slice(0, 300)}`)
  return json.id
}

export async function sendDocument(to: string, buf: Buffer, mime: string, filename: string, caption?: string) {
  const id = await uploadMedia(buf, mime, filename)
  return send(to, { type: 'document', document: { id, filename, ...(caption ? { caption: clip(caption, 1024) } : {}) } })
}

/** Mensaje con plantilla aprobada (para escribir cuando la persona no ha hablado en 24 horas). */
export const sendTemplate = (to: string, name: string, components: unknown[], language = 'es') =>
  send(to, { type: 'template', template: { name, language: { code: language }, components } })

/** Descarga una foto, PDF o audio que envió la persona. */
export async function downloadMedia(mediaId: string): Promise<{ buf: Buffer; mime: string; size: number }> {
  const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token()}` } })
  const info = (await meta.json()) as { url?: string; mime_type?: string; file_size?: number }
  if (!meta.ok || !info.url) throw new Error(`No se pudo obtener el archivo (${meta.status})`)
  const file = await fetch(info.url, { headers: { Authorization: `Bearer ${token()}` } })
  if (!file.ok) throw new Error(`No se pudo descargar el archivo (${file.status})`)
  return { buf: Buffer.from(await file.arrayBuffer()), mime: info.mime_type ?? 'application/octet-stream', size: info.file_size ?? 0 }
}

/** Marca el mensaje como leído y muestra "escribiendo…" mientras Luka trabaja. */
export async function markReadTyping(messageId: string) {
  await call(`${phoneId()}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
    typing_indicator: { type: 'text' },
  }).catch(() => {})
}

/** Estado de la conexión (para el diagnóstico). */
export async function checkConnection() {
  const res = await fetch(`${GRAPH}/${phoneId()}?fields=display_phone_number,verified_name,quality_rating`, {
    headers: { Authorization: `Bearer ${token()}` },
  })
  const json = (await res.json().catch(() => ({}))) as { display_phone_number?: string; verified_name?: string }
  return res.ok ? `OK (${json.verified_name ?? '—'} · ${json.display_phone_number ?? '—'})` : `rechazada (${res.status})`
}
