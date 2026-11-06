import Link from 'next/link'
import { requestPasswordReset } from '@/app/actions'
import { ActionForm, SubmitButton } from '@/components/ui'

export default function RecuperarPage() {
  return (
    <>
      <h2 className="mb-2 text-lg font-semibold">Recuperar contraseña</h2>
      <p className="mb-4 text-sm text-slate-600">Escribe el correo de tu cuenta y te enviamos un enlace para crear una contraseña nueva.</p>
      <ActionForm action={requestPasswordReset} className="space-y-3">
        <div>
          <label htmlFor="email" className="label">
            Correo
          </label>
          <input id="email" name="email" type="email" required className="input" autoComplete="email" />
        </div>
        <SubmitButton className="btn w-full">Enviar enlace</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm text-slate-600">
        <Link href="/login" className="font-medium text-brand-700">
          Volver a iniciar sesión
        </Link>
      </p>
    </>
  )
}
