'use client'

/** Lo mínimo del SDK de Mini Apps que usamos. https://core.telegram.org/bots/webapps */
export interface TelegramWebApp {
  initData: string
  colorScheme: 'light' | 'dark'
  ready(): void
  expand(): void
  setHeaderColor(color: string): void
  setBackgroundColor(color: string): void
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void }
  HapticFeedback?: { notificationOccurred(type: 'error' | 'success' | 'warning'): void }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js'
/** Marca de sesión: el panel se abrió desde Telegram (se borra al cerrar la Mini App). */
export const TG_FLAG = 'tg-mini-app'

let loading: Promise<TelegramWebApp | null> | null = null

/** Carga el SDK de Telegram una sola vez. Devuelve null si no estamos dentro de Telegram. */
export function loadTelegram(): Promise<TelegramWebApp | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp)
  loading ??= new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = SDK_URL
    s.async = true
    s.onload = () => resolve(window.Telegram?.WebApp ?? null)
    s.onerror = () => resolve(null)
    document.head.appendChild(s)
  })
  return loading
}
