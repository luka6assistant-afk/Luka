'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { safeNext } from '@/lib/safe-next'

/** Código de invitación de otra familia (?ref=…), solo letras y números. */
const cleanRef = (v: string | null) => (v && /^[A-Za-z0-9]{5,10}$/.test(v) ? v.toUpperCase() : null)

function Field() {
  const params = useSearchParams()
  const next = safeNext(params.get('next'))
  const ref = cleanRef(params.get('ref'))
  return (
    <>
      {next && <input type="hidden" name="next" value={next} />}
      {ref && <input type="hidden" name="ref" value={ref} />}
      {ref && (
        <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700">
          🎁 Llegaste invitado: cuando paguen su primer plan, tu familia y la que te invitó reciben un mes gratis.
        </p>
      )}
    </>
  )
}

/** Campos ocultos con la ruta a la que volver (?next=) y el código de invitación (?ref=). */
export function NextField() {
  return (
    <Suspense>
      <Field />
    </Suspense>
  )
}

function KeepNext({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  const params = useSearchParams()
  const q = new URLSearchParams()
  const next = safeNext(params.get('next'))
  const ref = cleanRef(params.get('ref'))
  if (next) q.set('next', next)
  if (ref) q.set('ref', ref)
  const qs = q.toString()
  return (
    <Link href={qs ? `${href}?${qs}` : href} className={className}>
      {children}
    </Link>
  )
}

/** Enlace entre login y registro que conserva ?next= y ?ref= */
export function NextLink(props: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Suspense
      fallback={
        <Link href={props.href} className={props.className}>
          {props.children}
        </Link>
      }
    >
      <KeepNext {...props} />
    </Suspense>
  )
}
