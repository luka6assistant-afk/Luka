import Link from 'next/link'
import { requireFamily } from '@/lib/session'
import { deleteFamily, deleteMyAccount } from '@/app/actions'
import { Card } from '@/components/cards'
import { ActionForm, SubmitButton } from '@/components/ui'
import { LEGAL } from '@/lib/legal'

export default async function MisDatosPage() {
  const { isAdmin, family } = await requireFamily()
  return (
    <div className="space-y-4">
      <Card title="🔒 Tus datos">
        <p className="text-sm text-slate-700">
          Puedes descargar tu información o borrarla cuando quieras, sin escribirnos. Cómo la tratamos está en la{' '}
          <Link href="/privacidad" className="text-brand-700 underline">
            Política de tratamiento de datos
          </Link>
          .
        </p>
      </Card>

      <Card title="Descargar">
        <ul className="space-y-3 text-sm">
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span>Todos los movimientos de la familia (CSV, se abre con Excel o Google Sheets)</span>
            <a href="/mis-datos/exportar?tipo=movimientos" className="btn-ghost">
              Descargar movimientos
            </a>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span>Tu cuenta, familias y autorizaciones aceptadas (JSON)</span>
            <a href="/mis-datos/exportar?tipo=personales" className="btn-ghost">
              Descargar mis datos
            </a>
          </li>
        </ul>
      </Card>

      <Card title="Borrar mi cuenta">
        <div className="space-y-2 text-sm text-slate-700">
          <p>Se borran tu cuenta, tu acceso y tu registro como miembro. No se puede deshacer.</p>
          <ul className="list-disc pl-5">
            <li>Los movimientos que registraste se quedan en la familia, pero sin tu nombre.</li>
            <li>Si eres el único miembro, también se borra la familia con todos sus datos.</li>
            <li>Si eres el único administrador y hay más miembros, primero nombra a otro administrador en Familia.</li>
            <li>Si después vuelves a escribirle al bot en el grupo, se creará un registro nuevo con tu nombre de Telegram.</li>
          </ul>
        </div>
        <ActionForm action={deleteMyAccount} className="mt-4 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="confirm-cuenta" className="label">
              Para confirmar escribe BORRAR
            </label>
            <input id="confirm-cuenta" name="confirm" className="input w-48" autoComplete="off" required />
          </div>
          <SubmitButton className="inline-flex items-center rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800">
            Borrar mi cuenta
          </SubmitButton>
        </ActionForm>
      </Card>

      {isAdmin && (
        <Card title={`Borrar la familia "${family.name}"`}>
          <p className="text-sm text-slate-700">
            Se borran para todos los miembros: movimientos, fotos de recibos, presupuestos, metas, y el vínculo con Telegram. Los
            comprobantes de pago se conservan, sin datos de la familia, porque la ley contable lo exige. Las cuentas de los miembros que usan correo se conservan, sin familia. No se puede
            deshacer. Te recomendamos descargar los movimientos antes.
          </p>
          <ActionForm action={deleteFamily} className="mt-4 flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="confirm-familia" className="label">
                Para confirmar escribe BORRAR
              </label>
              <input id="confirm-familia" name="confirm" className="input w-48" autoComplete="off" required />
            </div>
            <SubmitButton className="inline-flex items-center rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800">
              Borrar la familia
            </SubmitButton>
          </ActionForm>
        </Card>
      )}

      <p className="text-xs text-slate-600">
        También puedes pedir la consulta, corrección o supresión de tus datos escribiendo a {LEGAL.email}. Los registros de pagos se
        conservan el tiempo que exigen las normas contables.
      </p>
    </div>
  )
}
