'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'

const KEY = 'luka-aviso-cookies'

const subscribe = (cb: () => void) => {
  window.addEventListener('storage', cb)
  return () => window.removeEventListener('storage', cb)
}
const shouldShow = () => {
  try {
    // En la Mini App de Telegram no se muestra (espacio reducido; el aviso está en la política)
    return !localStorage.getItem(KEY) && !sessionStorage.getItem('tg-mini-app')
  } catch {
    return false // Navegador sin almacenamiento
  }
}

/**
 * Aviso informativo: Luka solo usa cookies necesarias (sesión), que no requieren autorización.
 * No bloquea la pantalla ni empuja a aceptar: se cierra con "Entendido" y no vuelve a salir.
 */
export function CookieNotice() {
  const pending = useSyncExternalStore(subscribe, shouldShow, () => false)
  const [dismissed, setDismissed] = useState(false)
  if (!pending || dismissed) return null
  return (
    <section
      aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-2xl flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-lg"
    >
      <p className="min-w-0 flex-1">
        🍪 Solo usamos cookies necesarias para mantener tu sesión. No usamos cookies de publicidad ni de analítica.{' '}
        <Link href="/cookies" className="font-medium text-brand-700 underline">
          Política de cookies
        </Link>
      </p>
      <button
        type="button"
        className="btn"
        onClick={() => {
          try {
            localStorage.setItem(KEY, '1')
          } catch {
            // Sin almacenamiento: solo se oculta en esta visita
          }
          setDismissed(true)
        }}
      >
        Entendido
      </button>
    </section>
  )
}
