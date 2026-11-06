'use client'

import { useEffect } from 'react'
import { detectAcquisition, type Acquisition } from '@/lib/attribution'

const current = (): Acquisition => detectAcquisition(new URLSearchParams(window.location.search), document.referrer, window.location.hostname)

const count = (source: string, kind: 'visita' | 'plantilla') =>
  fetch('/api/visita', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source, kind }), keepalive: true }).catch(() => {})

/**
 * En la portada: cuenta la visita (sin datos personales) y agrega la fuente a los enlaces de registro,
 * para saber por dónde llegó cada familia sin usar cookies.
 */
export function LandingAttribution() {
  useEffect(() => {
    const acq = current()
    count(acq.source, 'visita')
    // Los enlaces de Next navegan con su dirección original: se intercepta el clic hacia el registro
    // para agregar la fuente (?src=…&cmp=…)
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a')
      if (!a || !a.getAttribute('href')?.startsWith('/registro')) return
      const url = new URL(a.href)
      url.searchParams.set('src', acq.source)
      if (acq.campaign) url.searchParams.set('cmp', acq.campaign)
      e.preventDefault()
      e.stopPropagation()
      window.location.assign(url.pathname + url.search)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
  return null
}

/** Botón para descargar la plantilla de Excel (cuenta la descarga por fuente). */
export function TemplateDownload({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <a href="/plantilla-presupuesto-familiar-luka.xlsx" download className={className} onClick={() => count(current().source, 'plantilla')}>
      {children}
    </a>
  )
}
