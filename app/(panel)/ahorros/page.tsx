import { requireFamily } from '@/lib/session'
import { requiredMonthly, savingsEta } from '@/lib/finance'
import { money, monthLabel, monthStart } from '@/lib/format'
import type { SavingsGoal } from '@/lib/types'
import { archiveGoal, quickMovement, saveGoal } from '@/app/actions'
import { Card, Empty, Progress, Stat } from '@/components/cards'
import { ConfirmButton, SubmitButton } from '@/components/ui'

export default async function AhorrosPage() {
  const { supabase, family, isAdmin } = await requireFamily()
  const [{ data }, { data: contributions }] = await Promise.all([
    supabase.from('savings_goals').select('*').eq('family_id', family.id).eq('active', true).order('created_at'),
    supabase
      .from('transactions')
      .select('savings_goal_id, amount')
      .eq('family_id', family.id)
      .eq('kind', 'saving')
      .eq('status', 'confirmed')
      .gte('occurred_on', monthStart(-3))
      .lt('occurred_on', monthStart(0)),
  ])
  const goals = (data ?? []) as SavingsGoal[]
  const saved = goals.reduce((s, g) => s + Number(g.current_amount), 0)
  const target = goals.reduce((s, g) => s + Number(g.target_amount), 0)
  // Aporte promedio de los últimos 3 meses cerrados, por meta
  const avgFor = (id: string) =>
    (contributions ?? []).filter((c) => c.savings_goal_id === id).reduce((s, c) => s + Number(c.amount), 0) / 3

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Total ahorrado" value={money(saved)} tone="good" />
        <Stat label="Meta total" value={money(target)} />
        <Stat label="Avance" value={target > 0 ? `${Math.round((saved / target) * 100)}%` : '—'} />
      </div>

      {goals.length === 0 ? (
        <Empty>{isAdmin ? 'Creen su primera meta: fondo de emergencia, vacaciones, matrícula…' : 'El administrador aún no ha creado metas de ahorro.'}</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const need = requiredMonthly(g)
            const avg = avgFor(g.id)
            const eta = savingsEta(g, avg)
            return (
              <Card key={g.id} title={`🐷 ${g.name}`} action={g.target_date && <span className="text-xs text-slate-500">para {monthLabel(g.target_date)}</span>}>
                <p className="text-2xl font-semibold tabular-nums">
                  {money(g.current_amount)} <span className="text-base font-normal text-slate-500">/ {money(g.target_amount)}</span>
                </p>
                <div className="mt-2">
                  <Progress value={Number(g.current_amount)} max={Number(g.target_amount)} />
                </div>
                <ul className="mt-3 space-y-1 text-sm text-slate-600">
                  {need !== null && need > 0 && <li>Para llegar a tiempo: <b>{money(need)}</b> al mes</li>}
                  {avg > 0 && <li>Vienen aportando ≈ {money(avg)} al mes</li>}
                  {eta !== null && eta > 0 && <li>A ese ritmo la alcanzan en {eta} meses ({monthLabel(monthStart(eta))})</li>}
                  {eta === 0 && <li>🎉 ¡Meta cumplida!</li>}
                </ul>
                <form action={quickMovement} className="mt-4 flex gap-2">
                  <input type="hidden" name="kind" value="saving" />
                  <input type="hidden" name="target_id" value={g.id} />
                  <input name="amount" aria-label="Aporte" placeholder="Aporte" inputMode="decimal" required className="input" />
                  <SubmitButton>Aportar</SubmitButton>
                </form>
                {isAdmin && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-slate-500">Editar</summary>
                  <form action={saveGoal} className="mt-3 grid gap-3 sm:grid-cols-3">
                    <input type="hidden" name="id" value={g.id} />
                    <input name="name" aria-label="Nombre de la meta" defaultValue={g.name} required className="input" />
                    <input name="target_amount" aria-label="Monto objetivo" defaultValue={Number(g.target_amount).toLocaleString('es-CO')} inputMode="decimal" className="input" />
                    <input name="target_date" aria-label="Fecha objetivo" type="date" defaultValue={g.target_date ?? ''} className="input" />
                    <div className="flex justify-between sm:col-span-3">
                      <SubmitButton>Guardar</SubmitButton>
                      <ConfirmButton message="¿Archivar esta meta?" formAction={archiveGoal}>
                        Archivar
                      </ConfirmButton>
                    </div>
                  </form>
                </details>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {isAdmin && (
      <Card title="Nueva meta de ahorro">
        <form action={saveGoal} className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Nombre</label>
            <input aria-label="Nombre" name="name" placeholder="Fondo de emergencia" required className="input" />
          </div>
          <div>
            <label className="label">Meta (COP)</label>
            <input aria-label="Meta (COP)" name="target_amount" inputMode="decimal" required className="input" />
          </div>
          <div>
            <label className="label">Ya tienen ahorrado</label>
            <input aria-label="Ya tienen ahorrado" name="current_amount" inputMode="decimal" placeholder="0" className="input" />
          </div>
          <div>
            <label className="label">Fecha objetivo</label>
            <input aria-label="Fecha objetivo" name="target_date" type="date" className="input" />
          </div>
          <div className="sm:col-span-4">
            <SubmitButton>Crear meta</SubmitButton>
          </div>
        </form>
      </Card>
      )}
    </div>
  )
}
