import Link from 'next/link'

export function LegalLinks() {
  return (
    <p className="mt-4 flex justify-center gap-4 text-xs text-slate-500">
      <Link href="/terminos" className="hover:underline">
        Términos y condiciones
      </Link>
      <Link href="/privacidad" className="hover:underline">
        Política de tratamiento de datos
      </Link>
    </p>
  )
}
