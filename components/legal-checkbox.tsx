import Link from 'next/link'

/** Casilla de aceptación: debe ser previa, expresa e informada (Ley 1581 de 2012). Nunca viene marcada. */
export function LegalCheckbox() {
  return (
    <label className="flex items-start gap-2 text-xs text-slate-600">
      <input type="checkbox" name="accept" required className="mt-0.5 h-4 w-4 accent-brand-600" />
      <span>
        Soy mayor de edad, acepto los{' '}
        <Link href="/terminos" target="_blank" className="font-medium text-brand-700 underline">
          Términos y condiciones
        </Link>{' '}
        y autorizo el tratamiento de mis datos y los de mi familia, incluida su transmisión a proveedores fuera de Colombia,
        según la{' '}
        <Link href="/privacidad" target="_blank" className="font-medium text-brand-700 underline">
          Política de tratamiento de datos
        </Link>
        .
      </span>
    </label>
  )
}
