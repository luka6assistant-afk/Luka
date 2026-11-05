import Link from 'next/link'
import { requireFamily } from '@/lib/session'
import { PLANS, getAccess, type PaidPlanId } from '@/lib/plans'
import { money } from '@/lib/format'
import { startCheckout } from '@/app/actions'
import { Card, Progress } from '@/components/cards'
import { SubmitButton } from '@/components/ui'

const STATUS_LABEL: Record<string, string> = {
  APPROVED: '✅ Aprobado',
  PENDING: '🕓 Pendiente',
  DECLINED: '❌ Rechazado',
  VOIDED: '↩️ Anulado',
  ERROR: '⚠️ Error',
}

export default async function PlanPage() {
  const { supabase, family } = await requireFamily()
  const [access, { data: payments }] = await Promise.all([
    getAccess(supabase, family),
    supabase.from('payments').select('*').eq('family_id', family.id).order('created_at', { ascending: false }).limit(10),
  ])
  const untilLabel = access.until.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' })

  return (
    <div className="space-y-4">
      <Card title="Tu plan">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Plan actual</p>
            <p className="text-xl font-semibold">{access.plan.name}</p>
            <p className={`text-sm ${access.active ? 'text-slate-600' : 'text-rose-600'}`}>
              {access.active
                ? `${access.plan.id === 'trial' ? 'La prueba termina' : 'Pagado hasta'} el ${untilLabel} (${access.daysLeft} días)`
                : `Venció el ${untilLabel}. El bot no está leyendo recibos.`}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="mb-1 flex justify-between text-sm">
              <span className="text-slate-600">Lecturas con IA este mes</span>
              <span className="tabular-nums">
                {access.used} / {access.plan.aiLimit}
              </span>
            </p>
            <Progress value={access.used} max={access.plan.aiLimit} />
            <p className="mt-1 text-xs text-slate-500">
              Cada foto, PDF o mensaje con un monto que lee el bot cuenta como una lectura. El contador se reinicia el 1 de cada mes.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {(['familia', 'plus'] as PaidPlanId[]).map((id) => {
          const p = PLANS[id]
          const current = access.plan.id === id && access.active
          return (
            <section
              key={id}
              className={`rounded-2xl border bg-white p-6 shadow-sm ${id === 'plus' ? 'border-brand-500 ring-1 ring-brand-500' : 'border-slate-200'}`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{p.name}</h2>
                {id === 'plus' && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Recomendado</span>}
              </div>
              <p className="mt-2">
                <span className="text-3xl font-bold tabular-nums">{money(p.monthlyPrice)}</span>
                <span className="text-slate-500"> /mes</span>
              </p>
              <p className="text-sm text-slate-500">o {money(p.yearlyPrice)} al año (2 meses gratis)</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {p.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              <form action={startCheckout} className="mt-6 grid grid-cols-2 gap-2">
                <input type="hidden" name="plan" value={id} />
                <SubmitButton className={id === 'plus' ? 'btn' : 'btn-ghost'}>
                  1 mes
                </SubmitButton>
                <button type="submit" name="period" value="yearly" className={id === 'plus' ? 'btn' : 'btn-ghost'}>
                  1 año
                </button>
              </form>
              {current && <p className="mt-2 text-xs text-slate-500">Es tu plan actual: pagar suma el tiempo al vencimiento.</p>}
            </section>
          )
        })}
      </div>
      <p className="text-center text-xs text-slate-500">
        Pagos seguros con Wompi (Bancolombia): tarjeta, PSE, Nequi, botón Bancolombia. El pago es por periodo, no se renueva solo: te
        avisaremos por Telegram antes de que venza. Al pagar aceptas los{' '}
        <Link href="/terminos" className="underline">
          Términos y condiciones
        </Link>
        . Tienes 5 días hábiles de derecho de retracto.
      </p>

      {!!payments?.length && (
        <Card title="Historial de pagos">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2">Fecha</th>
                <th>Plan</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Referencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2">{new Date(p.created_at).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}</td>
                  <td>
                    {PLANS[p.plan as PaidPlanId]?.name} · {p.period === 'yearly' ? 'anual' : 'mensual'}
                  </td>
                  <td className="tabular-nums">{money(Number(p.amount_in_cents) / 100)}</td>
                  <td>{STATUS_LABEL[p.status] ?? p.status}</td>
                  <td className="font-mono text-xs text-slate-500">{p.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
