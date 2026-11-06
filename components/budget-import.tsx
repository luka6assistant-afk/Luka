'use client'

import { useActionState, useState } from 'react'
import { applyBudgetImport, previewBudgetImport, type ImportState } from '@/app/actions'
import { Card } from './cards'
import { SubmitButton } from './ui'

type Row = { include: boolean; name: string; kind: string; icon: string; amount: number; target: string; note: string | null; balance: number | null; rate: number | null }

const fmt = (n: number) => new Intl.NumberFormat('es-CO').format(n)

/** Importar el presupuesto desde Excel: subir → revisar → aplicar. */
export function BudgetImport() {
  const [preview, previewAction] = useActionState<ImportState, FormData>(previewBudgetImport, undefined)
  return (
    <Card title="📥 Importar desde Excel">
      {preview && 'items' in preview ? (
        <ImportReview key={preview.file} preview={preview} />
      ) : (
        <form action={previewAction} className="space-y-3 text-sm">
          <p className="text-slate-700">
            Sube tu presupuesto en Excel (.xlsx) o .csv, como lo tengas organizado. Luka identifica las categorías, los ingresos y cada
            deuda por separado, y te muestra todo para revisarlo antes de guardar.
          </p>
          <label htmlFor="budget-file" className="label">
            Archivo
          </label>
          <input id="budget-file" name="file" type="file" required accept=".xlsx,.csv" className="input py-1.5 file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:px-2 file:py-1 file:text-brand-700" />
          <p className="text-xs text-slate-600">
            Máximo 2 MB. Si es de Google Sheets: Archivo → Descargar → Microsoft Excel (.xlsx). ¿No tienes un presupuesto en Excel?{' '}
            <a href="/plantilla-presupuesto-familiar-luka.xlsx" download className="font-medium text-brand-700 underline">
              Descarga nuestra plantilla
            </a>
            .
          </p>
          {preview && 'error' in preview && <p className="text-rose-700">{preview.error}</p>}
          <SubmitButton className="btn w-full">Leer archivo</SubmitButton>
        </form>
      )}
    </Card>
  )
}

function ImportReview({ preview }: { preview: Extract<ImportState, { items: unknown }> }) {
  const [rows, setRows] = useState<Row[]>(() =>
    preview.items.map((it) => ({
      include: it.monthly_amount > 0,
      name: it.name,
      kind: it.kind,
      icon: it.icon,
      amount: it.monthly_amount,
      target: it.target,
      note: it.note,
      balance: it.balance ?? null,
      rate: it.annual_rate_pct ?? null,
    })),
  )
  const [result, applyAction] = useActionState<ImportState, FormData>(applyBudgetImport, undefined)
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const total = rows.filter((r) => r.include && r.kind === 'expense').reduce((s, r) => s + r.amount, 0)
  const debtTotal = rows.filter((r) => r.include && r.kind === 'debt').reduce((s, r) => s + r.amount, 0)

  if (result && 'ok' in result)
    return (
      <div className="space-y-3 text-sm">
        <p className="rounded-lg bg-brand-50 p-3 text-brand-700">✅ {result.ok}</p>
        <a href="/presupuesto" className="btn-ghost">
          Ver el presupuesto
        </a>
      </div>
    )

  return (
    <form action={applyAction} className="space-y-3 text-sm">
      <p className="text-slate-700">
        Esto encontré en <b>{preview.file}</b>. Revisa, corrige lo que haga falta y toca <b>Aplicar</b>. Los montos son mensuales.
      </p>
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={i} className={`rounded-lg border p-3 ${r.include ? 'border-slate-200' : 'border-dashed border-slate-200 opacity-60'}`}>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={r.include}
                onChange={(e) => set(i, { include: e.target.checked })}
                aria-label={`Incluir ${r.name}`}
                className="h-4 w-4 accent-brand-600"
              />
              <span aria-hidden>{r.icon}</span>
              <input
                value={r.name}
                onChange={(e) => set(i, { name: e.target.value })}
                aria-label="Nombre de la categoría"
                className="input flex-1 py-1"
              />
              <input
                value={fmt(r.amount)}
                onChange={(e) => set(i, { amount: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                inputMode="numeric"
                aria-label={`Monto mensual de ${r.name}`}
                className="input w-28 py-1 text-right tabular-nums"
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
              <select
                value={r.kind}
                onChange={(e) => set(i, { kind: e.target.value, target: 'new' })}
                aria-label={`Tipo de ${r.name}`}
                className="input w-auto py-1 text-xs"
              >
                <option value="expense">Gasto</option>
                <option value="income">Ingreso</option>
                <option value="debt">Deuda</option>
              </select>
              <select value={r.target} onChange={(e) => set(i, { target: e.target.value })} aria-label={`Destino de ${r.name}`} className="input w-auto py-1 text-xs">
                <option value="new">{r.kind === 'debt' ? '➕ Crear deuda nueva' : '➕ Crear categoría nueva'}</option>
                {r.kind === 'debt'
                  ? preview.debts.map((d) => (
                      <option key={d.id} value={d.id}>
                        Actualizar 💳 {d.name}
                      </option>
                    ))
                  : preview.existing
                      .filter((c) => c.kind === r.kind)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          Actualizar {c.icon} {c.name}
                        </option>
                      ))}
              </select>
              {r.kind === 'debt' && (
                <>
                  <input
                    value={r.balance ? fmt(r.balance) : ''}
                    onChange={(e) => set(i, { balance: Number(e.target.value.replace(/\D/g, '')) || null })}
                    placeholder="Saldo"
                    inputMode="numeric"
                    aria-label={`Saldo de ${r.name}`}
                    className="input w-28 py-1 text-right text-xs tabular-nums"
                  />
                  <input
                    value={r.rate ?? ''}
                    onChange={(e) => set(i, { rate: Number(e.target.value.replace(',', '.')) || null })}
                    placeholder="Tasa E.A. %"
                    inputMode="decimal"
                    aria-label={`Tasa de ${r.name}`}
                    className="input w-24 py-1 text-right text-xs tabular-nums"
                  />
                </>
              )}
              {r.note && <span className="text-xs text-slate-600">ℹ️ {r.note}</span>}
            </div>
          </li>
        ))}
      </ul>
      <input type="hidden" name="rows" value={JSON.stringify(rows)} />
      <p className="text-slate-700">
        Gastos seleccionados: <b className="tabular-nums">${fmt(total)}</b> al mes
        {debtTotal > 0 && (
          <>
            {' '}· cuotas de deudas: <b className="tabular-nums">${fmt(debtTotal)}</b>
          </>
        )}
      </p>
      {result && 'error' in result && <p className="text-rose-700">{result.error}</p>}
      <div className="flex gap-2">
        <SubmitButton className="btn flex-1">Aplicar</SubmitButton>
        <a href="/presupuesto" className="btn-ghost">
          Cancelar
        </a>
      </div>
    </form>
  )
}
