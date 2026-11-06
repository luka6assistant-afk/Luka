import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { TelegramTutorial } from '@/components/telegram-tutorial'
import { LegalLinks } from '@/components/legal-links'

export const metadata: Metadata = {
  title: 'Cómo conectar Luka a tu grupo de Telegram',
  description: 'Video paso a paso para agregar a Luka al grupo de Telegram de la familia.',
}

const BOT = process.env.TELEGRAM_BOT_USERNAME || 'LukaFamiliaBot'

const FAQ = [
  ['No tengo Telegram', 'Es gratis. Descárgalo en telegram.org/apps (Android, iPhone o computador), crea tu cuenta con tu número de celular y vuelve al panel.'],
  [
    'El botón no abre Telegram',
    'Ábrelo desde el celular donde tienes Telegram instalado. Si estás en el computador, usa Telegram Desktop o haz la conexión a mano (pasos de abajo).',
  ],
  ['¿Puedo usar un grupo que ya tenemos?', 'Sí. Cuando Telegram te pida elegir un grupo, selecciona ese en lugar de crear uno nuevo.'],
  [
    '¿Quién debe hacer la conexión?',
    'La persona que administra la familia en el panel (el botón solo le aparece a ella). Los demás solo tienen que estar en el grupo.',
  ],
  ['Luka no responde en el grupo', 'Revisa que Luka siga siendo miembro del grupo y que en el panel, en Familia, diga «El chat familiar está conectado».'],
  ['Queremos cambiar de grupo', 'En el panel → Familia, el administrador toca «Desvincular chat» y luego vuelve a conectar con el grupo nuevo.'],
] as const

export default function ComoConectarPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" aria-label="Luka, inicio">
            <Image src="/logo.png" alt="Luka" width={720} height={292} className="h-8 w-auto" />
          </Link>
          <Link href="/familia" className="btn">
            Ir al panel
          </Link>
        </div>
      </header>

      <main id="contenido" className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-center text-3xl font-bold text-ink">Conecta Luka al grupo de tu familia</h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-slate-700">
          Toma menos de un minuto. Solo lo hace una vez la persona que administra la familia.
        </p>

        <div className="mt-10 grid items-start gap-10 md:grid-cols-2">
          <TelegramTutorial botName={BOT} />
          <div className="space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-ink">Con el botón (recomendado)</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-slate-700">
                <li>Desde el celular con Telegram, entra al panel → <b>Familia</b>.</li>
                <li>
                  Toca <b>➕ Conectar con Telegram</b>.
                </li>
                <li>
                  Telegram se abre: toca <b>Crear grupo nuevo</b> o elige el grupo de la familia.
                </li>
                <li>Si es nuevo, ponle nombre y agrega a los miembros de tu familia.</li>
                <li>
                  Confirma <b>Agregar</b>. Luka escribe «✅ ¡Listo! Este grupo quedó conectado».
                </li>
              </ol>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-ink">A mano (si el botón no funciona)</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-slate-700">
                <li>En Telegram abre el grupo de la familia (o créalo).</li>
                <li>
                  Toca el nombre del grupo → <b>Agregar miembros</b> → busca <b>@{BOT}</b> y agrégalo.
                </li>
                <li>
                  Escribe en el grupo <b>/vincular</b> seguido del código que aparece en el panel → Familia.
                </li>
              </ol>
            </section>
          </div>
        </div>

        <section className="mx-auto mt-14 max-w-2xl">
          <h2 className="text-center text-2xl font-bold text-ink">Si algo no funciona</h2>
          <div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">
                  {q}
                  <span aria-hidden className="text-xl text-brand-700 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-slate-700">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="px-4 pb-8">
        <LegalLinks />
      </footer>
    </div>
  )
}
