import type { Metadata } from 'next'
import Link from 'next/link'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = { title: 'Política de tratamiento de datos — Luka' }

const PROVIDERS = [
  ['Anthropic (Claude)', 'Lee con IA las fotos, PDF, mensajes y transcripciones para extraer el movimiento.', 'Imagen o texto enviado al bot, categorías y metas de la familia.', 'Estados Unidos'],
  ['Deepgram', 'Convierte las notas de voz en texto.', 'El audio de la nota de voz.', 'Estados Unidos'],
  ['Supabase', 'Base de datos, inicio de sesión y almacenamiento de las fotos de recibos.', 'Todos los datos de la cuenta y de la familia.', 'Brasil (São Paulo)'],
  ['Vercel', 'Aloja la aplicación y el bot.', 'Los datos pasan por sus servidores al usar el servicio; registros técnicos.', 'Brasil y Estados Unidos'],
  ['Telegram', 'Mensajería del chat familiar y del bot.', 'Los mensajes del chat y tu usuario de Telegram.', 'Según Telegram'],
  ['Meta (WhatsApp)', 'Mensajería con Luka por WhatsApp.', 'Tu número de WhatsApp, tu nombre de perfil y los mensajes, fotos y notas de voz que le envías a Luka.', 'Estados Unidos y otros países'],
  ['Wompi (Bancolombia)', 'Procesa los pagos de los planes.', 'Correo, valor y referencia del pago. Los datos de la tarjeta los recibe solo Wompi.', 'Colombia'],
] as const

