import type { SupabaseClient } from '@supabase/supabase-js'
import type { Category, Debt, SavingsGoal, Transaction } from './types'
import { daysInMonth, monthStart, todayISO } from './format'

// ---------------------------------------------------------------------
// Cálculos puros
// ---------------------------------------------------------------------

/** Tasa mensual equivalente a partir de una efectiva anual (E.A.). */
export function monthlyRate(annualEffective: number): number {
  return Math.pow(1 + annualEffective, 1 / 12) - 1
}

export interface PayoffPlan {
  months: number | null // null = la cuota no alcanza a cubrir los intereses
  totalInterest: number
  payoffDate: string | null
}

/** Simula mes a mes cuánto tarda en pagarse una deuda con una cuota fija. */
export function debtPayoff(balance: number, annualRate: number, payment: number): PayoffPlan {
  if (balance <= 0) return { months: 0, totalInterest: 0, payoffDate: todayISO() }
  const r = monthlyRate(annualRate)
  if (payment <= balance * r || payment <= 0) return { months: null, totalInterest: 0, payoffDate: null }
  let b = balance
  let interest = 0
  let months = 0
  while (b > 0.5 && months < 600) {
    const i = b * r
    interest += i
    b = b + i - payment
    months++
  }
  return { months, totalInterest: Math.round(interest), payoffDate: monthStart(months) }
}

export interface DebtStrategyStep {
  debtId: string
  name: string
  payoffMonth: number
}

/**
 * Plan de pago de varias deudas con un presupuesto mensual total.
 * avalanche = primero la de mayor tasa (ahorra más intereses)
 * snowball  = primero la de menor saldo (motiva más)
 */
export function multiDebtPlan(
  debts: Debt[],
  monthlyBudget: number,
  strategy: 'avalanche' | 'snowball',
): { steps: DebtStrategyStep[]; months: number | null; totalInterest: number } {
  const list = debts
    .filter((d) => d.active && Number(d.balance) > 0)
    .map((d) => ({ ...d, b: Number(d.balance), r: monthlyRate(Number(d.annual_rate)), min: Number(d.monthly_payment) }))
  const minSum = list.reduce((s, d) => s + d.min, 0)
  if (list.length === 0) return { steps: [], months: 0, totalInterest: 0 }
  if (monthlyBudget < minSum) return { steps: [], months: null, totalInterest: 0 }

  const order = [...list].sort((a, b) => (strategy === 'avalanche' ? b.r - a.r : a.b - b.b))
  const steps: DebtStrategyStep[] = []
  let totalInterest = 0
  let month = 0
  while (order.some((d) => d.b > 0.5) && month < 600) {
    month++
    let available = monthlyBudget
    for (const d of order) {
      if (d.b <= 0.5) continue
      const i = d.b * d.r
      totalInterest += i
      d.b += i
    }
    for (const d of order) {
      if (d.b <= 0.5) continue
      const pay = Math.min(d.min, d.b, available)
      d.b -= pay
      available -= pay
    }
    for (const d of order) {
      if (d.b <= 0.5 || available <= 0) continue
      const pay = Math.min(d.b, available)
      d.b -= pay
      available -= pay
    }
    for (const d of order) {
      if (d.b <= 0.5 && !steps.some((s) => s.debtId === d.id)) {
        steps.push({ debtId: d.id, name: d.name, payoffMonth: month })
      }
    }
    if (month > 1 && available === monthlyBudget) break
  }
  const done = order.every((d) => d.b <= 0.5)
  return { steps, months: done ? month : null, totalInterest: Math.round(totalInterest) }
}

/** Meses para alcanzar una meta con un aporte mensual. */
export function savingsEta(goal: SavingsGoal, monthlyContribution: number): number | null {
  const missing = Number(goal.target_amount) - Number(goal.current_amount)
  if (missing <= 0) return 0
  if (monthlyContribution <= 0) return null
  return Math.ceil(missing / monthlyContribution)
}

/** Aporte mensual necesario para llegar a la meta en la fecha objetivo. */
export function requiredMonthly(goal: SavingsGoal): number | null {
  if (!goal.target_date) return null
  const missing = Number(goal.target_amount) - Number(goal.current_amount)
  if (missing <= 0) return 0
  const [ty, tm] = goal.target_date.split('-').map(Number)
  const [cy, cm] = todayISO().split('-').map(Number)
  const months = Math.max((ty - cy) * 12 + (tm - cm), 1)
  return Math.ceil(missing / months)
}

// ---------------------------------------------------------------------
// Consultas compartidas entre el bot y el panel web
// ---------------------------------------------------------------------

export interface CategoryLine {
  category: Category
  /** Gastado (movimientos confirmados) */
  spent: number
  budget: number
  projected: number
  /** Lo que queda del presupuesto (negativo si se pasaron) */
  remaining: number
  /** Gastos por confirmar en esta categoría (aún no descuentan del presupuesto) */
  pending: number
}

