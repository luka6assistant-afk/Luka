'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { safeNext } from '@/lib/safe-next'

function Field() {
  const next = safeNext(useSearchParams().get('next'))
  return next ? <input type="hidden" name="next" value={next} /> : null
}

/** Campo oculto con la ruta a la que volver después de iniciar sesión o registrarse. */
export function NextField() {
  return (
    <Suspense>
      <Field />
    </Suspense>
  )
}

function KeepNext({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  const next = safeNext(useSearchParams().get('next'))
  return (
    <Link href={next ? `${href}?next=${encodeURIComponent(next)}` : href} className={className}>
      {children}
    </Link>
  )
}

/** Enlace entre login y registro que conserva ?next= */
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
