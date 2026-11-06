import Image from 'next/image'
import { Suspense } from 'react'
import Link from 'next/link'
import { requireFamily } from '@/lib/session'
import { getAccess } from '@/lib/plans'
import { signOut } from '@/app/actions'
import { NavLinks } from './nav'
import { LegalLinks } from '@/components/legal-links'
import { TelegramShell } from '@/components/telegram-shell'

async function FamilyBadge() {
  const { family, member } = await requireFamily()
  return (
    <div>
      <p className="font-semibold leading-tight">{family.name}</p>
      <p className="text-xs text-slate-500">
        {member.display_name} · {family.telegram_chat_id ? '🟢 Telegram conectado' : '⚪ Telegram sin vincular'}
      </p>
    </div>
  )
}

async function PlanBanner() {
  const { supabase, family } = await requireFamily()
  const a = await getAccess(supabase, family)
  if (!a.active)
    return (
      <Link href="/plan" className="mb-4 block rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        ⛔ {a.plan.id === 'trial' ? 'La prueba gratis terminó' : 'Tu plan venció'}: el bot dejó de leer recibos. <b>Renovar →</b>
      </Link>
    )
  if (a.daysLeft <= 3 || a.remaining <= a.plan.aiLimit * 0.1)
    return (
      <Link href="/plan" className="mb-4 block rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {a.daysLeft <= 3
          ? `⏳ ${a.plan.id === 'trial' ? 'La prueba termina' : 'El plan vence'} en ${a.daysLeft} día(s).`
          : `📦 Quedan ${a.remaining} lecturas con IA este mes.`}{' '}
        <b>Ver planes →</b>
      </Link>
    )
  return null
}

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-slate-200/70" />
        ))}
      </div>
      <div className="h-80 rounded-2xl bg-slate-200/70" />
    </div>
  )
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <TelegramShell />
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <Image src="/luka-icon.png" alt="Luka" width={36} height={36} className="h-9 w-9 rounded-full" />
            <Suspense fallback={<p className="font-semibold">Luka</p>}>
              <FamilyBadge />
            </Suspense>
          </div>
          <form action={signOut} className="tg-hide">
            <button className="text-sm text-slate-500 hover:text-slate-800">Salir</button>
          </form>
        </div>
        <NavLinks />
      </header>
      <main id="contenido" className="mx-auto max-w-6xl p-4 pb-16">
        <Suspense>
          <PlanBanner />
        </Suspense>
        <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-slate-600">
        Las proyecciones y planes son estimaciones informativas, no asesoría financiera.
        <LegalLinks />
      </footer>
    </div>
  )
}
