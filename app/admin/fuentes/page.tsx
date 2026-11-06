import { Suspense } from 'react'
import Link from 'next/link'
import { loadAccounts, requireCreator } from '@/lib/creator'
import { createAdminClient } from '@/lib/supabase/server'
import { SOURCE_LABEL } from '@/lib/attribution'
import { Card, Stat } from '@/components/cards'
import { CopyButton } from '@/components/copy-button'

const PERIODS = { '7': 7, '30': 30, '90': 90, todo: 0 } as const
type Period = keyof typeof PERIODS

export default function FuentesPage(props: PageProps<'/admin/fuentes'>) {
  return (
    <main id="contenido" className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold">¿Por dónde llegan las familias?</h1>
      <p className="text-sm text-slate-600">
        Visitas a la portada, descargas de la plantilla, registros y conversión por fuente. Las visitas son conteos anónimos.
      </p>
      <Suspense fallback={<p className="mt-6 text-sm text-slate-600">Calculando…</p>}>
        <Sources searchParams={props.searchParams} />
      </Suspense>
    </main>
  )
}

/** Fecha ISO de hace `days` días (0 = desde siempre). */
const sinceDays = (days: number) => (days ? new Date(Date.now() - days * 86_400_000).toISOString() : '1970-01-01')
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '—')
const label = (s: string) => SOURCE_LABEL[s] ?? `🏷 ${s}`

