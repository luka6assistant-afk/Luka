import { Suspense } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { TRIAL_DAYS, REFERRAL_DAYS } from '@/lib/plans'
import { LegalLinks } from '@/components/legal-links'

export const metadata: Metadata = {
  title: 'Te invitaron a Luka — las cuentas de la casa',
  description: 'Manden la foto del recibo al grupo de la familia y Luka lleva las cuentas de la casa.',
}

/** Página a la que llega quien recibe un enlace de invitación de otra familia. */
export default function InvitacionPage({ params }: PageProps<'/r/[code]'>) {
  return (
    <main id="contenido" className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <Image src="/logo.png" alt="Luka" width={720} height={292} priority className="mx-auto h-14 w-auto" />
        <h1 className="mt-6 text-2xl font-bold text-ink">Te invitaron a Luka 🎁</h1>
        <p className="mt-2 text-slate-700">
          Manden la foto del recibo al grupo de Telegram de la familia y Luka lleva las cuentas de la casa.
        </p>
        <ul className="mt-6 space-y-2 text-left text-sm text-slate-700">
          <li>✅ {TRIAL_DAYS} días gratis, sin tarjeta.</li>
          <li>📸 Lee recibos, facturas, PDF y notas de voz.</li>
          <li>📅 Cada mes les llega al grupo el resumen con todos los movimientos.</li>
          <li>🎁 Cuando paguen su primer plan, ustedes y la familia que los invitó reciben {REFERRAL_DAYS} días gratis.</li>
        </ul>
        <Suspense fallback={<span className="btn mt-8 w-full">Crear cuenta gratis</span>}>
          <SignupButton params={params} />
        </Suspense>
        <Link href="/" className="mt-3 inline-block text-sm text-brand-700 underline">
          Ver cómo funciona
        </Link>
        <LegalLinks />
      </div>
    </main>
  )
}

async function SignupButton({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const ref = /^[A-Za-z0-9]{5,10}$/.test(code) ? code.toUpperCase() : ''
  return (
    <Link href={ref ? `/registro?ref=${ref}` : '/registro'} className="btn mt-8 w-full">
      Crear cuenta gratis
    </Link>
  )
}
