import Link from 'next/link'
import { requireFamily } from '@/lib/session'
import { applyTransaction, fetchTransaction } from '@/lib/wompi'
import { money } from '@/lib/format'
import { Card } from '@/components/cards'

/** Página a la que Wompi redirige después del pago (?id=<transacción>). */
export default async function ResultadoPage(props: PageProps<'/plan/resultado'>) {
  const { id } = await props.searchParams
  await requireFamily()
  const tx = typeof id === 'string' ? await fetchTransaction(id) : null

  // Consultamos a Wompi directamente; si el webhook aún no llegó, aplicamos el pago aquí (es idempotente).
  if (tx) await applyTransaction(tx).catch((err) => console.error('Error aplicando pago', err))

  const view = !tx
    ? { icon: '🤔', title: 'No encontramos el pago', text: 'Si pagaste, en unos minutos se verá reflejado en tu plan.' }
    : tx.status === 'APPROVED'
      ? { icon: '🎉', title: '¡Pago aprobado!', text: `Recibimos ${money(tx.amount_in_cents / 100)}. Tu plan ya está activo.` }
      : tx.status === 'PENDING'
        ? { icon: '🕓', title: 'Pago en proceso', text: 'Wompi está confirmando el pago (PSE y Nequi pueden tardar unos minutos). Te avisamos cuando quede listo.' }
        : { icon: '❌', title: 'El pago no se completó', text: 'Puedes intentarlo de nuevo con otro medio de pago.' }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <div className="py-6 text-center">
          <div className="text-5xl">{view.icon}</div>
          <h1 className="mt-3 text-xl font-semibold">{view.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{view.text}</p>
          {tx && <p className="mt-3 font-mono text-xs text-slate-500">Ref. {tx.reference}</p>}
          <Link href="/plan" className="btn mt-6">
            Volver a mi plan
          </Link>
        </div>
      </Card>
    </div>
  )
}
