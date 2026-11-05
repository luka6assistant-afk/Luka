import type { Metadata } from 'next'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = { title: 'Política de tratamiento de datos — Luka' }

export default function PrivacidadPage() {
  const L = LEGAL
  return (
    <>
      <h1>Política de tratamiento de datos personales</h1>
      <p className="text-sm text-slate-500">
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
          quienes escriben en el chat vinculado.
        </li>
        <li>
          <b>Financieros de la familia:</b> montos, fechas, comercios, descripciones, categorías, medios de pago, presupuestos,
          deudas (saldos, tasas, cuotas) y metas de ahorro.
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
          <b>Técnicos:</b> dirección IP y navegador al aceptar esta política, registros de uso y errores.
        </li>
      </ul>
      <p>
        <b>Datos sensibles:</b> un recibo puede revelar información de salud (por ejemplo, una compra en farmacia o un pago
        médico). No es obligatorio enviar ese tipo de documentos ni responder preguntas sobre datos sensibles. Si los envías, nos
        autorizas de forma expresa a tratarlos solo para la finalidad de registrar el movimiento.
      </p>

      <h2>3. Para qué los usamos (finalidades)</h2>
      <ol>
        <li>Leer los recibos y mensajes, y registrar los movimientos de dinero de la familia.</li>
        <li>Calcular resúmenes, presupuestos, proyecciones, planes de pago de deudas y avances de ahorro.</li>
        <li>Mostrar la información a los miembros de la misma familia, en el chat y en el panel web.</li>
        <li>Enviar avisos del servicio: alertas de presupuesto, vencimiento del plan y cambios en estos documentos.</li>
        <li>Gestionar la suscripción, los pagos y la facturación.</li>
        <li>Atender consultas, reclamos y solicitudes de soporte.</li>
        <li>Mantener la seguridad del servicio, prevenir fraude y cumplir obligaciones legales.</li>
        <li>Generar estadísticas agregadas y anónimas para mejorar el producto.</li>
      </ol>
      <p>No vendemos tus datos ni los usamos para publicidad de terceros.</p>

      <h2>4. Quién más ve los datos</h2>
      <p>
        <b>Los demás miembros de tu familia</b> ven todos los movimientos de la familia, incluidos los que tú registres. Eso es
        parte esencial del servicio.
      </p>
      <p>
        Para prestar el servicio usamos estos <b>encargados del tratamiento</b>. Algunos guardan o procesan la información fuera
        de Colombia, por ejemplo en Estados Unidos o en la Unión Europea, lo que constituye una transmisión internacional de
        datos:
      </p>
      <ul>
        <li>Supabase: base de datos, autenticación y almacenamiento de las imágenes.</li>
        <li>Vercel: alojamiento de la aplicación.</li>
        <li>
          Anthropic (Claude): lectura automática de los recibos y mensajes con inteligencia artificial. Según sus condiciones
          comerciales, no usa esta información para entrenar sus modelos.
        </li>
        <li>Deepgram: transcripción de las notas de voz a texto.</li>
        <li>Telegram: mensajería del chat familiar.</li>
        <li>Wompi (Bancolombia): procesamiento de los pagos.</li>
      </ul>
      <p>
        Exigimos a estos proveedores medidas de seguridad y confidencialidad. Al aceptar esta política autorizas esa
        transmisión. También podremos entregar información a autoridades cuando una norma o una orden lo exija.
      </p>

      <h2>5. Tus derechos</h2>
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

      <h2>6. Cómo ejercerlos</h2>
      <p>
        Escribe a <b>{L.email}</b> con tu nombre, el correo o usuario de Telegram con el que usas el servicio, tu solicitud y los
        documentos que quieras aportar.
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

      <h2>7. Cómo das tu autorización</h2>
      <ul>
        <li>
          <b>Panel web:</b> al crear tu cuenta marcas la casilla de aceptación. Guardamos la fecha, la versión aceptada, tu IP y
          tu navegador como prueba.
        </li>
        <li>
          <b>Panel dentro de Telegram:</b> al abrirlo, Telegram nos confirma tu identificador, nombre y usuario para darte acceso
          sin contraseña a los datos de tu familia. La primera vez te pedimos aceptar estos documentos con la casilla, igual que
          en el panel web.
        </li>
        <li>
          <b>Telegram:</b> la primera vez que escribes en un chat vinculado, el bot te muestra un aviso con el enlace a esta
          política. Si sigues enviando mensajes o imágenes al bot, nos autorizas mediante esa conducta inequívoca. Si no estás
          de acuerdo, no envíes información al bot y escríbenos para borrar tus datos.
        </li>
      </ul>

      <h2>8. Menores de edad</h2>
      <p>
        El servicio está dirigido a mayores de 18 años. Si un menor participa en el chat familiar, su representante legal debe
        autorizarlo y velar por el respeto de sus derechos. No pedimos datos de menores más allá del nombre que muestre Telegram.
      </p>

      <h2>9. Cuánto tiempo los guardamos</h2>
      <p>
        Mientras la familia tenga cuenta activa. Si se cancela o se pide el borrado, eliminamos los datos dentro de los 30 días
        siguientes. Conservamos solo los registros de pagos y facturación por el tiempo que exigen las normas contables y
        tributarias, hasta 10 años.
      </p>

      <h2>10. Seguridad</h2>
      <p>
        La información viaja cifrada. Cada familia solo puede ver sus propios datos, y las imágenes se guardan en un almacenamiento
        privado al que se accede con enlaces temporales. Ningún sistema es infalible. Si ocurre un incidente que afecte tus datos,
        te avisaremos y lo informaremos a la SIC como exige la ley.
      </p>

      <h2>11. Cambios a esta política</h2>
      <p>
        Si hacemos cambios importantes, te avisaremos por el panel o por el chat y te pediremos aceptar la nueva versión antes de
        seguir usando el servicio.
      </p>
    </>
  )
}
