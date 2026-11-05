'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { loadTelegram, TG_FLAG } from '@/lib/telegram-webapp'

type State = { kind: 'loading' } | { kind: 'outside' } | { kind: 'error'; message: string }

/** Entrada de la Mini App: inicia sesión con los datos firmados por Telegram y abre el panel. */
export default function TelegramEntry() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const wa = await loadTelegram()
      if (cancelled) return
      if (!wa?.initData) return setState({ kind: 'outside' })
      wa.ready()
      wa.expand()
      try {
        wa.setHeaderColor('#ffffff')
        wa.setBackgroundColor('#f8fafc')
      } catch {
        // Versiones viejas de Telegram no soportan colores
      }
      const res = await fetch('/api/tg/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // En chats privados el botón web_app trae la página en ?go=; en grupos llega como start_param
        body: JSON.stringify({ initData: wa.initData, go: new URLSearchParams(window.location.search).get('go') }),
      })
      const data = (await res.json().catch(() => ({}))) as { next?: string; error?: string }
      if (cancelled) return
      if (!res.ok || !data.next) {
        wa.HapticFeedback?.notificationOccurred('error')
        return setState({ kind: 'error', message: data.error ?? 'Algo falló. Cierra y vuelve a abrir el panel.' })
      }
      sessionStorage.setItem(TG_FLAG, '1')
      // Recarga completa para que el servidor ya lea la sesión nueva
      window.location.replace(data.next)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="text-4xl">🧾</span>
      {state.kind === 'loading' && <p className="text-sm text-slate-500">Abriendo el panel de tu familia…</p>}
      {state.kind === 'outside' && (
        <>
          <p className="text-sm text-slate-600">Esta página se abre desde el bot de Telegram.</p>
          <Link href="/login" className="text-sm font-medium text-brand-700 underline">
            Entrar con correo y contraseña
          </Link>
        </>
      )}
      {state.kind === 'error' && <p className="max-w-sm text-sm text-rose-700">{state.message}</p>}
    </main>
  )
}
