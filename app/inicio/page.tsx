import { Suspense } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { connection } from 'next/server'
import { FOUNDER, PLANS, REFERRAL_DAYS, TRIAL_DAYS } from '@/lib/plans'
import { money } from '@/lib/format'
import { founderSlots } from '@/lib/growth'
import { LegalLinks } from '@/components/legal-links'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://luka6assistant.vercel.app'
const DESCRIPTION = `Manden la foto del recibo al grupo de Telegram de la familia y Luka registra el gasto, lo clasifica y les avisa si se pasan del presupuesto. ${TRIAL_DAYS} días gratis.`

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: 'Luka — las cuentas de la casa, desde el chat',
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Luka — las cuentas de la casa, desde el chat',
    description: DESCRIPTION,
    url: '/',
    siteName: 'Luka',
    locale: 'es_CO',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Luka: las cuentas de la casa, desde el chat' }],
  },
}

const STEPS = [
  ['1', 'Creen la familia', 'Regístrense gratis y agreguen a Luka al grupo de Telegram de la familia.'],
  ['2', 'Manden lo que pagan', 'La foto del recibo, la factura, el PDF del banco, una nota de voz o un mensaje como «mercado 85.000 en el D1».'],
  ['3', 'Vean a dónde se va la plata', 'Luka registra y clasifica cada gasto, les avisa si se pasan del presupuesto y el día 1 les manda el resumen del mes.'],
] as const

const FEATURES = [
  ['📸', 'Lee lo que envíen', 'Recibos, facturas electrónicas, comprobantes de Nequi, Daviplata o bancos, PDF y notas de voz.'],
  ['🎯', 'Presupuesto con alertas', 'Definan cuánto gastar por categoría. Luka avisa en el chat al llegar al 80 % y cuando se pasan.'],
  ['📅', 'Resumen del mes', 'El día 1 llega al grupo cuánto entró, cuánto salió, en qué se fue la plata y un archivo para Excel.'],
  ['📊', 'Panel dentro de Telegram', 'Gráficos, movimientos y filtros sin salir del chat y sin contraseña.'],
  ['🐷', 'Metas de ahorro', 'Vacaciones, fondo de emergencia o la Navidad: cuánto apartar cada mes para llegar a tiempo.'],
  ['👨‍👩‍👧', 'Toda la familia', 'Cada quien registra lo suyo y todos ven el mismo resumen. Quien administra decide presupuestos y metas.'],
] as const

const FAQ = [
  ['¿Necesito Telegram?', 'Sí. Luka funciona en un grupo de Telegram, que es gratis en celular y computador. El panel se abre dentro del mismo chat.'],
  [
    '¿Qué pasa cuando termina la prueba?',
    `Nada se cobra solo: no pedimos tarjeta. Si no eligen un plan, Luka deja de leer recibos, pero sus datos se conservan y pueden seguir viendo el panel.`,
  ],
  ['¿Cómo cancelo?', 'No hay suscripción que cancelar: cada pago es por un mes o un año y no se renueva solo. Si no vuelven a pagar, el plan simplemente vence.'],
  [
    '¿Quién ve nuestra información?',
    'Solo los miembros de su familia. No vendemos datos ni mostramos publicidad. La inteligencia artificial solo lee lo que ustedes le envían al bot, y pueden descargar o borrar todo cuando quieran.',
  ],
  ['¿Y si la IA se equivoca?', 'Cada registro trae botones para confirmar, corregir o borrar. Si la lectura no es clara, el movimiento queda «por confirmar» hasta que alguien lo revise.'],
  ['¿Es asesoría financiera?', 'No. Luka organiza la información y hace estimaciones informativas; las decisiones son de cada familia.'],
  [
    '¿Cómo funciona el precio de fundador?',
    `Las primeras ${FOUNDER.limit} familias que paguen el plan ${PLANS[FOUNDER.plan].name} lo tienen a ${money(FOUNDER.monthlyPrice)} al mes o ${money(FOUNDER.yearlyPrice)} al año para siempre, aunque los precios suban.`,
  ],
] as const

