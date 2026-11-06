'use client'

import { useActionState, useRef, useState } from 'react'
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

/**
 * Select que envía su formulario al cambiar. Es controlado: React reinicia los campos no controlados
 * al terminar una acción de formulario, y el valor elegido parecía "devolverse" aunque sí se guardaba.
 */
export function AutoSubmitSelect({ defaultValue, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [value, setValue] = useState(defaultValue ?? '')
  return (
    <select
      {...props}
      value={value as string}
      onChange={(e) => {
        setValue(e.target.value)
        const form = e.currentTarget.form
        // Espera a que React aplique el nuevo valor antes de enviar
        queueMicrotask(() => form?.requestSubmit())
      }}
    />
  )
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
