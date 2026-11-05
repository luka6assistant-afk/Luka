'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { loadTelegram, TG_FLAG, type TelegramWebApp } from '@/lib/telegram-webapp'

/**
 * Dentro de la Mini App: usa el botón "atrás" de Telegram y oculta lo que no aplica
 * (por ejemplo "Salir"). Fuera de Telegram no hace nada.
 */
export function TelegramShell() {
  const path = usePathname()
  const router = useRouter()
  const [wa, setWa] = useState<TelegramWebApp | null>(null)

  useEffect(() => {
    if (sessionStorage.getItem(TG_FLAG) !== '1') return
    document.documentElement.dataset.tg = '1'
    loadTelegram().then((w) => {
      if (!w?.initData) return
      w.ready()
      setWa(w)
    })
  }, [])

  useEffect(() => {
    if (!wa) return
    const back = () => router.back()
    if (path === '/') wa.BackButton.hide()
    else wa.BackButton.show()
    wa.BackButton.onClick(back)
    return () => wa.BackButton.offClick(back)
  }, [wa, path, router])

  return null
}