export default function InicioPage() {
  return (
    <div className="bg-white text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" aria-label="Luka, inicio">
            <Image src="/logo.png" alt="Luka" width={720} height={292} priority className="h-9 w-auto" />
          </Link>
          <nav aria-label="Secciones" className="hidden gap-6 text-sm text-slate-700 md:flex">
            <a href="#como-funciona" className="hover:text-ink">Cómo funciona</a>
            <a href="#precios" className="hover:text-ink">Precios</a>
            <a href="#preguntas" className="hover:text-ink">Preguntas</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Entrar
            </Link>
            <Link href="/registro" className="btn">
              Probar gratis
            </Link>
          </div>
        </div>
      </header>

      <main id="contenido">
        {/* Portada */}
        <section className="bg-gradient-to-b from-brand-50 to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
            <div>
              <p className="mb-3 inline-block rounded-full bg-white px-3 py-1 text-sm font-medium text-brand-700 shadow-sm">
                Hecho para familias colombianas
              </p>
              <h1 className="text-4xl font-bold leading-tight text-ink md:text-5xl">Las cuentas de la casa, desde el chat de la familia</h1>
              <p className="mt-5 text-lg text-slate-700">
                Manden la foto del recibo al grupo de Telegram y Luka registra el gasto, lo clasifica y les avisa si se están pasando del
                presupuesto. Sin llenar hojas de cálculo.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/registro" className="btn px-6 py-3 text-base">
                  Probar {TRIAL_DAYS} días gratis
                </Link>
                <a href="#como-funciona" className="btn-ghost px-5 py-3 text-base">
                  Ver cómo funciona
                </a>
              </div>
              <p className="mt-3 text-sm text-slate-600">Sin tarjeta · No se renueva solo · Sus datos son de su familia</p>
            </div>
            <ChatDemo />
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 md:py-20">
          <h2 className="text-center text-3xl font-bold text-ink">Así de fácil</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map(([n, title, text]) => (
              <li key={n} className="rounded-2xl border border-slate-200 p-6">
                <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
                  {n}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-slate-700">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Funciones */}
        <section className="bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
            <h2 className="text-center text-3xl font-bold text-ink">Todo lo que necesita la plata de la casa</h2>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(([icon, title, text]) => (
                <li key={title} className="rounded-2xl bg-white p-6 shadow-sm">
                  <span aria-hidden className="text-3xl">{icon}</span>
                  <h3 className="mt-3 font-semibold text-ink">{title}</h3>
                  <p className="mt-1 text-sm text-slate-700">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Precios */}
        <section id="precios" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 md:py-20">
          <h2 className="text-center text-3xl font-bold text-ink">Precios claros</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-700">
            Empiecen con {TRIAL_DAYS} días gratis. Después pagan por mes o por año: precio final, sin cargos adicionales y sin renovación
            automática.
          </p>
          <Suspense fallback={<p className="mt-6 text-center text-sm text-slate-600">&nbsp;</p>}>
            <FounderNote />
          </Suspense>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <PriceCard
              title="Prueba gratis"
              price="$0"
              period={`${TRIAL_DAYS} días`}
              items={['Todo incluido', `Hasta ${PLANS.trial.aiLimit} lecturas con IA al mes`, 'Sin tarjeta']}
            />
            <PriceCard
              title={PLANS.familia.name}
              price={money(PLANS.familia.monthlyPrice)}
              period="al mes"
              yearly={`o ${money(PLANS.familia.yearlyPrice)} al año`}
              founder={`Fundadores: ${money(FOUNDER.monthlyPrice)} al mes para siempre`}
              items={PLANS.familia.features}
            />
            <PriceCard
              title={PLANS.plus.name}
              price={money(PLANS.plus.monthlyPrice)}
              period="al mes"
              yearly={`o ${money(PLANS.plus.yearlyPrice)} al año`}
              items={PLANS.plus.features}
            />
          </div>
          <p className="mt-6 text-center text-sm text-slate-600">
            Una lectura es cada foto, PDF, mensaje con monto o nota de voz que lee la IA. 🎁 Inviten a otra familia: cuando pague su
            primer plan, las dos reciben {REFERRAL_DAYS} días gratis.
          </p>
        </section>

        {/* Confianza */}
        <section className="bg-ink text-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-4">
            <h2 className="text-2xl font-bold md:col-span-1">Sus datos son de su familia</h2>
            <ul className="grid gap-4 text-sm text-slate-100 sm:grid-cols-3 md:col-span-3">
              <li>🔒 Solo los miembros de su familia ven la información. No vendemos datos ni mostramos publicidad.</li>
              <li>🤖 La inteligencia artificial solo lee lo que ustedes envían al bot, para registrar el movimiento.</li>
              <li>🗑️ Pueden descargar o borrar todos sus datos cuando quieran, desde el panel.</li>
            </ul>
          </div>
        </section>

        {/* Preguntas */}
        <section id="preguntas" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16 md:py-20">
          <h2 className="text-center text-3xl font-bold text-ink">Preguntas frecuentes</h2>
          <div className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">
                  {q}
                  <span aria-hidden className="text-xl text-brand-700 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-slate-700">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Llamado final */}
        <section className="bg-brand-50">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center">
            <h2 className="text-3xl font-bold text-ink">Este mes, sepan a dónde se fue la plata</h2>
            <p className="mt-3 text-slate-700">Creen la familia, agreguen a Luka al grupo y manden el primer recibo.</p>
            <Link href="/registro" className="btn mt-8 px-6 py-3 text-base">
              Probar {TRIAL_DAYS} días gratis
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 px-4 py-8 text-center text-xs text-slate-600">
        <p>Luka organiza información y hace estimaciones informativas; no es asesoría financiera.</p>
        <LegalLinks />
      </footer>
    </div>
  )
}

async function FounderNote() {
  await connection()
  const { remaining } = await founderSlots().catch(() => ({ remaining: 0 }))
  if (remaining <= 0) return null
  return (
    <p className="mx-auto mt-6 max-w-2xl rounded-2xl border border-brand-100 bg-brand-50 p-4 text-center text-sm text-brand-700">
      🌱 <b>Precio de fundador:</b> las primeras {FOUNDER.limit} familias que paguen el plan {PLANS[FOUNDER.plan].name} lo tienen a{' '}
      {money(FOUNDER.monthlyPrice)} al mes para siempre. Quedan <b>{remaining}</b> cupos.
    </p>
  )
}

function PriceCard(props: { title: string; price: string; period: string; yearly?: string; founder?: string; items: readonly string[] }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 p-6">
      <h3 className="text-lg font-semibold text-ink">{props.title}</h3>
      <p className="mt-3">
        <span className="text-3xl font-bold tabular-nums text-ink">{props.price}</span>
        <span className="text-slate-600"> {props.period}</span>
      </p>
      {props.yearly && <p className="text-sm text-slate-600">{props.yearly} (2 meses gratis)</p>}
      {props.founder && <p className="mt-2 text-sm font-medium text-brand-700">🌱 {props.founder}</p>}
      <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-700">
        {props.items.map((i) => (
          <li key={i}>✓ {i}</li>
        ))}
      </ul>
      <Link href="/registro" className="btn-ghost mt-6 w-full">
        Empezar gratis
      </Link>
    </div>
  )
}

/** Ilustración de una conversación con el bot (no son datos reales). */
function ChatDemo() {
  return (
    <figure className="mx-auto w-full max-w-sm">
      <div className="rounded-[2rem] border-8 border-ink bg-[#e7ebe4] p-4 shadow-xl">
        <div className="mb-3 flex items-center gap-2 border-b border-black/10 pb-3">
          <Image src="/luka-icon.png" alt="" width={32} height={32} className="h-8 w-8 rounded-full bg-white" />
          <div>
            <p className="text-sm font-semibold text-ink">Familia Pérez</p>
            <p className="text-xs text-slate-600">Ana, Juan, Luka</p>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-[#d9fdd3] p-3">
            <div className="mb-2 flex h-20 items-center justify-center rounded-lg bg-white/70 text-3xl" aria-hidden>
              🧾
            </div>
            <p className="text-slate-800">Mercado de la semana</p>
          </div>
          <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-white p-3 shadow-sm">
            <p className="font-semibold text-slate-800">✅ Registrado · Gasto</p>
            <p className="mt-1 text-slate-700">💵 <b>$185.400</b></p>
            <p className="text-slate-700">🏪 Supermercado · 🏷 🛒 Mercado</p>
            <p className="text-slate-700">📅 Hoy · 👤 Ana · Nequi</p>
            <div className="mt-2 grid grid-cols-2 gap-1 text-center text-xs font-medium text-brand-700">
              <span className="rounded-md bg-slate-100 py-1">✏️ Editar</span>
              <span className="rounded-md bg-slate-100 py-1">🏷 Categoría</span>
            </div>
          </div>
          <div className="max-w-[88%] rounded-2xl rounded-bl-sm bg-white p-3 text-slate-700 shadow-sm">
            ⚠️ Mercado: van en 82 % del presupuesto del mes.
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-slate-600">Ejemplo de cómo responde Luka en el grupo</figcaption>
    </figure>
  )
}
