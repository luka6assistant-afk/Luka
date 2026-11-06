import { updatePassword } from '@/app/actions'
import { ActionForm, SubmitButton } from '@/components/ui'

/** Se llega aquí desde el enlace del correo de recuperación (ya con la sesión abierta). */
export default function NuevaClavePage() {
  return (
    <>
      <h2 className="mb-4 text-lg font-semibold">Crea una contraseña nueva</h2>
      <ActionForm action={updatePassword} className="space-y-3">
        <div>
          <label htmlFor="password" className="label">
            Contraseña nueva (mín. 8 caracteres)
          </label>
          <input id="password" name="password" type="password" minLength={8} required className="input" autoComplete="new-password" />
        </div>
        <div>
          <label htmlFor="confirm" className="label">
            Repite la contraseña
          </label>
          <input id="confirm" name="confirm" type="password" minLength={8} required className="input" autoComplete="new-password" />
        </div>
        <SubmitButton className="btn w-full">Guardar y entrar</SubmitButton>
      </ActionForm>
    </>
  )
}
