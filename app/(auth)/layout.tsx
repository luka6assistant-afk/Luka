import Image from 'next/image'
import { LegalLinks } from '@/components/legal-links'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="contenido" className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1>
            <Image src="/logo.png" alt="Luka" width={720} height={292} priority className="mx-auto h-16 w-auto" />
          </h1>
          <p className="mt-3 text-sm text-slate-500">Las finanzas de la casa, desde el chat</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
        <LegalLinks />
      </div>
    </main>
  )
}
