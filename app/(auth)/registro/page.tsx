import { signUp } from '@/app/actions'
import { ActionForm, SubmitButton } from '@/components/ui'
import { NextField, NextLink } from '@/components/next-field'
import { LegalCheckbox } from '@/components/legal-checkbox'

export default function RegistroPage() {
  return (
    <>
      <h2 className="mb-4 text-lg font-semibold">Crear cuenta</h2>
      <ActionForm action={signUp} className="space-y-3">
        <NextField />
        <div>
          <label className="label">Tu nombre</label>
          <input name="name" required className="input" autoComplete="name" />
        </div>
        <div>
          <label className="label">Correo</label>
          <input name="email" type="email" required className="input" autoComplete="email" />
        </div>
        <div>
          <label className="label">Contraseña (mín. 6 caracteres)</label>
          <input name="password" type="password" minLength={6} required className="input" autoComplete="new-password" />
        </div>
        <LegalCheckbox />
        <SubmitButton className="btn w-full">Crear cuenta</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm text-slate-500">
        ¿Ya tienes cuenta?{' '}
        <NextLink href="/login" className="font-medium text-brand-700">
          Inicia sesión
        </NextLink>
      </p>
    </>
  )
}
