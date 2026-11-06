import Link from 'next/link'
import Image from 'next/image'

/** Panel del creador (solo correos en ADMIN_EMAILS; cada página lo verifica). */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Image src="/luka-icon.png" alt="" width={32} height={32} className="h-8 w-8 rounded-full" />
            Luka · Creador
          </Link>
          <nav aria-label="Panel del creador" className="flex gap-1 text-sm">
            <Link href="/admin/cuentas" className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100">
              👥 Cuentas
            </Link>
            <Link href="/admin/fuentes" className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100">
              📣 Fuentes
            </Link>
            <Link href="/admin/metricas" className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100">
              📈 Métricas
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  )
}
