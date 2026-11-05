'use client'

import { useActionState, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import type { FormState } from '@/app/actions'

export function SubmitButton({ children, className = 'btn' }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? '…' : children}
    </button>
  )
}

/** Formulario con mensajes de error/éxito usando useActionState. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>
  children: React.ReactNode
  className?: string
  resetOnSuccess?: boolean
}) {
  const ref = useRef<HTMLFormElement>(null)
  const [state, formAction] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await action(prev, fd)
    if (res?.ok && resetOnSuccess) ref.current?.reset()
    return res
  }, undefined)
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state?.error && <p className="mt-2 text-sm text-rose-600">{state.error}</p>}
      {state?.ok && <p className="mt-2 text-sm text-brand-700">{state.ok}</p>}
    </form>
  )
}

/** Select que envía su formulario al cambiar. */
export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />
}

/** Botón que pide confirmación antes de enviar. */
export function ConfirmButton({
  children,
  message,
  className = 'btn-danger',
  ...rest
}: { message: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      {...rest}
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault()
      }}
    >
      {children}
    </button>
  )
}
