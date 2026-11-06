import Link from 'next/link'

const LINKS = [
  ['/terminos', 'Términos y condiciones'],
  ['/privacidad', 'Política de tratamiento de datos'],
  ['/reembolsos', 'Reembolsos'],
  ['/cookies', 'Cookies'],
] as const

export function LegalLinks() {
  return (
    <nav aria-label="Documentos legales" className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-600">
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} className="underline-offset-2 hover:underline">
          {label}
        </Link>
      ))}
    </nav>
  )
}
