import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getMonthSummary, shiftMonth } from './finance'
import { money } from './format'
import { KIND_LABEL, type Family, type TxKind } from './types'

const MONTH_LONG = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)))
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

interface TxRow {
  occurred_on: string
  kind: TxKind
  amount: number
  merchant: string | null
  description: string | null
  payment_method: string | null
  status: string
  source: string
  categories: { name: string } | null
  family_members: { display_name: string } | null
}

/** Movimientos de la familia entre dos fechas (from incluida, to excluida), más recientes primero. */
export async function listTransactions(db: SupabaseClient, familyId: string, from?: string, to?: string) {
  let q = db
    .from('transactions')
    .select('occurred_on, kind, amount, merchant, description, payment_method, status, source, categories(name), family_members(display_name)')
    .eq('family_id', familyId)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
  if (from) q = q.gte('occurred_on', from)
  if (to) q = q.lt('occurred_on', to)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as TxRow[]
}

/**
 * CSV para abrir directo en Excel en español: separador ";" y BOM UTF-8 (para las tildes).
 * Los montos van sin separador de miles para que Excel los tome como números.
 */
export function transactionsCsv(rows: TxRow[]): Buffer {
  const cell = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? '' : String(v)
    // Evita que Excel ejecute como fórmula un texto que empiece por = + - @ (inyección de fórmulas)
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = ['Fecha', 'Tipo', 'Monto', 'Categoría', 'Comercio', 'Descripción', 'Quién', 'Medio de pago', 'Estado', 'Origen']
  const SOURCE: Record<string, string> = {
    telegram_photo: 'Foto / PDF',
    whatsapp_photo: 'Foto / PDF (WhatsApp)',
    whatsapp_text: 'Mensaje (WhatsApp)',
    whatsapp_audio: 'Nota de voz (WhatsApp)',
    telegram_text: 'Mensaje',
    telegram_audio: 'Nota de voz',
    web: 'Panel web',
  }
  const lines = rows.map((r) =>
    [
      r.occurred_on,
      KIND_LABEL[r.kind],
      Math.round(Number(r.amount)),
      r.categories?.name ?? '',
      r.merchant,
      r.description,
      r.family_members?.display_name ?? '',
      r.payment_method,
      r.status === 'pending' ? 'Por confirmar' : 'Confirmado',
      SOURCE[r.source] ?? r.source,
    ]
      .map(cell)
      .join(';'),
  )
  return Buffer.from('﻿' + [header.join(';'), ...lines].join('\r\n'), 'utf8')
}

/** Resumen de un mes para enviar al chat (HTML de Telegram) y su CSV. null si no hubo movimientos. */
export async function monthlyReport(db: SupabaseClient, family: Family, month: string, appUrl: string) {
  const next = shiftMonth(month, 1)
  const [s, prev, rows] = await Promise.all([
    getMonthSummary(db, family.id, month),
    getMonthSummary(db, family.id, shiftMonth(month, -1)),
    listTransactions(db, family.id, month, next),
  ])
  if (!rows.length) return null

  const confirmed = rows.filter((r) => r.status !== 'pending')
  const merchants = new Map<string, number>()
  for (const r of confirmed) {
    if (r.kind !== 'expense' || !r.merchant) continue
    merchants.set(r.merchant, (merchants.get(r.merchant) ?? 0) + Number(r.amount))
  }
  const topMerchants = [...merchants.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const cats = s.byCategory.filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent)
  const over = s.byCategory.filter((c) => c.budget > 0 && c.spent > c.budget)
  const change = prev.expenses > 0 ? Math.round(((s.expenses - prev.expenses) / prev.expenses) * 100) : null
  const label = MONTH_LONG(month)

  const lines = [
    `<b>📅 Resumen de ${label}</b> · ${esc(family.name)}`,
    '',
    `💰 Ingresos: <b>${money(s.income)}</b>`,
    `🛒 Gastos: <b>${money(s.expenses)}</b>${
      change === null ? '' : ` (${change > 0 ? '▲' : change < 0 ? '▼' : '='} ${Math.abs(change)}% vs. el mes anterior)`
    }`,
    s.totalBudget > 0 ? `🎯 Presupuesto: ${money(s.totalBudget)} · usado ${Math.round((s.expenses / s.totalBudget) * 100)}%` : null,
    s.debtPayments ? `💳 Abonos a deudas: ${money(s.debtPayments)}` : null,
    s.savings ? `🐷 Ahorro: ${money(s.savings)}` : null,
    `${s.net >= 0 ? '✅' : '⚠️'} Balance: <b>${money(s.net)}</b>`,
    '',
    cats.length ? '<b>En qué se fue la plata</b>' : null,
    ...cats.slice(0, 6).map((c) => {
      const pct = s.expenses > 0 ? Math.round((c.spent / s.expenses) * 100) : 0
      const budget = c.budget > 0 ? ` de ${money(c.budget)}${c.spent > c.budget ? ' 🚨' : ''}` : ''
      return `${c.category.icon} ${esc(c.category.name)}: ${money(c.spent)}${budget} · ${pct}%`
    }),
    s.uncategorized ? `❔ Sin categoría: ${money(s.uncategorized)}` : null,
    topMerchants.length ? `\n<b>Donde más gastaron</b>\n${topMerchants.map(([m, v]) => `🏪 ${esc(m)}: ${money(v)}`).join('\n')}` : null,
    over.length ? `\n🚨 Se pasaron del presupuesto en: ${over.map((c) => esc(c.category.name)).join(', ')}.` : null,
    s.pendingCount ? `\n🕓 Quedan ${s.pendingCount} movimiento(s) por confirmar: /pendientes` : null,
    '',
    `📎 En el archivo van los ${rows.length} movimientos del mes (se abre con Excel o Google Sheets).`,
    appUrl ? `📊 Más detalle en el panel: ${appUrl}/resumen` : null,
  ]
  return {
    text: lines.filter((l) => l !== null).join('\n'),
    csv: transactionsCsv(rows),
    filename: `luka-${month.slice(0, 7)}.csv`,
  }
}
