// Registra el webhook del bot en Telegram y los comandos del menú.
// Uso: node --env-file=.env.local scripts/set-webhook.mjs [https://tu-url-publica]
const token = process.env.TELEGRAM_BOT_TOKEN
const secret = process.env.TELEGRAM_WEBHOOK_SECRET
const base = process.argv[2] ?? process.env.NEXT_PUBLIC_APP_URL

if (!token || !secret || !base) {
  console.error('Faltan TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET o la URL pública.')
  process.exit(1)
}

const api = (method, body) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json())

const url = `${base.replace(/\/$/, '')}/api/telegram`
console.log('setWebhook →', url)
console.log(
  await api('setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  }),
)
console.log(
  await api('setMyCommands', {
    commands: [
      { command: 'resumen', description: 'Cómo va el mes y el presupuesto' },
      { command: 'pendientes', description: 'Movimientos por confirmar' },
      { command: 'meta', description: 'Metas de ahorro y cuánto falta' },
      { command: 'deudas', description: 'Saldos y cuotas del mes de cada deuda' },
      { command: 'reporte', description: 'Resumen del mes con archivo de movimientos' },
      { command: 'panel', description: 'Abrir el panel aquí en Telegram' },
      { command: 'plan', description: 'Plan, lecturas usadas y pago' },
      { command: 'invitar', description: 'Invita a otra familia y ganen un mes' },
      { command: 'vincular', description: 'Conectar este chat con la familia' },
      { command: 'privacidad', description: 'Cómo tratamos tus datos' },
      { command: 'ayuda', description: 'Cómo usar el bot' },
    ],
  }),
)

// Botón de menú "Panel" en el chat privado con el bot (abre la Mini App)
const appUrl = base
if (appUrl.startsWith('https://')) {
  console.log(
    await api('setChatMenuButton', {
      menu_button: { type: 'web_app', text: 'Panel', web_app: { url: `${appUrl.replace(/\/$/, '')}/tg` } },
    }),
  )
} else {
  console.log('Botón de menú omitido: la Mini App necesita una URL https.')
}
