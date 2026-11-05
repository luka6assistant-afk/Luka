import Link from 'next/link'
import { PLANS } from '@/lib/plans'
import { money } from '@/lib/format'

export function PlusUpsell({ feature }: { feature: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-brand-500 bg-white p-8 text-center shadow-sm">
      <div className="text-4xl">💎</div>
      <h1 className="mt-3 text-xl font-semibold">{feature} está en {PLANS.plus.name}</h1>
      <p className="mt-2 text-sm text-slate-600">
        Planeen cómo salir de deudas (fecha de pago, intereses, avalancha vs. bola de nieve) y sigan sus metas de ahorro, por{' '}
        {money(PLANS.plus.monthlyPrice)} al mes.
      </p>
      <Link href="/plan" className="btn mt-6">
        Ver planes
      </Link>
    </div>
  )
}
