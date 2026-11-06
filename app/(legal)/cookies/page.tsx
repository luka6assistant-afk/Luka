import type { Metadata } from 'next'
import Link from 'next/link'
import { LEGAL } from '@/lib/legal'

export const metadata: Metadata = { title: 'Política de cookies — Luka' }

const ITEMS = [
  ['sb-…-auth-token', 'Cookie', 'Mantiene tu sesión iniciada en el panel.', 'Necesaria', 'Hasta que cierres sesión (máximo 400 días)'],
  ['luka-aviso-cookies', 'Almacenamiento local del navegador', 'Recuerda que ya viste el aviso de cookies, para no mostrarlo otra vez.', 'Necesaria', 'Hasta que borres los datos del navegador'],
  ['tg-mini-app', 'Almacenamiento de sesión del navegador', 'Indica que abriste el panel desde Telegram, para adaptar la pantalla.', 'Necesaria', 'Hasta que cierres el panel'],
] as const

export default function CookiesPage() {
  return (
    <>
      <h1>Política de cookies</h1>
      <p className="text-sm text-slate-600">Vigente desde el {LEGAL.effectiveDate}</p>

      <p>
        Las cookies son pequeños archivos que un sitio guarda en tu navegador. {LEGAL.product} usa <b>solo las necesarias</b> para
        que puedas iniciar sesión y usar el panel. <b>No usamos cookies de publicidad, de analítica ni de redes sociales</b>, y no
        compartimos información de tu navegación con nadie.
      </p>

      <h2>Qué guardamos en tu navegador</h2>
      <div className="overflow-x-auto">
        <table className="mt-3 w-full text-left text-sm">
          <caption className="sr-only">Cookies y almacenamiento que usa Luka</caption>
          <thead>
            <tr className="border-b border-slate-200">
              <th scope="col" className="py-2 pr-3">Nombre</th>
              <th scope="col" className="pr-3">Tipo</th>
              <th scope="col" className="pr-3">Para qué</th>
              <th scope="col" className="pr-3">Clase</th>
              <th scope="col">Duración</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 align-top">
            {ITEMS.map(([name, type, what, kind, time]) => (
              <tr key={name}>
                <td className="py-2 pr-3 font-mono text-xs">{name}</td>
                <td className="pr-3">{type}</td>
                <td className="pr-3">{what}</td>
                <td className="pr-3">{kind}</td>
                <td>{time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Sitios de terceros</h2>
      <ul>
        <li>
          <b>Telegram:</b> cuando abres el panel dentro de Telegram, se carga el archivo oficial de Telegram para Mini Apps
          (telegram.org), necesario para que el panel funcione ahí.
        </li>
        <li>
          <b>Wompi:</b> al pagar sales a la página de pago de Wompi, que usa sus propias cookies según su política.
        </li>
      </ul>

      <h2>Por qué no te pedimos aceptar</h2>
      <p>
        Las cookies necesarias son indispensables para prestar el servicio que pediste, por eso no requieren tu autorización. Te
        mostramos un aviso para que sepas que existen. Si algún día usamos cookies opcionales (por ejemplo, de analítica), te
        pediremos permiso antes, con la opción de rechazarlas tan fácil como aceptarlas.
      </p>

      <h2>Cómo borrarlas</h2>
      <p>
        Puedes borrarlas desde la configuración de tu navegador. Si borras la cookie de sesión, tendrás que volver a iniciar sesión.
        Más información en la{' '}
        <Link href="/privacidad" className="text-brand-700 underline">
          Política de tratamiento de datos
        </Link>
        .
      </p>
    </>
  )
}
