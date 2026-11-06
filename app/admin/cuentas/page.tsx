import { Suspense } from 'react'
import { loadAccounts, requireCreator } from '@/lib/creator'
import { Card, Stat } from '@/components/cards'

export default function CuentasPage() {
  return (
    <main id="contenido" className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold">Cuentas y familias</h1>
      <p className="text-sm text-slate-600">Todas las cuentas creadas en Luka. Solo lo ven los correos de ADMIN_EMAILS.</p>
      <Suspense fallback={<p className="mt-6 text-sm text-slate-600">Cargando…</p>}>
        <Accounts />
      </Suspense>
    </main>
  )
}

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' }) : '—'

async function Accounts() {
  await requireCreator('/admin/cuentas')
  const { accounts, families, newLast7 } = await loadAccounts()
  const web = accounts.filter((a) => a.via === 'web').length

  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Cuentas" value={String(accounts.length)} hint={`${web} con correo · ${accounts.length - web} solo Telegram`} />
        <Stat label="Nuevas (7 días)" value={String(newLast7)} />
        <Stat label="Familias" value={String(families.length)} hint={`${families.filter((f) => f.telegram).length} con Telegram conectado`} />
        <Stat label="Familias activas (30 días)" value={String(families.filter((f) => f.tx30 > 0).length)} hint="Con al menos un movimiento" />
      </div>

      <Card
        title={`Familias (${families.length})`}
        action={
          <a href="/admin/cuentas/exportar?tipo=familias" className="text-sm font-medium text-brand-700 underline">
            Descargar CSV
          </a>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Familias registradas</caption>
            <thead className="text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="py-2 pr-3">Familia</th>
                <th scope="col" className="pr-3">Creada</th>
                <th scope="col" className="pr-3">Plan</th>
                <th scope="col" className="pr-3">Telegram</th>
                <th scope="col" className="pr-3">Miembros</th>
                <th scope="col" className="pr-3">Movimientos 30 d</th>
                <th scope="col" className="pr-3">Último</th>
                <th scope="col" className="pr-3">Lecturas IA mes</th>
                <th scope="col">Administrador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {families.map((f) => (
                <tr key={f.id}>
                  <td className="py-2 pr-3 font-medium">{f.name}</td>
                  <td className="pr-3">{date(f.created_at)}</td>
                  <td className="pr-3">
                    {f.plan} · <span className={f.active ? 'text-slate-600' : 'text-rose-700'}>{f.status}</span>
                  </td>
                  <td className="pr-3">{f.telegram ? '🟢 Sí' : '⚪ No'}</td>
                  <td className="pr-3">
                    {f.members} <span className="text-xs text-slate-600">({f.webMembers} web · {f.telegramMembers} Telegram)</span>
                  </td>
                  <td className="pr-3">{f.tx30}</td>
                  <td className="pr-3">{date(f.lastTx)}</td>
                  <td className="pr-3">{f.aiThisMonth}</td>
                  <td className="break-all">{f.admins.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title={`Cuentas (${accounts.length})`}
        action={
          <a href="/admin/cuentas/exportar?tipo=cuentas" className="text-sm font-medium text-brand-700 underline">
            Descargar CSV
          </a>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Cuentas de usuario</caption>
            <thead className="text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="py-2 pr-3">Nombre</th>
                <th scope="col" className="pr-3">Correo</th>
                <th scope="col" className="pr-3">Entra por</th>
                <th scope="col" className="pr-3">Creada</th>
                <th scope="col" className="pr-3">Último ingreso</th>
                <th scope="col" className="pr-3">Familia</th>
                <th scope="col">Aceptó términos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td className="py-2 pr-3 font-medium">{a.name || '—'}</td>
                  <td className="break-all pr-3">{a.email || '—'}</td>
                  <td className="pr-3">{a.via === 'web' ? '🌐 Correo' : '✈️ Telegram'}</td>
                  <td className="pr-3 tabular-nums">{date(a.created_at)}</td>
                  <td className="pr-3 tabular-nums">{date(a.last_sign_in_at)}</td>
                  <td className="pr-3">
                    {a.families.length
                      ? a.families.map((f) => `${f.name}${f.role === 'admin' ? ' (admin)' : ''}`).join(', ')
                      : <span className="text-amber-700">Sin familia</span>}
                  </td>
                  <td className="tabular-nums">{a.consent ?? <span className="text-rose-700">Pendiente</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-slate-600">
        Estos datos son personales: úsalos solo para operar y mejorar el servicio, como dice la política de datos. No los compartas ni
        los uses para publicidad sin autorización.
      </p>
    </div>
  )
}