async function Sources({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireCreator('/admin/fuentes')
  const sp = await searchParams
  const period = (typeof sp.periodo === 'string' && sp.periodo in PERIODS ? sp.periodo : '30') as Period
  const days = PERIODS[period]
  const since = sinceDays(days)

  const [{ accounts, families }, { data: stats }] = await Promise.all([
    loadAccounts(),
    createAdminClient().from('landing_stats').select('source, kind, count').gte('day', since.slice(0, 10)),
  ])
  const acc = accounts.filter((a) => a.via === 'web' && a.created_at >= since)
  const fams = families.filter((f) => f.created_at >= since)

  type Row = { source: string; visits: number; downloads: number; accounts: number; families: number; connected: number; active: number; paying: number }
  const rows = new Map<string, Row>()
  const row = (s: string) => {
    if (!rows.has(s)) rows.set(s, { source: s, visits: 0, downloads: 0, accounts: 0, families: 0, connected: 0, active: 0, paying: 0 })
    return rows.get(s)!
  }
  for (const s of stats ?? []) {
    if (s.kind === 'visita') row(s.source).visits += s.count
    else row(s.source).downloads += s.count
  }
  for (const a of acc) row(a.source ?? 'sin-dato').accounts++
  for (const f of fams) {
    const r = row(f.source ?? 'sin-dato')
    r.families++
    if (f.connected) r.connected++
    if (f.tx30 > 0) r.active++
    if (f.paying) r.paying++
  }
  const list = [...rows.values()].sort((a, b) => b.accounts - a.accounts || b.visits - a.visits)
  const total = list.reduce(
    (t, r) => ({ visits: t.visits + r.visits, downloads: t.downloads + r.downloads, accounts: t.accounts + r.accounts, families: t.families + r.families, connected: t.connected + r.connected, paying: t.paying + r.paying }),
    { visits: 0, downloads: 0, accounts: 0, families: 0, connected: 0, paying: 0 },
  )

  // Campañas (fuente + nombre de campaña)
  const campaigns = new Map<string, { source: string; campaign: string; accounts: number; families: number; paying: number }>()
  for (const f of fams.filter((f) => f.campaign)) {
    const k = `${f.source}·${f.campaign}`
    const c = campaigns.get(k) ?? { source: f.source ?? 'sin-dato', campaign: f.campaign!, accounts: 0, families: 0, paying: 0 }
    c.families++
    if (f.paying) c.paying++
    campaigns.set(k, c)
  }
  for (const a of acc.filter((a) => a.campaign)) {
    const k = `${a.source}·${a.campaign}`
    const c = campaigns.get(k) ?? { source: a.source ?? 'sin-dato', campaign: a.campaign!, accounts: 0, families: 0, paying: 0 }
    c.accounts++
    campaigns.set(k, c)
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const links = [
    ['TikTok', 'tiktok'],
    ['Instagram', 'instagram'],
    ['Facebook (grupos y página)', 'facebook'],
    ['Estados y grupos de WhatsApp', 'whatsapp'],
    ['YouTube', 'youtube'],
    ['LinkedIn', 'linkedin'],
  ] as const

  return (
    <div className="mt-6 space-y-4">
      <nav aria-label="Periodo" className="flex flex-wrap gap-2 text-sm">
        {(Object.keys(PERIODS) as Period[]).map((p) => (
          <Link
            key={p}
            href={`/admin/fuentes?periodo=${p}`}
            aria-current={p === period ? 'page' : undefined}
            className={`rounded-lg px-3 py-1.5 ${p === period ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-700 hover:bg-slate-100'}`}
          >
            {p === 'todo' ? 'Todo' : `Últimos ${p} días`}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Visitas a la portada" value={total.visits.toLocaleString('es-CO')} />
        <Stat label="Descargas de la plantilla" value={total.downloads.toLocaleString('es-CO')} />
        <Stat label="Cuentas creadas" value={String(total.accounts)} hint={`${pct(total.accounts, total.visits)} de las visitas`} />
        <Stat label="Conectaron el chat" value={String(total.connected)} hint={`${pct(total.connected, total.families)} de las familias`} />
        <Stat label="Pagando" value={String(total.paying)} hint={`${pct(total.paying, total.families)} de las familias`} />
      </div>

      <Card title="Por fuente">
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <caption className="sr-only">Visitas, registros y conversión por fuente</caption>
            <thead className="text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="py-2 pr-3">Fuente</th>
                <th scope="col" className="pr-3">Visitas</th>
                <th scope="col" className="pr-3">Plantilla</th>
                <th scope="col" className="pr-3">Cuentas</th>
                <th scope="col" className="pr-3">Visita → cuenta</th>
                <th scope="col" className="pr-3">Familias</th>
                <th scope="col" className="pr-3">Conectadas</th>
                <th scope="col" className="pr-3">Activas 30 d</th>
                <th scope="col">Pagando</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-3 text-slate-600">
                    Aún no hay datos en este periodo.
                  </td>
                </tr>
              )}
              {list.map((r) => (
                <tr key={r.source}>
                  <td className="py-2 pr-3 font-medium">{r.source === 'sin-dato' ? '❔ Sin dato (antes de medir)' : label(r.source)}</td>
                  <td className="pr-3">{r.visits}</td>
                  <td className="pr-3">{r.downloads}</td>
                  <td className="pr-3">{r.accounts}</td>
                  <td className="pr-3">{pct(r.accounts, r.visits)}</td>
                  <td className="pr-3">{r.families}</td>
                  <td className="pr-3">{r.connected}</td>
                  <td className="pr-3">{r.active}</td>
                  <td>{r.paying}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-600">
          Las visitas que llegan desde apps (TikTok, Instagram, WhatsApp) muchas veces no dicen de dónde vienen y quedan como «Directo».
          Por eso conviene usar siempre los enlaces de campaña de abajo.
        </p>
      </Card>

      {campaigns.size > 0 && (
        <Card title="Por campaña">
          <table className="w-full text-sm tabular-nums">
            <caption className="sr-only">Registros por campaña</caption>
            <thead className="text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="py-2 pr-3">Fuente</th>
                <th scope="col" className="pr-3">Campaña</th>
                <th scope="col" className="pr-3">Cuentas</th>
                <th scope="col" className="pr-3">Familias</th>
                <th scope="col">Pagando</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...campaigns.values()].map((c) => (
                <tr key={`${c.source}·${c.campaign}`}>
                  <td className="py-2 pr-3">{label(c.source)}</td>
                  <td className="pr-3 font-mono text-xs">{c.campaign}</td>
                  <td className="pr-3">{c.accounts}</td>
                  <td className="pr-3">{c.families}</td>
                  <td>{c.paying}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card title="🔗 Enlaces para tus publicaciones">
        <p className="text-sm text-slate-700">
          Usa el enlace de cada red en tu biografía, publicaciones y anuncios. Para una campaña específica agrega
          <code className="mx-1 rounded bg-slate-100 px-1">&amp;cmp=nombre</code> al final (ej. <code className="rounded bg-slate-100 px-1">&amp;cmp=video-recibo</code>).
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {links.map(([name, src]) => {
            const url = `${base}/?src=${src}`
            return (
              <li key={src} className="flex flex-wrap items-center gap-2">
                <span className="w-56 shrink-0 text-slate-700">{name}</span>
                <input readOnly value={url} aria-label={`Enlace para ${name}`} className="input flex-1 font-mono text-xs" />
                <CopyButton value={url} />
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
