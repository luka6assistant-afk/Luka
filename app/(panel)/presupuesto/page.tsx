import { requireFamily } from '@/lib/session'
import { getHistory, getMonthSummary } from '@/lib/finance'
import { money } from '@/lib/format'
import type { Category } from '@/lib/types'
import { addCategory, deleteCategory, saveBudgets } from '@/app/actions'
import { Card, Progress } from '@/components/cards'
import { ConfirmButton, SubmitButton } from '@/components/ui'

export default async function PresupuestoPage() {
  const { supabase, family, isAdmin } = await requireFamily()
  const [summary, history, { data: cats }] = await Promise.all([
    getMonthSummary(supabase, family.id),
    getHistory(supabase, family.id, 4),
    supabase.from('categories').select('*').eq('family_id', family.id).order('kind').order('name'),
  ])
  const categories = (cats ?? []) as Category[]
  const closed = history.slice(0, -1).filter((p) => p.income > 0)
  const avgIncome = closed.length ? closed.reduce((s, p) => s + p.income, 0) / closed.length : summary.income
  const totalBudget = categories.filter((c) => c.kind === 'expense').reduce((s, c) => s + Number(c.monthly_budget), 0)

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
                  </div>
                  <input
                    name={`budget:${c.id}`}
                    defaultValue={Number(c.monthly_budget) ? Number(c.monthly_budget).toLocaleString('es-CO') : ''}
                    placeholder="0"
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
              Total presupuestado: <b>{money(totalBudget)}</b>
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
              <dt className="text-slate-600">Ingreso promedio</dt>
              <dd className="font-medium tabular-nums">{money(avgIncome)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Gastos presupuestados</dt>
              <dd className="font-medium tabular-nums">{money(totalBudget)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <dt className="text-slate-600">Queda para deudas y ahorro</dt>
              <dd className={`font-semibold tabular-nums ${avgIncome - totalBudget < 0 ? 'text-rose-600' : 'text-brand-700'}`}>
                {money(avgIncome - totalBudget)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            Regla de referencia 50/30/20: {money(avgIncome * 0.5)} necesidades · {money(avgIncome * 0.3)} gustos · {money(avgIncome * 0.2)} ahorro y deudas.
          </p>
        </Card>

        {isAdmin && (
        <Card title="Nueva categoría">
          <form action={addCategory} className="space-y-3">
            <div className="grid grid-cols-[4rem_1fr] gap-2">
              <input name="icon" placeholder="🧸" className="input text-center" maxLength={4} />
              <input name="name" placeholder="Nombre" required className="input" />
            </div>
            <select name="kind" className="input">
              <option value="expense">Gasto</option>
              <option value="income">Ingreso</option>
            </select>
            <input name="monthly_budget" placeholder="Presupuesto mensual" inputMode="decimal" className="input" />
            <SubmitButton className="btn w-full">Agregar</SubmitButton>
          </form>
        </Card>
        )}

        <Card title="Categorías de ingreso">
          <ul className="space-y-1 text-sm">
            {categories
              .filter((c) => c.kind === 'income')
              .map((c) => (
                <li key={c.id} className="flex items-center justify-between">
                  <span>
                    {c.icon} {c.name}
                  </span>
                  {isAdmin && (
                    <form action={deleteCategory}>
                      <input type="hidden" name="id" value={c.id} />
                      <ConfirmButton message={`¿Borrar ${c.name}?`}>🗑</ConfirmButton>
                    </form>
                  )}
                </li>
              ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
