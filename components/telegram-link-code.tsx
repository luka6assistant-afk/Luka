'use client'

import { useActionState } from 'react'
import { createTelegramLinkCode, type FormState } from '@/app/actions'
import { SubmitButton } from './ui'

/** "Soy yo" verificado: muestra un código que la persona escribe en el grupo con /soyyo. */
export function TelegramLinkCode() {
  const [state, action] = useActionState<FormState, FormData>(() => createTelegramLinkCode(), undefined)
  return (
    <form action={action} className="space-y-2 text-sm">
      {state?.ok ? (
        <div className="rounded-lg bg-brand-50 p-3 text-brand-700">
          <p>Escribe esto en el grupo de Telegram de la familia, desde tu cuenta, en los próximos 10 minutos:</p>
          <p className="mt-2 select-all rounded bg-white px-3 py-2 text-center font-mono text-base text-ink">/soyyo {state.ok}</p>
        </div>
      ) : (
        <p className="text-slate-700">
          Si también escribes en el grupo de Telegram, une tu usuario de Telegram a esta cuenta para que tus movimientos queden con tu
          nombre y puedas entrar al panel desde el chat.
        </p>
      )}
      {state?.error && <p className="text-rose-700">{state.error}</p>}
      <SubmitButton className="btn-ghost">{state?.ok ? 'Generar otro código' : 'Conectar mi Telegram'}</SubmitButton>
    </form>
  )
}
