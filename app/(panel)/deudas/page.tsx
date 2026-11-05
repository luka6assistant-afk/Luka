import { requireFamily } from '@/lib/session'
import { debtPayoff, multiDebtPlan } from '@/lib/finance'
import { money, monthLabel, monthStart, parseCOP } from '@/lib/format'
import type { Debt } from '@/lib/types'
import { archiveDebt, quickMovement, saveDebt } from '@/app/actions'
import { Card, Empty, Progress, Stat } from '@/components/cards'
import { ConfirmButton, SubmitButton } from '@/components/ui'
import { PlusUpsell } from '@/components/upsell'
import { getAccess } from '@/lib/plans'
import { FEATURES } from '@/lib/features'
import { notFound } from 'next/navigation'

function DebtFields({ d }: { d?: Debt }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {d && <input type="hidden" name="id" value={d.id} />}
      <div>
        <label className="label">Nombre</label>
        <input name="name" defaultValue={d?.name} placeholder="Tarjeta Visa" required className="input" />
      </div>
      <div>
        <label className="label">Entidad</label>
        <input name="creditor" defaultValue={d?.creditor ?? ''} placeholder="Bancolombia" className="input" />
      </div>
      <div>
        <label className="label">Saldo actual</label>
        <input name="balance" defaultValue={d ? Number(d.balance).toLocaleString('es-CO') : ''} inputMode="decimal" required className="input" />
      </div>
      <div>
        <label className="label">Monto original</label>
        <input name="original_amount" defaultValue={d ? Number(d.original_amount).toLocaleString('es-CO') : ''} inputMode="decimal" className="input" />
      </div>
      <div>
        <label className="label">Tasa E.A. (%)</label>
        <input name="annual_rate" defaultValue={d ? (Number(d.annual_rate) * 100).toFixed(2) : ''} placeholder="28" inputMode="decimal" className="input" />
      </div>
      <div>
        <label className="label">Cuota mensual</label>
        <input name="monthly_payment" defaultValue={d ? Number(d.monthly_payment).toLocaleString('es-CO') : ''} inputMode="decimal" className="input" />
      </div>
      <div>
        <label className="label">Día de pago</label>
        <input name="due_day" type="number" min={1} max={31} defaultValue={d?.due_day ?? ''} className="input" />
      </div>
    </div>
  )
}

