import type { Metadata } from 'next'
import Link from 'next/link'
import { LEGAL } from '@/lib/legal'
import { PLANS } from '@/lib/plans'
import { money } from '@/lib/format'

export const metadata: Metadata = { title: 'Política de reembolsos — Luka' }

export default function ReembolsosPage() {
  const L = LEGAL
  return (
    <>
      <h1>Política de reembolsos</h1>
      <p className="text-sm text-slate-600">Vigente desde el {L.effectiveDate}</p>

      <p>
        Esta política complementa los{' '}
        <Link href="/terminos" className="text-brand-700 underline">
          Términos y condiciones
        </Link>{' '}
        y se aplica a los pagos de los planes de {L.product}. Nada de lo que dice aquí limita tus derechos como consumidor según la
        Ley 1480 de 2011.
      </p>

      <h2>1. Cómo se cobra</h2>
      <ul>
        <li>
          Pagas un periodo (un mes o un año) por adelantado: {PLANS.familia.name} {money(PLANS.familia.monthlyPrice)} al mes o{' '}
          {money(PLANS.familia.yearlyPrice)} al año; {PLANS.plus.name} {money(PLANS.plus.monthlyPrice)} al mes o{' '}
          {money(PLANS.plus.yearlyPrice)} al año.
        </li>
        <li>Es el precio final, sin cargos adicionales. No hay renovación automática ni guardamos tu tarjeta.</li>
        <li>Antes de pagar puedes usar la prueba gratis de 14 días, sin dar ningún medio de pago.</li>
      </ul>

      <h2>2. Cuándo te devolvemos el dinero completo</h2>
      <ul>
        <li>
          <b>Derecho de retracto:</b> si lo pides dentro de los <b>5 días hábiles</b> siguientes al pago, por cualquier motivo
          (artículo 47 de la Ley 1480 de 2011).
        </li>
        <li>
          <b>Cobro por error:</b> si te cobramos dos veces, un valor distinto al anunciado o un pago que no hiciste.
        </li>
        <li>
          <b>Plan no activado:</b> si el pago quedó aprobado y el plan no se activó, y no lo corregimos dentro de los 2 días hábiles
          siguientes a tu aviso.
        </li>
      </ul>

      <h2>3. Fallas del servicio</h2>
      <p>
        Si una falla nuestra deja el servicio sin funcionar por más de 72 horas seguidas, te compensamos con los días que estuvo
        caído más 7 días adicionales. Si lo prefieres, te devolvemos la parte proporcional de los días que no pudiste usar.
      </p>

      <h2>4. Fuera de esos casos</h2>
      <p>
        Pasados los 5 días hábiles del retracto no devolvemos periodos ya iniciados, porque el plan sigue activo hasta su fecha de
        vencimiento y puedes usarlo hasta el final. Si no quieres continuar, basta con no volver a pagar: no hay nada que cancelar.
      </p>

      <h2>5. Cómo pedirlo</h2>
      <ol>
        <li>
          Escribe a <b>{L.email}</b> con el correo de tu cuenta y la referencia del pago (aparece en el panel, en 💎 Plan →
          Historial de pagos).
        </li>
        <li>Te respondemos dentro de los 5 días hábiles siguientes.</li>
        <li>
          Si procede, hacemos la devolución dentro de los <b>30 días calendario</b> siguientes, por el mismo medio de pago cuando
          sea posible. Al devolverse el dinero, el plan vuelve al estado anterior al pago.
        </li>
      </ol>

      <h2>6. Reversión del pago</h2>
      <p>
        También puedes pedir la reversión del pago en los casos del artículo 51 de la Ley 1480 de 2011 (fraude, operación no
        solicitada, producto no recibido o que no corresponde a lo ofrecido). Debes presentar la queja ante nosotros y ante la
        entidad emisora del medio de pago dentro de los 5 días hábiles siguientes a la fecha en que conociste el problema.
      </p>
    </>
  )
}