export default function PrivacidadPage() {
  const L = LEGAL
  return (
    <>
      <h1>Política de tratamiento de datos personales</h1>
      <p className="text-sm text-slate-600">
        Versión {L.versions.privacidad} · Vigente desde el {L.effectiveDate}
      </p>

      <p>
        Esta política explica cómo {L.company} trata los datos personales de quienes usan {L.product}, en cumplimiento de la Ley
        Estatutaria 1581 de 2012, el Decreto 1377 de 2013 (compilado en el Decreto Único 1074 de 2015) y demás normas colombianas
        sobre protección de datos personales.
      </p>

      <h2>1. Responsable del tratamiento</h2>
      <ul>
        <li>Responsable: {L.company}</li>
        <li>Identificación: {L.nit}</li>
        <li>Domicilio: {L.address}, {L.city}</li>
        <li>Correo para consultas y reclamos: {L.email}</li>
        <li>Teléfono: {L.phone}</li>
      </ul>

      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li>
          <b>De identificación y contacto:</b> nombre, correo electrónico, y nombre e identificador de usuario de Telegram de
          quienes escriben en el chat vinculado, y número de WhatsApp y nombre de perfil de quienes le escriben a Luka por WhatsApp.
        </li>
        <li>
          <b>Financieros de la familia:</b> montos, fechas, comercios, descripciones, categorías, medios de pago, presupuestos y
          metas de ahorro.
        </li>
        <li>
          <b>Imágenes y documentos</b> que se envían al bot (recibos, facturas, comprobantes, capturas de pantalla) y la
          información que contienen.
        </li>
        <li>
          <b>Notas de voz</b> que se envían al bot y su transcripción a texto. El audio se usa solo para transcribirlo y no se
          guarda; se conserva el texto transcrito junto al movimiento.
        </li>
        <li>
          <b>De pago de la suscripción:</b> plan, valor, referencia y estado del pago. Los datos de la tarjeta o de la cuenta los
          recibe directamente la pasarela de pagos (Wompi); nosotros no los conocemos ni los guardamos.
        </li>
        <li>
          <b>Técnicos:</b> dirección IP y navegador al aceptar esta política (como prueba de tu autorización), y registros técnicos
          de errores.
        </li>
      </ul>
      <p>
        <b>Lo que no pedimos ni recolectamos:</b> número de cédula, claves o usuarios de tus bancos, ubicación, contactos,
        fotos de perfil ni datos de navegación con fines publicitarios. No usamos herramientas de analítica ni de publicidad de
        terceros. Si en una imagen aparece información que no necesitamos (por ejemplo, el número completo de una cuenta), no la
        extraemos ni la usamos.
      </p>
      <p>
        <b>Datos sensibles:</b> un recibo puede revelar información de salud (por ejemplo, una compra en farmacia o un pago
        médico). No es obligatorio enviar ese tipo de documentos ni responder preguntas sobre datos sensibles. Si los envías, nos
        autorizas de forma expresa a tratarlos solo para la finalidad de registrar el movimiento.
      </p>

      <h2>3. Para qué los usamos (finalidades)</h2>
      <ol>
        <li>Leer los recibos y mensajes, y registrar los movimientos de dinero de la familia.</li>
        <li>Calcular resúmenes, presupuestos, proyecciones y avances de ahorro, y enviar el resumen mensual al chat de la familia.</li>
        <li>Mostrar la información a los miembros de la misma familia, en el chat y en el panel web.</li>
        <li>Enviar avisos del servicio: alertas de presupuesto, vencimiento del plan y cambios en estos documentos.</li>
        <li>Gestionar la suscripción, los pagos y la facturación.</li>
        <li>Atender consultas, reclamos y solicitudes de soporte.</li>
        <li>Mantener la seguridad del servicio, prevenir fraude y cumplir obligaciones legales.</li>
        <li>Generar estadísticas agregadas y anónimas para mejorar el producto.</li>
      </ol>
      <p>No vendemos tus datos, no los usamos para publicidad y no te enviamos mensajes promocionales.</p>

      <h2>4. Uso de inteligencia artificial</h2>
      <ul>
        <li>
          <b>Qué hace la IA:</b> lee las fotos, PDF, mensajes y notas de voz que envías al bot para identificar el monto, la fecha,
          el comercio, la categoría y el medio de pago. También interpreta las correcciones que pides con ✏️ Editar. La lectura la
          hace Claude, de Anthropic, y la transcripción de voz la hace Deepgram.
        </li>
        <li>
          <b>Qué se envía:</b> solo el contenido que tú mandas al bot y la lista de categorías y metas de tu familia, para que pueda
          clasificar el movimiento. Los mensajes del grupo que no tienen montos no se envían a la IA.
        </li>
        <li>
          <b>Puede equivocarse:</b> por eso cada movimiento se puede confirmar, corregir o borrar. Si la lectura no es confiable, el
          movimiento queda <i>por confirmar</i> hasta que una persona lo revise.
        </li>
        <li>
          <b>No toma decisiones por ti:</b> la IA no aprueba créditos, no califica a nadie ni toma decisiones con efectos legales.
          Los resúmenes y proyecciones son informativos.
        </li>
        <li>
          <b>Entrenamiento:</b> según sus condiciones comerciales, Anthropic no usa esta información para entrenar sus modelos. A
          Deepgram le pedimos en cada nota de voz excluirla de su programa de mejora de modelos.
        </li>
      </ul>

      <h2>5. Quién más ve los datos (proveedores)</h2>
      <p>
        <b>Los demás miembros de tu familia</b> ven todos los movimientos de la familia, incluidos los que tú registres. Eso es
        parte esencial del servicio.
      </p>
      <p>
        Para prestar el servicio usamos estos <b>encargados del tratamiento</b>. Algunos procesan la información fuera de Colombia,
        lo que constituye una transmisión internacional de datos:
      </p>
      <div className="overflow-x-auto">
        <table className="mt-3 w-full text-left text-sm">
          <caption className="sr-only">Proveedores que tratan datos por cuenta de Luka</caption>
          <thead>
            <tr className="border-b border-slate-200">
              <th scope="col" className="py-2 pr-3">Proveedor</th>
              <th scope="col" className="pr-3">Para qué</th>
              <th scope="col" className="pr-3">Qué datos recibe</th>
              <th scope="col">Dónde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 align-top">
            {PROVIDERS.map(([name, what, data, where]) => (
              <tr key={name}>
                <td className="py-2 pr-3 font-medium">{name}</td>
                <td className="pr-3">{what}</td>
                <td className="pr-3">{data}</td>
                <td>{where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Exigimos a estos proveedores medidas de seguridad y confidencialidad. Al aceptar esta política autorizas esa
        transmisión. También podremos entregar información a autoridades cuando una norma o una orden lo exija.
      </p>

      <h2>6. Tus derechos</h2>
      <p>Como titular de los datos tienes derecho a:</p>
      <ul>
        <li>Conocer, actualizar y rectificar tus datos.</li>
        <li>Pedir prueba de la autorización que nos diste.</li>
        <li>Saber cómo hemos usado tus datos.</li>
        <li>Revocar la autorización o pedir que borremos tus datos, cuando no exista un deber legal o contractual de conservarlos.</li>
        <li>Acceder gratis a tus datos.</li>
        <li>
          Presentar quejas ante la Superintendencia de Industria y Comercio (SIC), después de haber hecho tu consulta o reclamo
          ante nosotros.
        </li>
      </ul>

      <h2>7. Cómo ejercerlos</h2>
      <p>
        <b>Tú mismo, en cualquier momento:</b> en el panel, en <b>🔒 Mis datos</b>, puedes descargar los movimientos de la familia
        y tus datos personales, borrar tu cuenta y, si eres administrador, borrar la familia completa. Desde Telegram, escribe
        /panel y entra a Mis datos.
      </p>
      <p>
        <b>Por correo:</b> escribe a <b>{L.email}</b> con tu nombre, el correo o usuario de Telegram con el que usas el servicio, tu
        solicitud y los documentos que quieras aportar.
      </p>
      <ul>
        <li>
          <b>Consultas:</b> las respondemos en máximo 10 días hábiles. Si no alcanzamos, te avisamos y respondemos dentro de los
          5 días hábiles siguientes.
        </li>
        <li>
          <b>Reclamos</b> (corrección, actualización, supresión o incumplimiento): los respondemos en máximo 15 días hábiles. Si
          no alcanzamos, te avisamos y respondemos dentro de los 8 días hábiles siguientes. Si el reclamo está incompleto, te
          pediremos completarlo dentro de los 5 días siguientes. Si pasan 2 meses sin respuesta, entenderemos que desististe.
        </li>
      </ul>

      <h2>8. Cómo das tu autorización</h2>
      <ul>
        <li>
          <b>Panel web:</b> al crear tu cuenta marcas la casilla de aceptación, que viene sin marcar. Guardamos la fecha, la versión
          aceptada, tu IP y tu navegador como prueba.
        </li>
        <li>
          <b>Panel dentro de Telegram:</b> al abrirlo, Telegram nos confirma tu identificador, nombre y usuario para darte acceso
          sin contraseña a los datos de tu familia. La primera vez te pedimos aceptar estos documentos con la casilla, igual que
          en el panel web.
        </li>
        <li>
          <b>Telegram:</b> la primera vez que escribes en un chat vinculado, el bot te muestra un aviso con el enlace a esta
          política y no procesa tu mensaje hasta que lo vuelvas a enviar. Si sigues enviando mensajes o imágenes al bot, nos
          autorizas mediante esa conducta inequívoca. Si no estás de acuerdo, no envíes información al bot y borra tus datos en
          Mis datos o escríbenos.
        </li>
      </ul>
      <p>Puedes revocar la autorización en cualquier momento borrando tu cuenta o escribiéndonos.</p>

      <h2>9. Menores de edad</h2>
      <p>
        El servicio está dirigido a mayores de 18 años. Si un menor participa en el chat familiar, su representante legal debe
        autorizarlo y velar por el respeto de sus derechos. No pedimos datos de menores más allá del nombre que muestre Telegram.
      </p>

      <h2>10. Cuánto tiempo los guardamos</h2>
      <p>
        Mientras la cuenta o la familia existan. Cuando borras tu cuenta o la familia desde Mis datos, los datos se eliminan de
        inmediato de la base de datos; las copias de seguridad de los proveedores se depuran en sus ciclos normales. Si lo pides por correo, lo hacemos dentro de los 30 días siguientes. Conservamos solo los comprobantes de pago, sin
        datos de la familia, por el tiempo que exigen las normas contables y tributarias (hasta 10 años).
      </p>

      <h2>11. Cookies</h2>
      <p>
        Solo usamos cookies necesarias para mantener tu sesión iniciada. No usamos cookies de publicidad ni de analítica. El detalle
        está en la{' '}
        <Link href="/cookies" className="text-brand-700 underline">
          Política de cookies
        </Link>
        .
      </p>

      <h2>12. Seguridad</h2>
      <p>
        La información viaja cifrada. Cada familia solo puede ver sus propios datos, y las imágenes se guardan en un almacenamiento
        privado al que se accede con enlaces temporales. Ningún sistema es infalible. Si ocurre un incidente que afecte tus datos,
        te avisaremos y lo informaremos a la SIC como exige la ley.
      </p>

      <h2>13. Cambios a esta política</h2>
      <p>
        Si hacemos cambios importantes, te avisaremos por el panel o por el chat y te pediremos aceptar la nueva versión antes de
        seguir usando el servicio.
      </p>
    </>
  )
}
