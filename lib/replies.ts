import 'server-only'
import { createAdminClient } from './supabase/server'
import { debtPayoff, getDebtMonth, getMonthSummary, requiredMonthly } from './finance'
import { money, monthLabel } from './format'
import { getAccess } from './plans'
import { loadContext } from './ledger'
import type { Family } from './types'

/** Respuestas de los comandos en HTML de Telegram (WhatsApp las convierte con htmlToWa). */

const db = createAdminClient()
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function bar(ratio: number) {
  const filled = Math.min(10, Math.max(0, Math.round(ratio * 10)))
  return '▓'.repeat(filled) + '░'.repeat(10 - filled)
}

/** Cómo va el mes. `pendingHint` es el texto para ver pendientes en cada canal. */
export async function summaryHtml(fam: Family, pendingHint = '/pendientes') {
  const s = await getMonthSummary(db, fam.id)
  return [
    `<b>📊 Resumen ${monthLabel(s.month)}</b>`,
    `Ingresos: <b>${money(s.income)}</b>`,
    `Gastos: <b>${money(s.expenses)}</b>${s.totalBudget > 0 ? ` de ${money(s.totalBudget)} presupuestado` : ''}`,
    s.debtPayments ? `Abonos a deudas: ${money(s.debtPayments)}` : null,
    s.savings ? `Ahorro: ${money(s.savings)}` : null,
    `Disponible: <b>${money(s.net)}</b>`,
    `Proyección de gasto al cierre: ${money(s.projectedExpenses)}`,
    '',
    ...s.byCategory
      .filter((c) => c.spent > 0 || c.budget > 0)
      .slice(0, 12)
      .map((c) =>
        c.budget > 0
          ? `${c.category.icon} ${c.category.name}\n${bar(c.spent / c.budget)} ${money(c.spent)} / ${money(c.budget)}${c.spent > c.budget ? ' 🚨' : ''}`
          : `${c.category.icon} ${c.category.name}: ${money(c.spent)} (sin presupuesto)`,
      ),
    s.uncategorized ? `❔ Sin categoría: ${money(s.uncategorized)}` : null,
    s.pendingCount ? `\n🕓 Hay ${s.pendingCount} movimiento(s) por confirmar → ${pendingHint}` : null,
  ]
    .filter((l) => l !== null)
    .join('\n')
}

export async function goalsHtml(fam: Family) {
  const { goals } = await loadContext(fam.id)
  if (!goals.length) return `No hay metas de ahorro. Creen una en el panel: ${APP_URL}/ahorros`
  return goals
    .map((g) => {
      const pct = Number(g.target_amount) > 0 ? Number(g.current_amount) / Number(g.target_amount) : 0
      const need = requiredMonthly(g)
      return [
        `🐷 <b>${escapeHtml(g.name)}</b>`,
        `${bar(pct)} ${Math.round(pct * 100)}% · ${money(g.current_amount)} de ${money(g.target_amount)}`,
        need ? `   Para llegar a tiempo: ${money(need)}/mes` : null,
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')
}

export async function planHtml(fam: Family) {
  const a = await getAccess(db, fam)
  const status = a.active
    ? `${a.plan.id === 'trial' ? 'Prueba gratis' : `Activo hasta el ${a.until.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}`} · quedan ${a.daysLeft} día(s)`
    : '⛔ Vencido: los recibos no se están leyendo'
  return [`<b>Plan ${a.plan.name}</b>`, status, `Lecturas con IA este mes: ${a.used} de ${a.plan.aiLimit}`, '', `Pagar o cambiar de plan: ${APP_URL}/plan`].join('\n')
}

/** Deudas: saldo, cuota del mes (pagada o pendiente) y fecha estimada de pago. */
export async function debtsHtml(fam: Family) {
  const lines = await getDebtMonth(db, fam.id)
  if (!lines.length) return `No hay deudas registradas. Agréguenlas en el panel: ${APP_URL}/deudas`
  const total = lines.reduce((s, l) => s + Number(l.debt.balance), 0)
  const dueTotal = lines.reduce((s, l) => s + l.due, 0)
  return [
    `<b>💳 Deudas — saldo total ${money(total)}</b>`,
    dueTotal > 0 ? `Cuotas pendientes este mes: <b>${money(dueTotal)}</b>` : '✅ Todas las cuotas del mes están pagadas',
    '',
    ...lines.map(({ debt: d, paid, due }) => {
      const plan = debtPayoff(Number(d.balance), Number(d.annual_rate), Number(d.monthly_payment))
      const eta =
        plan.months === null
          ? '⚠️ la cuota no cubre los intereses'
          : plan.months === 0
            ? '🎉 pagada'
            : `termina ≈ ${monthLabel(plan.payoffDate!)}`
      const month = Number(d.monthly_payment) > 0 ? (due > 0 ? `faltan ${money(due)} de la cuota${paid > 0 ? ` (abonado ${money(paid)})` : ''}` : 'cuota del mes pagada ✓') : ''
      return `💳 <b>${escapeHtml(d.name)}</b>: saldo ${money(d.balance)}\n   ${[month, d.due_day ? `paga el ${d.due_day}` : '', eta].filter(Boolean).join(' · ')}`
    }),
  ].join('\n')
}
