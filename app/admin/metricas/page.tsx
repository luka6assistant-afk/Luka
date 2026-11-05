import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { Card, Stat } from '@/components/cards'

interface Metrics {
  families_total: number
  families_active_7d: number
  families_paying: number
  avg_tx_per_family_30d: number | null
  families_over_50_tx_30d: number
  retention_week4: number | null
  retention_cohort_size: number
  families_with_goal_pct: number | null
  ai_reads_this_month: number
  latency: { source: string; n: number; p50_ms: number; p90_ms: number; under_10s_pct: number }[]
}

const SOURCE: Record<string, string> = {
  telegram_photo: '📸 Foto / PDF',
  telegram_text: '💬 Texto',
  telegram_audio: '🎙 Nota de voz',
  web: '🌐 Web',
}

/** Métricas de éxito del PRD. Solo para los correos en ADMIN_EMAILS. */
export default function MetricasPage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold">Métricas del MVP</h1>
      <p className="text-sm text-slate-500">Objetivos de los primeros 30 días según el PRD</p>
      <Suspense fallback={<p className="mt-6 text-sm text-slate-500">Calculando…</p>}>
        <MetricsView />
      </Suspense>
    </main>
  )
}

async function MetricsView() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin/metricas')
  const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  if (!user.email || !admins.includes(user.email.toLowerCase())) notFound()

  const { data, error } = await createAdminClient().rpc('product_metrics')
  if (error) return <p className="mt-6 text-sm text-rose-600">Error: {error.message}</p>
  const m = data as Metrics
  const ok = (cond: boolean) => (cond ? 'good' : 'bad') as 'good' | 'bad'
  const s = (ms: number) => `${(ms / 1000).toFixed(1)} s`

  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Familias activas (7 días)" value={`${m.families_active_7d}`} hint={`Meta: 10 · ${m.families_total} en total`} tone={ok(m.families_active_7d >= 10)} />
        <Stat
          label="Movimientos por familia (30 d)"
          value={m.avg_tx_per_family_30d === null ? '—' : String(m.avg_tx_per_family_30d)}
          hint={`Meta: > 50 · ${m.families_over_50_tx_30d} familias la cumplen`}
          tone={ok((m.avg_tx_per_family_30d ?? 0) > 50)}
        />
        <Stat
          label="Retención semana 4"
          value={m.retention_week4 === null ? '—' : `${m.retention_week4}%`}
          hint={`Meta: > 40% · ${m.retention_cohort_size} familias con 4+ semanas`}
          tone={ok((m.retention_week4 ?? 0) > 40)}
        />
        <Stat
          label="Familias con meta"
          value={m.families_with_goal_pct === null ? '—' : `${m.families_with_goal_pct}%`}
          hint="Meta: 100% (al menos una por familia)"
          tone={ok((m.families_with_goal_pct ?? 0) >= 100)}
        />
      </div>

      <Card title="Tiempo para registrar un movimiento (últimos 30 días) · meta < 10 s">
        {m.latency.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay registros desde Telegram.</p>
        ) : (
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2">Origen</th>
                <th>Registros</th>
                <th>Mediana</th>
                <th>Percentil 90</th>
                <th>Bajo 10 s</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {m.latency.map((l) => (
                <tr key={l.source}>
                  <td className="py-2">{SOURCE[l.source] ?? l.source}</td>
                  <td>{l.n}</td>
                  <td className={l.p50_ms < 10_000 ? 'text-brand-700' : 'text-rose-600'}>{s(l.p50_ms)}</td>
                  <td className={l.p90_ms < 10_000 ? 'text-brand-700' : 'text-rose-600'}>{s(l.p90_ms)}</td>
                  <td>{l.under_10s_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Desde que la persona envía el mensaje hasta que el bot responde con el movimiento registrado. Telegram reporta la hora de
          envío en segundos, así que hay hasta 1 s de imprecisión.
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Familias pagando" value={String(m.families_paying)} />
        <Stat label="Lecturas con IA este mes" value={m.ai_reads_this_month.toLocaleString('es-CO')} />
      </div>
      <p className="text-xs text-slate-500">
        Retención semana 4: de las familias creadas hace 28 días o más, el porcentaje que registró algo en los últimos 7 días.
      </p>
    </div>
  )
}
