import { signIn } from '@/app/actions'
import { ActionForm, SubmitButton } from '@/components/ui'
import { NextField, NextLink } from '@/components/next-field'
import { LoginNotice } from '@/components/login-notice'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <>
      <h2 className="mb-4 text-lg font-semibold">Iniciar sesión</h2>
      <LoginNotice />
      <ActionForm action={signIn} className="space-y-3">
        <NextField />
        <div>
          <label className="label">Correo</label>
          <input aria-label="Correo" name="email" type="email" required className="input" autoComplete="email" />
        </div>
        <div>
          <label className="label">Contraseña</label>
          <input aria-label="Contraseña" name="password" type="password" required className="input" autoComplete="current-password" />
        </div>
        <p className="text-right text-sm">
          <Link href="/recuperar" className="text-brand-700">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
        <SubmitButton className="btn w-full">Entrar</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm text-slate-500">
        ¿No tienes cuenta?{' '}
        <NextLink href="/registro" className="font-medium text-brand-700">
          Regístrate
        </NextLink>
      </p>
    </>
  )
}