export default async function DeudasPage(props: PageProps<'/deudas'>) {
  const sp = await props.searchParams
  const { supabase, family } = await requireFamily()
  if (!FEATURES.debts) notFound()
  if (!(await getAccess(supabase, family)).plan.debts) return <PlusUpsell feature="El plan de deudas" />
  const { data } = await supabase.from('debts').select('*').eq('family_id', family.id).eq('active', true).order('balance', { ascending: false })
  const debts = (data ?? []) as Debt[]

  const total = debts.reduce((s, d) => s + Number(d.balance), 0)
  const minSum = debts.reduce((s, d) => s + Number(d.monthly_payment), 0)
  const budget = (typeof sp.pago === 'string' ? parseCOP(sp.pago) : null) ?? minSum
  const avalanche = multiDebtPlan(debts, budget, 'avalanche')
  const snowball = multiDebtPlan(debts, budget, 'snowball')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Deuda total" value={money(total)} tone={total > 0 ? 'bad' : 'good'} />
        <Stat label="Cuotas mínimas / mes" value={money(minSum)} />
        <Stat label="Deudas activas" value={String(debts.length)} />
      </div>

      {debts.length === 0 ? (
        <Empty>Sin deudas registradas. ¡Ojalá siga así! Si tienen alguna, agréguenla abajo.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {debts.map((d) => {
            const plan = debtPayoff(Number(d.balance), Number(d.annual_rate), Number(d.monthly_payment))
            const paid = Number(d.original_amount) - Number(d.balance)
            return (
              <Card key={d.id} title={`💳 ${d.name}`} action={<span className="text-xs text-slate-500">{d.creditor}</span>}>
                <p className="text-2xl font-semibold tabular-nums">{money(d.balance)}</p>
                {Number(d.original_amount) > 0 && (
                  <div className="mt-2">
                    <Progress value={paid} max={Number(d.original_amount)} />
                    <p className="mt-1 text-xs text-slate-500">
                      Pagado {money(paid)} de {money(d.original_amount)}
                    </p>
                  </div>
                )}
                <p className="mt-3 text-sm text-slate-600">
                  {(Number(d.annual_rate) * 100).toFixed(1)}% E.A. · cuota {money(d.monthly_payment)}
                  {d.due_day ? ` · día ${d.due_day}` : ''}
                </p>
                <p className={`mt-1 text-sm ${plan.months === null ? 'text-rose-600' : 'text-slate-600'}`}>
                  {plan.months === null
                    ? '⚠️ La cuota no alcanza a cubrir los intereses: la deuda crece.'
                    : plan.months === 0
                      ? '🎉 Pagada'
                      : `Terminan de pagar en ${plan.months} meses (${monthLabel(plan.payoffDate!)}) · intereses ≈ ${money(plan.totalInterest)}`}
                </p>
                <form action={quickMovement} className="mt-4 flex gap-2">
                  <input type="hidden" name="kind" value="debt_payment" />
                  <input type="hidden" name="target_id" value={d.id} />
                  <input name="amount" placeholder="Abono" inputMode="decimal" required className="input" />
                  <SubmitButton>Abonar</SubmitButton>
                </form>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-slate-500">Editar</summary>
                  <form action={saveDebt} className="mt-3 space-y-3">
                    <DebtFields d={d} />
                    <div className="flex justify-between">
                      <SubmitButton>Guardar</SubmitButton>
                      <ConfirmButton message="¿Archivar esta deuda?" formAction={archiveDebt}>
                        Archivar
                      </ConfirmButton>
                    </div>
                  </form>
                </details>
              </Card>
            )
          })}
        </div>
      )}

      {debts.length > 1 && (
        <Card title="Plan para salir de deudas">
          <form className="mb-4 flex flex-wrap items-end gap-2">
            <div>
              <label className="label">¿Cuánto pueden destinar al mes en total?</label>
              <input name="pago" defaultValue={budget.toLocaleString('es-CO')} inputMode="decimal" className="input" />
            </div>
            <button className="btn-ghost">Calcular</button>
          </form>
          {avalanche.months === null && budget < minSum ? (
            <p className="text-sm text-rose-600">El monto no cubre las cuotas mínimas ({money(minSum)}).</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { t: '🏔 Avalancha', sub: 'Primero la de mayor tasa: paga menos intereses', p: avalanche },
                { t: '⛄ Bola de nieve', sub: 'Primero la de menor saldo: victorias rápidas', p: snowball },
              ].map(({ t, sub, p }) => (
                <div key={t} className="rounded-xl bg-slate-50 p-4">
                  <p className="font-medium">{t}</p>
                  <p className="text-xs text-slate-500">{sub}</p>
                  <p className="mt-2 text-sm">
                    {p.months === null ? 'No se alcanza a pagar en 50 años' : `Libres de deudas en ${p.months} meses (${monthLabel(monthStart(p.months))})`}
                  </p>
                  <p className="text-sm text-slate-600">Intereses totales ≈ {money(p.totalInterest)}</p>
                  <ol className="mt-2 list-decimal pl-5 text-sm text-slate-600">
                    {p.steps.map((s) => (
                      <li key={s.debtId}>
                        {s.name} — mes {s.payoffMonth}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card title="Agregar deuda">
        <form action={saveDebt} className="space-y-3">
          <DebtFields />
          <SubmitButton>Agregar deuda</SubmitButton>
        </form>
      </Card>
    </div>
  )
}
