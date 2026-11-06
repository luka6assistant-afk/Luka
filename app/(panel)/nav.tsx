'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FEATURES } from '@/lib/features'

const LINKS = [
  { href: '/', label: '📊 Resumen' },
  { href: '/movimientos', label: '🧾 Movimientos' },
  { href: '/presupuesto', label: '🎯 Presupuesto' },
  ...(FEATURES.debts ? [{ href: '/deudas', label: '💳 Deudas' }] : []),
  { href: '/ahorros', label: '🐷 Metas' },
  { href: '/familia', label: '👨‍👩‍👧 Familia' },
  { href: '/plan', label: '💎 Plan' },
  { href: '/mis-datos', label: '🔒 Mis datos' },
]

export function NavLinks() {
  const path = usePathname()
  return (
    <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
      {LINKS.map((l) => {
        const active = l.href === '/' ? path === '/' : path.startsWith(l.href)
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
              active ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}
