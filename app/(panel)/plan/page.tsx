import Link from 'next/link'
import { requireFamily } from '@/lib/session'
import { FOUNDER, PLANS, REFERRAL_DAYS, getAccess, priceFor, type PaidPlanId } from '@/lib/plans'
import { founderSlots, referralStats, referralUrl } from '@/lib/growth'
import { CopyButton } from '@/components/copy-button'
import { money } from '@/lib/format'
import { startCheckout } from '@/app/actions'
import { paymentsEnabled } from '@/lib/wompi'
import { Card, Progress } from '@/components/cards'
import { SubmitButton } from '@/components/ui'

const STATUS_LABEL: Record<string, string> = {
  APPROVED: '✅ Aprobado',
  PENDING: '🕓 Pendiente',
  DECLINED: '❌ Rechazado',
  VOIDED: '↩️ Anulado',
  ERROR: '⚠️ Error',
}

export default async function PlanPage() {
  const { supabase, family } = await requireFamily()
  const [access, { data: payments }, slots, refs] = await Promise.all([
    getAccess(supabase, family),
    supabase.from('payments').select('*').eq('family_id', family.id).order('created_at', { ascending: false }).limit(10),
    founderSlots(),
    referralStats(family.id),
  ])
  const founderPrice = !!family.founder || slots.remaining > 0
  const inviteUrl = referralUrl(family)
  const untilLabel = access.until.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' })

  return (
    <div className="space-y-4">
      <Card title="Tu plan">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Plan actual</p>
            <p className="text-xl font-semibold">{access.plan.name}</p>
            <p className={`text-sm ${access.active ? 'text-slate-600' : 'text-rose-600'}`}>
              {access.active
                ? `${access.plan.id === 'trial' ? 'La prueba termina' : 'Pagado hasta'} el ${untilLabel} (${access.daysLeft} días)`
                : `Venció el ${untilLabel}. El bot no está leyendo recibos.`}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="mb-1 flex justify-between text-sm">
              <span className="text-slate-600">Lecturas con IA este mes</span>
              <span className="tabular-nums">
                {access.used} / {access.plan.aiLimit}
              </span>
            </p>
            <Progress value={access.used} max={access.plan.aiLimit} />
            <p className="mt-1 text-xs text-slate-500">
              Cada foto, PDF o mensaje con un monto que lee el bot cuenta como una lectura. El contador se reinicia el 1 de cada mes.
            </p>
          </div>
        </div>
      </Card>

      {family.founder ? (
        <p className="rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-700">
          🌱 <b>Son familia fundadora.</b> Conservan el plan {PLANS[FOUNDER.plan].name} a {money(FOUNDER.monthlyPrice)} al mes o{' '}
          {money(FOUNDER.yearlyPrice)} al año para siempre, aunque los precios suban.
        </p>
      ) : (
        founderPrice && (
          <p className="rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-700">
            🌱 <b>Precio de fundador:</b> las primeras {FOUNDER.limit} familias que paguen el plan {PLANS[FOUNDER.plan].name} lo tienen
            a {money(FOUNDER.monthlyPrice)} al mes o {money(FOUNDER.yearlyPrice)} al año <b>para siempre</b>. Quedan{' '}
            <b>{slots.remaining}</b> de {FOUNDER.limit} cupos.
          </p>
        )
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(['familia', 'plus'] as PaidPlanId[]).map((id) => {
          const founder = founderPrice && id === FOUNDER.plan
          const monthly = priceFor(id, 'monthly', founder)
          const yearly = priceFor(id, 'yearly', founder)
          const p = PLANS[id]
          const current = access.plan.id === id && access.active
          return (
            <section
              key={id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{p.name}</h2>
                {id === 'plus' && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">Para familias grandes</span>}
              </div>
              <p className="mt-2">
                <span className="text-3xl font-bold tabular-nums">{money(monthly)}</span>
                <span className="text-slate-500"> /mes</span>
                {founder && <span className="ml-2 text-sm text-slate-500">Precio normal {money(p.monthlyPrice)}</span>}
              </p>
              <p className="text-sm text-slate-500">o {money(yearly)} al año (2 meses gratis)</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {p.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              {paymentsEnabled ? (
                <form action={startCheckout} className="mt-6 grid grid-cols-2 gap-2">
                  <input type="hidden" name="plan" value={id} />
                  <SubmitButton className="btn">Pagar 1 mes · {money(monthly)}</SubmitButton>
                  <button type="submit" name="period" value="yearly" className="btn">
                    Pagar 1 año · {money(yearly)}
                  </button>
                </form>
              ) : (
                <p className="mt-6 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
                  Los pagos todavía no están habilitados. Mientras tanto puedes usar la prueba gratis.
                </p>
              )}
              {current && <p className="mt-2 text-xs text-slate-500">Es tu plan actual: pagar suma el tiempo al vencimiento.</p>}
            </section>
          )
        })}
      </div>
      <p className="text-center text-xs text-slate-500">
        Pagos con Wompi (Bancolombia). Precio final, sin cargos adicionales. El pago es por periodo y no se renueva solo: no guardamos
        tu tarjeta y te avisaremos por Telegram antes de que venza. Al pagar aceptas los{' '}
        <Link href="/terminos" className="underline">
          Términos y condiciones
        </Link>
        . Tienes 5 días hábiles de derecho de retracto (ver{' '}
        <Link href="/reembolsos" className="underline">
          Política de reembolsos
        </Link>
        ).
      </p>

      <Card title="🎁 Invita a otra familia y ganen un mes">
        <p className="text-sm text-slate-700">
          Comparte tu enlace. Cuando la familia que invites pague su primer plan, <b>las dos reciben {REFERRAL_DAYS} días gratis</b>.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input readOnly aria-label="Tu enlace de invitación" value={inviteUrl} className="input flex-1 font-mono text-xs" />
          <CopyButton value={inviteUrl} />
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Estoy usando Luka para llevar las cuentas de la casa desde Telegram: mandas la foto del recibo y listo. Pruébalo gratis: ${inviteUrl}`)}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
          >
            Enviar por WhatsApp
          </a>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Familias invitadas: {refs.invited} · ya pagaron (recompensa entregada): {refs.rewarded}
        </p>
      </Card>

      {!!payments?.length && (
        <Card title="Historial de pagos">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2">Fecha</th>
                <th>Plan</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Referencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2">{new Date(p.created_at).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}</td>
                  <td>
                    {PLANS[p.plan as PaidPlanId]?.name} · {p.period === 'yearly' ? 'anual' : 'mensual'}
                  </td>
                  <td className="tabular-nums">{money(Number(p.amount_in_cents) / 100)}</td>
                  <td>{STATUS_LABEL[p.status] ?? p.status}</td>
                  <td className="font-mono text-xs text-slate-500">{p.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
