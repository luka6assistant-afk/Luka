import type { Metadata } from 'next'
import Link from 'next/link'
import { LEGAL } from '@/lib/legal'
import { FOUNDER, PLANS, REFERRAL_DAYS, TRIAL_DAYS } from '@/lib/plans'
import { money } from '@/lib/format'

export const metadata: Metadata = { title: 'Términos y condiciones — Luka' }

export default function TerminosPage() {
  const L = LEGAL
  return (
    <>
      <h1>Términos y condiciones de uso</h1>
      <p className="text-sm text-slate-600">
        Versión {L.versions.terminos} · Vigente desde el {L.effectiveDate}
      </p>

      <p>
        Estos términos regulan el uso de {L.product}, un servicio de {L.company} ({L.nit}), con domicilio en {L.city}. Al crear una
        cuenta, vincular un chat o usar el bot, aceptas estos términos y la{' '}
        <Link href="/privacidad" className="text-brand-700 underline">
          Política de tratamiento de datos
        </Link>
        .
      </p>

      <h2>1. El servicio</h2>
      <p>
        {L.product} ayuda a una familia a registrar y organizar su dinero. Recibe recibos, facturas, comprobantes y mensajes por
        Telegram o WhatsApp y los lee con inteligencia artificial. Además ofrece un panel web con movimientos, presupuesto,
        proyecciones, deudas y metas de ahorro, y envía al chat un resumen mensual.
      </p>

      <h2>2. No es asesoría financiera</h2>
      <p>
        Los resúmenes, proyecciones y cálculos de ahorro son <b>estimaciones informativas</b>. Se calculan
        con la información que ustedes registran y con supuestos simples, como cuotas fijas y tasas constantes. No son asesoría
        financiera, tributaria, legal ni de inversión, y no reemplazan la información oficial de su banco o entidad. Las
        decisiones financieras son responsabilidad de cada familia.
      </p>

      <h2>3. Lectura automática</h2>
      <p>
        La lectura con inteligencia artificial puede equivocarse en montos, fechas o categorías, sobre todo con imágenes borrosas o
        incompletas. Cada registro se puede revisar, corregir o borrar desde el chat o el panel. Ustedes son responsables de
        verificar que la información sea correcta.
      </p>

      <h2>4. Cuentas y familias</h2>
      <ul>
        <li>Debes ser mayor de 18 años y dar información veraz al registrarte.</li>
        <li>Cuida tu contraseña. Eres responsable de lo que se haga con tu cuenta.</li>
        <li>
          Todos los miembros de una familia ven los movimientos de la familia. Comparte el código de la familia solo con personas de
          confianza.
        </li>
        <li>Quien vincula un chat de Telegram declara que tiene permiso para hacerlo y que informará a los miembros del grupo.</li>
      </ul>

      <h2>5. Uso permitido</h2>
      <p>
        No puedes usar el servicio para actividades ilegales, para enviar contenido de terceros sin autorización, para intentar
        acceder a datos de otras familias, ni para afectar el funcionamiento del sistema. Podemos suspender cuentas que incumplan
        estas reglas.
      </p>

      <h2>6. Planes, precios y pagos</h2>
      <ul>
        <li>Cada familia nueva tiene una prueba gratis de {TRIAL_DAYS} días, sin pedir medio de pago.</li>
        <li>
          Planes vigentes: {PLANS.familia.name} a {money(PLANS.familia.monthlyPrice)} al mes o {money(PLANS.familia.yearlyPrice)}{' '}
          al año, y {PLANS.plus.name} a {money(PLANS.plus.monthlyPrice)} al mes o {money(PLANS.plus.yearlyPrice)} al año. Es el
          <b>precio final</b>: incluye los impuestos que apliquen y no hay cargos adicionales, de activación ni comisiones por
          pagar.
        </li>
        <li>
          El pago es <b>por periodo</b> (un mes o un año) y se hace por Wompi. <b>No se renueva automáticamente</b>, no guardamos tu
          tarjeta y nunca te cobraremos sin que tú hagas el pago. Te avisaremos antes de que venza.
        </li>
        <li>
          Cada plan incluye un número de lecturas con inteligencia artificial al mes. Si se agotan, puedes seguir registrando
          movimientos a mano o cambiar de plan. Las lecturas que no se usan no se acumulan.
        </li>
        <li>
          Si el plan vence, el bot deja de leer recibos. Tus datos se conservan y puedes seguir viendo el panel.
        </li>
        <li>Si cambiamos los precios, te avisaremos con al menos 30 días de anticipación. El cambio no afecta periodos ya pagados.</li>
        <li>
          <b>Precio de fundador:</b> las primeras {FOUNDER.limit} familias que paguen el plan {PLANS[FOUNDER.plan].name} con este
          precio lo conservan ({money(FOUNDER.monthlyPrice)} al mes o {money(FOUNDER.yearlyPrice)} al año) mientras la familia
          tenga cuenta en {L.product}, aunque los precios cambien. El cupo se asigna cuando se aprueba el primer pago con ese precio.
        </li>
        <li>
          <b>Invitaciones:</b> si una familia se registra con el enlace de invitación de otra y paga su primer plan, las dos reciben{' '}
          {REFERRAL_DAYS} días gratis, una sola vez por familia invitada. No tiene valor en dinero ni se puede cambiar por efectivo.
          Si detectamos registros falsos para obtener días gratis, podemos anularlos.
        </li>
      </ul>

      <h2>7. Derecho de retracto, reembolsos y reversión del pago</h2>
      <p>
        Como la compra se hace a distancia, tienes derecho de retracto dentro de los <b>5 días hábiles</b> siguientes al pago
        (artículo 47 de la Ley 1480 de 2011, Estatuto del Consumidor). Para ejercerlo escribe a {L.email}. Te devolveremos el
        dinero dentro de los 30 días calendario siguientes.
      </p>
      <p>
        También puedes pedir la reversión del pago en los casos del artículo 51 de la Ley 1480 de 2011, presentando la queja ante
        nosotros y ante la entidad emisora del medio de pago dentro de los 5 días hábiles siguientes a la fecha en que conociste
        el problema.
      </p>
      <p>
        Los casos y plazos de devolución están en la{' '}
        <Link href="/reembolsos" className="text-brand-700 underline">
          Política de reembolsos
        </Link>
        .
      </p>

      <h2>8. Disponibilidad</h2>
      <p>
        Trabajamos para que el servicio esté disponible siempre, pero puede haber interrupciones por mantenimiento o por fallas
        de proveedores como Telegram, la nube o la inteligencia artificial. Si una falla nuestra deja el servicio sin funcionar
        por más de 72 horas seguidas, compensaremos con días adicionales de plan.
      </p>

      <h2>9. Responsabilidad</h2>
      <p>
        Hasta donde lo permita la ley, no respondemos por decisiones tomadas con base en las estimaciones del servicio, por
        errores de lectura que no se revisaron, ni por pérdidas indirectas. En ningún caso nuestra responsabilidad superará lo que
        hayas pagado en los últimos 12 meses. Nada de esto limita tus derechos como consumidor.
      </p>

      <h2>10. Cancelación y borrado</h2>
      <p>
        Puedes dejar de usar el servicio cuando quieras. Como no hay cobros automáticos, <b>no hay ninguna suscripción que
        cancelar</b>: si no vuelves a pagar, el plan simplemente vence. Puedes borrar tu cuenta o la familia completa tú mismo en el
        panel, en <b>🔒 Mis datos</b>, o escribiendo a {L.email}. Lo hacemos según la{' '}
        <Link href="/privacidad" className="text-brand-700 underline">
          Política de tratamiento de datos
        </Link>
        .
      </p>

      <h2>11. Comunicaciones</h2>
      <p>
        Solo te enviamos mensajes del servicio: los registros y alertas en el chat, el resumen mensual, avisos de vencimiento y
        cambios en estos documentos. No enviamos publicidad. Si en el futuro enviamos correos promocionales, será solo con tu
        autorización previa y cada correo tendrá un enlace para darte de baja con un clic.
      </p>

      <h2>12. Cambios a estos términos</h2>
      <p>
        Si hacemos cambios importantes, te pediremos aceptar la nueva versión antes de seguir usando el servicio.
      </p>

      <h2>13. Ley y contacto</h2>
      <p>
        Estos términos se rigen por las leyes de Colombia. Para dudas, quejas o reclamos: {L.email} · {L.phone} · {L.address},{' '}
        {L.city}.
      </p>
    </>
  )
}
