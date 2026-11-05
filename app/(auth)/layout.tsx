import { LegalLinks } from '@/components/legal-links'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-4xl">🧾</div>
          <h1 className="mt-2 text-xl font-bold">Luka</h1>
          <p className="text-sm text-slate-500">Las finanzas de la casa, desde el chat</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
        <LegalLinks />
      </div>
    </main>
  )
}