export interface MonthSummary {
  month: string
  income: number
  expenses: number
  debtPayments: number
  savings: number
  net: number
  projectedExpenses: number
  totalBudget: number
  byCategory: CategoryLine[]
  uncategorized: number
  pendingCount: number
}

export async function getMonthSummary(
  db: SupabaseClient,
  familyId: string,
  month = monthStart(0),
): Promise<MonthSummary> {
  const next = shiftMonth(month, 1)
  const [{ data: txs }, { data: cats }, { count: pendingCount }] = await Promise.all([
    db
      .from('transactions')
      .select('kind, amount, category_id, status')
      .eq('family_id', familyId)
      .gte('occurred_on', month)
      .lt('occurred_on', next),
    db.from('categories').select('*').eq('family_id', familyId).order('name'),
    db
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', familyId)
      .eq('status', 'pending'),
  ])

  const all = (txs ?? []) as Pick<Transaction, 'kind' | 'amount' | 'category_id' | 'status'>[]
  const rows = all.filter((t) => t.status === 'confirmed')
  const pendingRows = all.filter((t) => t.status === 'pending')
  const sum = (k: string) => rows.filter((t) => t.kind === k).reduce((s, t) => s + Number(t.amount), 0)

  // Factor de proyección: solo aplica al mes en curso
  const today = todayISO()
  const isCurrent = today.slice(0, 7) === month.slice(0, 7)
  const factor = isCurrent ? daysInMonth(month) / Number(today.slice(8, 10)) : 1

  const categories = (cats ?? []) as Category[]
  const byCategory = categories
    .filter((c) => c.kind === 'expense')
    .map((category) => {
      const spent = rows
        .filter((t) => t.kind === 'expense' && t.category_id === category.id)
        .reduce((s, t) => s + Number(t.amount), 0)
      const budget = Number(category.monthly_budget)
      const pending = pendingRows
        .filter((t) => t.kind === 'expense' && t.category_id === category.id)
        .reduce((s, t) => s + Number(t.amount), 0)
      return { category, spent, budget, projected: Math.round(spent * factor), remaining: budget - spent, pending }
    })
    .sort((a, b) => b.spent - a.spent)

  const expenses = sum('expense')
  const income = sum('income')
  const debtPayments = sum('debt_payment')
  const savings = sum('saving')
  return {
    month,
    income,
    expenses,
    debtPayments,
    savings,
    net: income - expenses - debtPayments - savings,
    projectedExpenses: Math.round(expenses * factor),
    totalBudget: byCategory.reduce((s, c) => s + c.budget, 0),
    byCategory,
    uncategorized: rows
      .filter((t) => t.kind === 'expense' && !t.category_id)
      .reduce((s, t) => s + Number(t.amount), 0),
    pendingCount: pendingCount ?? 0,
  }
}

export interface MonthPoint {
  month: string
  income: number
  expenses: number
  debtPayments: number
  savings: number
}

/** Totales de los últimos `n` meses (incluido el actual). */
export async function getHistory(db: SupabaseClient, familyId: string, n = 6): Promise<MonthPoint[]> {
  const from = monthStart(-(n - 1))
  const { data } = await db
    .from('transactions')
    .select('kind, amount, occurred_on')
    .eq('family_id', familyId)
    .eq('status', 'confirmed')
    .gte('occurred_on', from)
  const points: MonthPoint[] = Array.from({ length: n }, (_, i) => ({
    month: monthStart(-(n - 1) + i),
    income: 0,
    expenses: 0,
    debtPayments: 0,
    savings: 0,
  }))
  const key = { expense: 'expenses', income: 'income', debt_payment: 'debtPayments', saving: 'savings' } as const
  for (const t of (data ?? []) as Pick<Transaction, 'kind' | 'amount' | 'occurred_on'>[]) {
    const p = points.find((x) => x.month.slice(0, 7) === t.occurred_on.slice(0, 7))
    if (p) p[key[t.kind]] += Number(t.amount)
  }
  return points
}

/**
 * Proyección de los próximos meses usando el promedio de los meses cerrados
 * (sin el actual). Si no hay historia, usa el mes en curso proyectado.
 */
export function projectAhead(history: MonthPoint[], current: MonthSummary, months = 3) {
  const closed = history.slice(0, -1).filter((p) => p.income + p.expenses > 0)
  const avg = (f: (p: MonthPoint) => number) =>
    closed.length ? closed.reduce((s, p) => s + f(p), 0) / closed.length : null
  const income = avg((p) => p.income) ?? current.income
  const expenses = avg((p) => p.expenses) ?? current.projectedExpenses
  const debt = avg((p) => p.debtPayments) ?? current.debtPayments
  const saving = avg((p) => p.savings) ?? current.savings
  return Array.from({ length: months }, (_, i) => ({
    month: monthStart(i + 1),
    income: Math.round(income),
    expenses: Math.round(expenses),
    debtPayments: Math.round(debt),
    savings: Math.round(saving),
    net: Math.round(income - expenses - debt - saving),
  }))
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 10)
}
