'use client'

import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface TrendPoint {
  label: string
  income: number
  expenses: number
  projected: boolean
}

// Paleta categórica validada (slots 1 y 2): azul = ingresos, naranja = gastos
const INCOME = '#2a78d6'
const EXPENSES = '#eb6834'

const compact = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 })
const full = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {[
                ['inc', INCOME],
                ['exp', EXPENSES],
              ].map(([id, c]) => (
                <pattern key={id} id={`hatch-${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="6" height="6" fill={c} fillOpacity={0.25} />
                  <line x1="0" y1="0" x2="0" y2="6" stroke={c} strokeWidth="2" />
                </pattern>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="#e7e5e4" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#d6d3d1' }} tick={{ fill: '#52514e', fontSize: 12 }} />
            <YAxis
              tickFormatter={(v) => compact.format(v)}
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fill: '#52514e', fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: '#f5f5f4' }}
              formatter={(v, name) => [full.format(Number(v)), name]}
              labelFormatter={(l, p) => (p?.[0]?.payload?.projected ? `${l} (proyección)` : l)}
              contentStyle={{ borderRadius: 12, borderColor: '#e7e5e4', fontSize: 13 }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 13, color: '#52514e' }} />
            <Bar dataKey="income" name="Ingresos" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={28}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.projected ? 'url(#hatch-inc)' : INCOME} />
              ))}
            </Bar>
            <Bar dataKey="expenses" name="Gastos" fill={EXPENSES} radius={[4, 4, 0, 0]} maxBarSize={28}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.projected ? 'url(#hatch-exp)' : EXPENSES} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-slate-500">Barras rayadas = proyección según el promedio de los meses cerrados.</p>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-slate-500">Ver tabla</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-1">Mes</th>
              <th>Ingresos</th>
              <th>Gastos</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-t border-slate-100">
                <td className="py-1">
                  {d.label}
                  {d.projected ? ' *' : ''}
                </td>
                <td>{full.format(d.income)}</td>
                <td>{full.format(d.expenses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
