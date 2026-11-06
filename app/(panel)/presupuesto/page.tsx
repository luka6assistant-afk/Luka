import { requireFamily } from '@/lib/session'
import { getDebtMonth, getHistory, getMonthSummary } from '@/lib/finance'
import { FEATURES } from '@/lib/features'
import Link from 'next/link'
import { money } from '@/lib/format'
import type { Category } from '@/lib/types'
import { addCategory, deleteCategory, saveAlertThreshold, saveBudgets } from '@/app/actions'
import { BudgetImport } from '@/components/budget-import'
import { Card, Progress } from '@/components/cards'
import { ConfirmButton, SubmitButton } from '@/components/ui'

export default async function PresupuestoPage() {
  const { supabase, family, isAdmin } = await requireFamily()
  const [summary, history, { data: cats }, debtMonth] = await Promise.all([
    getMonthSummary(supabase, family.id),
    getHistory(supabase, family.id, 4),
    supabase.from('categories').select('*').eq('family_id', family.id).order('kind').order('name'),
    FEATURES.debts ? getDebtMonth(supabase, family.id) : Promise.resolve([]),
  ])
  const debtCuotas = debtMonth.reduce((s, l) => s + Number(l.debt.monthly_payment), 0)
  const debtDue = debtMonth.reduce((s, l) => s + l.due, 0)
  const categories = (cats ?? []) as Category[]
  const lumpDebtCategory = categories.find((c) => c.kind === 'expense' && /^deuda/i.test(c.name) && Number(c.monthly_budget) > 0)
  const closed = history.slice(0, -1).filter((p) => p.income > 0)
  const avgIncome = summary.expectedIncome > 0 ? summary.expectedIncome : closed.length ? closed.reduce((s, p) => s + p.income, 0) / closed.length : summary.income
  const incomeLabel = summary.expectedIncome > 0 ? 'Ingresos esperados' : 'Ingreso promedio'
  const totalBudget = categories.filter((c) => c.kind === 'expense').reduce((s, c) => s + Number(c.monthly_budget), 0)
  const threshold = family.alert_threshold ?? 80
  const totalSpent = summary.byCategory.filter((l) => l.budget > 0).reduce((s, l) => s + l.spent, 0)
  const remainingAll = totalBudget - totalSpent + debtDue

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Presupuesto mensual por categoría" className="lg:col-span-2">
        <form action={saveBudgets} className="space-y-3">
          {categories
            .filter((c) => c.kind === 'expense')
            .map((c) => {
              const line = summary.byCategory.find((l) => l.category.id === c.id)
              return (
                <div key={c.id} className="grid grid-cols-[1fr_9rem_auto] items-center gap-3">
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>
                        {c.icon} {c.name}
                      </span>
                      <span className="tabular-nums text-slate-500">
                        {money(line?.spent ?? 0)} · proy. {money(line?.projected ?? 0)}
                      </span>
                    </div>
                    <Progress value={line?.spent ?? 0} max={Number(c.monthly_budget)} projected={line?.projected} />
                    {Number(c.monthly_budget) > 0 && line && (
                      <p className={`mt-1 text-xs tabular-nums ${line.remaining < 0 ? 'font-medium text-rose-700' : line.spent / line.budget >= threshold / 100 ? 'font-medium text-amber-700' : 'text-slate-600'}`}>
                        {line.remaining >= 0 ? `Quedan ${money(line.remaining)}` : `Se pasaron por ${money(-line.remaining)}`}
                        {line.pending > 0 && <span className="font-normal text-slate-500"> · {money(line.pending)} por confirmar</span>}
                      </p>
                    )}
                  </div>
                  <input
                    name={`budget:${c.id}`}
                    defaultValue={Number(c.monthly_budget) ? Number(c.monthly_budget).toLocaleString('es-CO') : ''}
                    aria-label={`Presupuesto mensual de ${c.name}`} placeholder="0"
                    inputMode="decimal"
                    readOnly={!isAdmin}
                    className="input text-right tabular-nums read-only:bg-slate-50"
                  />
                  {isAdmin && (
                  <ConfirmButton
                    message={`¿Borrar la categoría ${c.name}? Los movimientos quedarán sin categoría.`}
                    form={`del-${c.id}`}
                    title="Borrar categoría"
                  >
                    🗑
                  </ConfirmButton>
                  )}
                </div>
              )
            })}
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <p className="text-sm text-slate-600">
              {debtCuotas > 0 ? (
                <>
                  Gastos <b className="tabular-nums">{money(totalBudget)}</b> + cuotas de deudas <b className="tabular-nums">{money(debtCuotas)}</b> ={' '}
                  <b className="tabular-nums">{money(totalBudget + debtCuotas)}</b> al mes
                  <br />
                </>
              ) : (
                <>
                  Total presupuestado: <b className="tabular-nums">{money(totalBudget)}</b> ·{' '}
                </>
              )}
              Quedan este mes{' '}
              <b className={`tabular-nums ${remainingAll < 0 ? 'text-rose-700' : 'text-brand-700'}`}>{money(remainingAll)}</b>
              {debtCuotas > 0 && <span className="text-xs text-slate-500"> (gastos {money(totalBudget - totalSpent)} + cuotas por pagar {money(debtDue)})</span>}
            </p>
            {isAdmin ? <SubmitButton>Guardar presupuesto</SubmitButton> : <span className="text-xs text-slate-500">Solo el administrador edita el presupuesto</span>}
          </div>
        </form>
        {/* Formularios de borrado fuera del formulario principal (Enter no debe borrar) */}
        {categories.map((c) => (
          <form key={c.id} id={`del-${c.id}`} action={deleteCategory} className="hidden">
            <input type="hidden" name="id" value={c.id} />
          </form>
        ))}
      </Card>

      <div className="space-y-4">
        <Card title="¿Alcanza?">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">{incomeLabel}</dt>
              <dd className="font-medium tabular-nums">{money(avgIncome)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Gastos presupuestados</dt>
              <dd className="font-medium tabular-nums">− {money(totalBudget)}</dd>
            </div>
            {debtCuotas > 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-600">Cuotas de deudas</dt>
                <dd className="font-medium tabular-nums">− {money(debtCuotas)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <dt className="text-slate-600">{debtCuotas > 0 ? 'Queda para ahorro' : 'Queda para deudas y ahorro'}</dt>
              <dd className={`font-semibold tabular-nums ${avgIncome - totalBudget - debtCuotas < 0 ? 'text-rose-600' : 'text-brand-700'}`}>
                {money(avgIncome - totalBudget - debtCuotas)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            Regla de referencia 50/30/20: {money(avgIncome * 0.5)} necesidades · {money(avgIncome * 0.3)} gustos · {money(avgIncome * 0.2)} ahorro y deudas.
          </p>
        </Card>

        {FEATURES.debts && (
          <Card title="💳 Cuotas de deudas del mes" action={<Link href="/deudas" className="text-sm text-brand-700">Ver deudas</Link>}>
            {debtMonth.length === 0 ? (
              <p className="text-sm text-slate-700">
                Aún no hay deudas registradas. Agrégalas una por una en <Link href="/deudas" className="font-medium text-brand-700 underline">Deudas</Link>{' '}
                o impórtalas desde tu Excel: cada abono descuenta del saldo y de la cuota del mes.
              </p>
            ) : (
              <>
                <ul className="space-y-2 text-sm">
                  {debtMonth.map((l) => (
                    <li key={l.debt.id} className="flex items-center justify-between gap-2">
                      <span>💳 {l.debt.name}</span>
                      <span className={`tabular-nums ${l.due > 0 ? 'text-slate-700' : 'text-brand-700'}`}>
                        {Number(l.debt.monthly_payment) <= 0 ? money(l.paid) : l.due > 0 ? `faltan ${money(l.due)}` : 'pagada ✓'}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
                  Cuotas del mes <b className="tabular-nums">{money(debtCuotas)}</b> · faltan{' '}
                  <b className={`tabular-nums ${debtDue > 0 ? 'text-slate-800' : 'text-brand-700'}`}>{money(debtDue)}</b>
                </p>
                {lumpDebtCategory && (
                  <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                    La categoría {lumpDebtCategory.icon} {lumpDebtCategory.name} tiene {money(Number(lumpDebtCategory.monthly_budget))} presupuestados. Ahora que
                    las deudas están desglosadas, ponla en 0 para no contar las cuotas dos veces.
                  </p>
                )}
              </>
            )}
          </Card>
        )}

        <Card title="🔔 Alertas de presupuesto">
          <p className="text-sm text-slate-700">
            Luka avisa en el chat una vez cuando una categoría llega al {threshold} % y otra cuando llega al 100 %. Cada movimiento
            muestra cuánto queda.
          </p>
          {isAdmin && (
            <form action={saveAlertThreshold} className="mt-3 flex items-end gap-2">
              <div className="flex-1">
                <label htmlFor="threshold" className="label">
                  Avisar cuando se use el
                </label>
                <select id="threshold" name="threshold" defaultValue={threshold} className="input">
                  {[50, 60, 70, 75, 80, 85, 90, 95].map((v) => (
                    <option key={v} value={v}>
                      {v} % del presupuesto
                    </option>
                  ))}
                </select>
              </div>
              <SubmitButton>Guardar</SubmitButton>
            </form>
          )}
        </Card>

        {isAdmin && <BudgetImport />}

        {isAdmin && (
        <Card title="Nueva categoría">
          <form action={addCategory} className="space-y-3">
            <div className="grid grid-cols-[4rem_1fr] gap-2">
              <input name="icon" aria-label="Ícono (emoji)" placeholder="🧸" className="input text-center" maxLength={4} />
              <input name="name" aria-label="Nombre" placeholder="Nombre" required className="input" />
            </div>
            <select name="kind" aria-label="Tipo de categoría" className="input">
              <option value="expense">Gasto</option>
              <option value="income">Ingreso</option>
            </select>
            <input name="monthly_budget" aria-label="Presupuesto mensual" placeholder="Presupuesto mensual" inputMode="decimal" className="input" />
            <SubmitButton className="btn w-full">Agregar</SubmitButton>
          </form>
        </Card>
        )}

        <Card title="💰 Ingresos del mes">
          <form action={saveBudgets} className="space-y-3">
            {summary.incomeLines.map((l) => (
              <div key={l.category.id} className="grid grid-cols-[1fr_8rem] items-center gap-2 text-sm">
                <div>
                  <p>
                    {l.category.icon} {l.category.name}
                  </p>
                  <p className={`text-xs tabular-nums ${l.expected > 0 && l.received >= l.expected ? 'text-brand-700' : 'text-slate-600'}`}>
                    Recibido {money(l.received)}
                    {l.expected > 0 && (l.received >= l.expected ? ' ✓' : ` · faltan ${money(l.expected - l.received)}`)}
                  </p>
                </div>
                <input
                  name={`budget:${l.category.id}`}
                  defaultValue={l.expected ? l.expected.toLocaleString('es-CO') : ''}
                  aria-label={`Ingreso esperado de ${l.category.name}`}
                  placeholder="Esperado"
                  inputMode="decimal"
                  readOnly={!isAdmin}
                  className="input text-right tabular-nums read-only:bg-slate-50"
                />
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
              <span className="text-slate-600">
                Esperado <b className="tabular-nums">{money(summary.expectedIncome)}</b> · recibido{' '}
                <b className="tabular-nums">{money(summary.income)}</b>
              </span>
              {isAdmin && <SubmitButton>Guardar</SubmitButton>}
            </div>
          </form>
          {isAdmin && (
            <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
              {summary.incomeLines.map((l) => (
                <li key={l.category.id} className="flex items-center justify-between">
                  <span>
                    Borrar {l.category.icon} {l.category.name}
                  </span>
                  <ConfirmButton message={`¿Borrar ${l.category.name}?`} form={`del-${l.category.id}`} title={`Borrar ${l.category.name}`}>
                    🗑
                  </ConfirmButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
