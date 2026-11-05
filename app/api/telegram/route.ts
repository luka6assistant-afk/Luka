import { after } from 'next/server'
import type { Update } from 'grammy/types'
import { bot, ensureBotReady } from '@/lib/bot'

// Leer un recibo con Claude puede tomar varios segundos
export const maxDuration = 60

/**
 * Webhook de Telegram. Responde 200 de inmediato y procesa el mensaje
 * después con `after()`, para que Telegram no reintente mientras Claude lee el recibo.
 */
export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret || request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return new Response('No autorizado', { status: 401 })
  }
  const update = (await request.json()) as Update
  after(async () => {
    try {
      await ensureBotReady()
      await bot.handleUpdate(update)
    } catch (err) {
      console.error('Error procesando update', update.update_id, err)
    }
  })
  return new Response('ok')
}
