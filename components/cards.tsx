export function Card({ title, action, children, className = '' }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="font-semibold text-slate-800">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, hint, tone = 'default' }: { label: string; value: string; hint?: string; tone?: 'default' | 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-brand-700' : tone === 'bad' ? 'text-rose-600' : 'text-slate-900'
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function Progress({ value, max, projected }: { value: number; max: number; projected?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const projPct = max > 0 && projected ? Math.min(100, (projected / max) * 100) : 0
  const over = max > 0 && value > max
  const warn = max > 0 && !over && (value / max >= 0.8 || (projected ?? 0) > max)
  const color = over ? 'bg-rose-500' : warn ? 'bg-amber-500' : 'bg-brand-500'
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
      {projPct > pct && <div className="absolute inset-y-0 left-0 bg-slate-300/70" style={{ width: `${projPct}%` }} />}
      <div className={`absolute inset-y-0 left-0 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{children}</p>
}
