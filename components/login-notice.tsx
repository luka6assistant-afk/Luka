'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const NOTICES: Record<string, { text: string; tone: 'ok' | 'error' }> = {
  enlace: { text: 'El enlace no es válido o ya venció. Pide uno nuevo.', tone: 'error' },
  borrada: { text: 'Tu cuenta fue borrada.', tone: 'ok' },
}

function Notice() {
  const params = useSearchParams()
  const key = params.get('aviso') ?? (params.get('cuenta') === 'borrada' ? 'borrada' : null)
  const n = key ? NOTICES[key] : null
  if (!n) return null
  return (
    <p role="status" className={`mb-3 rounded-lg p-3 text-sm ${n.tone === 'ok' ? 'bg-brand-50 text-brand-700' : 'bg-rose-50 text-rose-700'}`}>
      {n.text}
    </p>
  )
}

/** Avisos en la página de inicio de sesión (?aviso=enlace, ?cuenta=borrada). */
export function LoginNotice() {
  return (
    <Suspense>
      <Notice />
    </Suspense>
  )
}
