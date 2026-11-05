'use client'

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface CategorySlice {
  name: string
  value: number
}

// Una sola serie: un solo color (slot 1 de la paleta validada); el título nombra la serie
const COLOR = '#2a78d6'
const full = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 })

export function CategoryChart({ data, total }: { data: CategorySlice[]; total: number }) {
  const rows = data.map((d) => ({ ...d, pct: total > 0 ? Math.round((d.value / total) * 100) : 0 }))
  return (
    <div>
      <div className="w-full" style={{ height: Math.max(160, rows.length * 34) }}>
        <ResponsiveContainer>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap={6}>
            <CartesianGrid horizontal={false} stroke="#e7e5e4" />
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} tick={{ fill: '#52514e', fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: '#f5f5f4' }}
              formatter={(v, _n, item) => [`${full.format(Number(v))} (${item?.payload?.pct ?? 0}%)`, 'Gastado']}
              contentStyle={{ borderRadius: 12, borderColor: '#e7e5e4', fontSize: 13 }}
            />
            <Bar dataKey="value" fill={COLOR} radius={[0, 4, 4, 0]} maxBarSize={22}>
              <LabelList dataKey="value" position="right" formatter={(v) => compact.format(Number(v))} style={{ fill: '#52514e', fontSize: 12 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-slate-500">Ver tabla</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-slate-100">
                <td className="py-1">{r.name}</td>
                <td>{full.format(r.value)}</td>
                <td className="text-right text-slate-500">{r.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
