import Link from 'next/link'
import { acceptLegal, signOut } from '@/app/actions'
import { ActionForm, SubmitButton } from '@/components/ui'
import { LegalCheckbox } from '@/components/legal-checkbox'
import { NextField } from '@/components/next-field'
import { LEGAL } from '@/lib/legal'

/** Se muestra a usuarios que no han aceptado la versión vigente de los documentos. */
export default function AceptarPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-3xl">📄</div>
        <h1 className="mt-2 text-lg font-semibold">Actualizamos nuestros documentos</h1>
        <p className="mt-2 text-sm text-slate-600">
          Para seguir usando {LEGAL.product}, revisa y acepta los{' '}
          <Link href="/terminos" target="_blank" className="text-brand-700 underline">
            Términos y condiciones
          </Link>{' '}
          y la{' '}
          <Link href="/privacidad" target="_blank" className="text-brand-700 underline">
            Política de tratamiento de datos
          </Link>{' '}
          (versión {LEGAL.versions.privacidad}).
        </p>
        <ActionForm action={acceptLegal} className="mt-4 space-y-4">
          <NextField />
          <LegalCheckbox />
          <SubmitButton className="btn w-full">Aceptar y continuar</SubmitButton>
        </ActionForm>
        <form action={signOut} className="mt-4 text-center">
          <button className="text-sm text-slate-500 underline">No acepto, cerrar sesión</button>
        </form>
      </div>
    </main>
  )
}
