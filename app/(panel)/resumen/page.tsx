import Link from 'next/link'
import { requireFamily } from '@/lib/session'
import { getHistory, getMonthSummary, projectAhead } from '@/lib/finance'
import { dateLabel, money, monthLabel } from '@/lib/format'
import { KIND_LABEL, type Transaction } from '@/lib/types'
import { Card, Empty, Progress, Stat } from '@/components/cards'
import { TrendChart } from '@/components/trend-chart'
import { CategoryChart } from '@/components/category-chart'
import { FEATURES } from '@/lib/features'

export default async function ResumenPage() {
  const { supabase, family } = await requireFamily()
  const [summary, history, { data: recent }, { data: debts }, { data: goals }] = await Promise.all([
    getMonthSummary(supabase, family.id),
    getHistory(supabase, family.id, 6),
    supabase
      .from('transactions')
      .select('*, categories(name, icon), family_members(display_name)')
      .eq('family_id', family.id)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase.from('debts').select('balance').eq('family_id', family.id).eq('active', true),
    supabase.from('savings_goals').select('current_amount, target_amount').eq('family_id', family.id).eq('active', true),
  ])
  const ahead = projectAhead(history, summary, 3)
  const chart = [
    ...history.map((p, i) => ({
      label: monthLabel(p.month),
      income: p.income,
      expenses: i === history.length - 1 ? summary.projectedExpenses : p.expenses,
      projected: false,
    })),
    ...ahead.map((p) => ({ label: monthLabel(p.month), income: p.income, expenses: p.expenses, projected: true })),
  ]
  const totalDebt = (debts ?? []).reduce((s, d) => s + Number(d.balance), 0)
  const saved = (goals ?? []).reduce((s, g) => s + Number(g.current_amount), 0)
  const slices = summary.byCategory
    .filter((c) => c.spent > 0)
    .map((c) => ({ name: `${c.category.icon} ${c.category.name}`, value: c.spent }))
  if (summary.uncategorized > 0) slices.push({ name: '❔ Sin categoría', value: summary.uncategorized })
  const budgetUse = summary.totalBudget > 0 ? summary.expenses / summary.totalBudget : null

  return (
    <div className="space-y-4">
      {!family.telegram_chat_id && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Falta conectar el chat de Telegram.{' '}
          <Link href="/familia" className="font-medium underline">
            Ver cómo hacerlo
          </Link>
        </div>
      )}
      {summary.pendingCount > 0 && (
        <Link href="/movimientos?estado=pending" className="block rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          🕓 Hay {summary.pendingCount} movimiento(s) por confirmar →
        </Link>
      )}

      {summary.byCategory
        .filter((c) => c.budget > 0 && c.spent / c.budget >= (family.alert_threshold ?? 80) / 100)
        .map((c) => (
          <Link
            key={c.category.id}
            href="/presupuesto"
            className={`block rounded-2xl border p-4 text-sm ${c.remaining < 0 ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
          >
            {c.remaining < 0 ? '🚨' : '⚠️'} <b>{c.category.icon} {c.category.name}</b>: van en {Math.round((c.spent / c.budget) * 100)} % del presupuesto ·{' '}
            {c.remaining >= 0 ? `quedan ${money(c.remaining)}` : `se pasaron por ${money(-c.remaining)}`}
          </Link>
        ))}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={`Ingresos ${monthLabel(summary.month)}`} value={money(summary.income)} tone="good" />
        <Stat
          label="Gastos del mes"
          value={money(summary.expenses)}
          hint={`${budgetUse !== null ? `${Math.round(budgetUse * 100)}% del presupuesto · ` : ''}al cierre ≈ ${money(summary.projectedExpenses)}`}
          tone={(budgetUse !== null && budgetUse > 1) || (summary.totalBudget > 0 && summary.projectedExpenses > summary.totalBudget) ? 'bad' : 'default'}
        />
        <Stat label="Balance" value={money(summary.net)} hint="Ingresos − gastos − ahorro del mes" tone={summary.net < 0 ? 'bad' : 'good'} />
        <Stat label="Ahorro acumulado" value={money(saved)} hint={`${(goals ?? []).length} meta(s) activa(s)`} tone="good" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Ingresos y gastos" className="lg:col-span-2">
          <TrendChart data={chart} />
        </Card>
        <Card title="Próximos meses">
          <ul className="space-y-3 text-sm">
            {ahead.map((p) => (
              <li key={p.month} className="flex items-center justify-between">
                <span className="capitalize text-slate-600">{monthLabel(p.month)}</span>
                <span className={`font-medium tabular-nums ${p.net < 0 ? 'text-rose-600' : 'text-brand-700'}`}>
                  {p.net >= 0 ? '+' : ''}
                  {money(p.net)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
            {FEATURES.debts && (
              <Link href="/deudas" className="rounded-xl bg-slate-50 p-3 hover:bg-slate-100">
                <p className="text-xs text-slate-500">💳 Deudas</p>
                <p className="font-semibold tabular-nums">{money(totalDebt)}</p>
              </Link>
            )}
            <Link href="/ahorros" className="rounded-xl bg-slate-50 p-3 hover:bg-slate-100">
              <p className="text-xs text-slate-500">🐷 Ahorrado</p>
              <p className="font-semibold tabular-nums">{money(saved)}</p>
            </Link>
          </div>
        </Card>
      </div>

      <Card title={`Gastos por categoría · ${monthLabel(summary.month)}`}>
        {slices.length ? (
          <CategoryChart data={slices} total={summary.expenses} />
        ) : (
          <Empty>Aún no hay gastos este mes. Envíen un recibo al chat de Telegram.</Empty>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Presupuesto por categoría" action={<Link href="/presupuesto" className="text-sm text-brand-700">Editar</Link>}>
          {summary.byCategory.some((c) => c.spent > 0 || c.budget > 0) ? (
            <ul className="space-y-3">
              {summary.byCategory
                .filter((c) => c.spent > 0 || c.budget > 0)
                .map((c) => (
                  <li key={c.category.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>
                        {c.category.icon} {c.category.name}
                      </span>
                      <span className="tabular-nums text-slate-600">
                        {money(c.spent)}
                        {c.budget > 0 && <span className="text-slate-500"> / {money(c.budget)}</span>}
                      </span>
                    </div>
                    <Progress value={c.spent} max={c.budget} projected={c.projected} />
                    {c.budget > 0 && (
                      <p className={`mt-0.5 text-right text-xs tabular-nums ${c.remaining < 0 ? 'text-rose-700' : 'text-slate-600'}`}>
                        {c.remaining >= 0 ? `Quedan ${money(c.remaining)}` : `Se pasaron por ${money(-c.remaining)}`}
                      </p>
                    )}
                  </li>
                ))}
            </ul>
          ) : (
            <Empty>Aún no hay gastos este mes. Envíen un recibo al chat de Telegram.</Empty>
          )}
        </Card>

        <Card title="Últimos movimientos" action={<Link href="/movimientos" className="text-sm text-brand-700">Ver todos</Link>}>
          {recent?.length ? (
            <ul className="divide-y divide-slate-100">
              {(recent as (Transaction & { categories: { name: string; icon: string } | null; family_members: { display_name: string } | null })[]).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {t.categories?.icon ?? (t.kind === 'debt_payment' ? '💳' : t.kind === 'saving' ? '🐷' : '•')}{' '}
                      {t.merchant || t.description || KIND_LABEL[t.kind]}
                      {t.status === 'pending' && <span className="ml-2 rounded bg-sky-100 px-1.5 text-xs text-sky-800">pendiente</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {dateLabel(t.occurred_on)} · {t.family_members?.display_name ?? '—'}
                    </p>
                  </div>
                  <span className={`whitespace-nowrap font-medium tabular-nums ${t.kind === 'income' ? 'text-brand-700' : ''}`}>
                    {t.kind === 'income' ? '+' : '−'}
                    {money(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Sin movimientos todavía.</Empty>
          )}
        </Card>
      </div>
    </div>
  )
}
