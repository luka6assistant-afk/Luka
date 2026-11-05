/**
 * Datos del responsable del tratamiento y versiones de los documentos legales.
 * ⚠️ Completa los datos reales (variables de entorno o aquí) antes de publicar.
 * Si cambias el contenido de los términos o la política, sube la versión:
 * se le pedirá a cada usuario aceptarla de nuevo.
 */
export const LEGAL = {
  company: process.env.NEXT_PUBLIC_LEGAL_COMPANY || '[RAZÓN SOCIAL O NOMBRE DEL TITULAR]',
  nit: process.env.NEXT_PUBLIC_LEGAL_NIT || '[NIT / C.C.]',
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || '[DIRECCIÓN]',
  city: process.env.NEXT_PUBLIC_LEGAL_CITY || 'Bogotá D.C., Colombia',
  email: process.env.NEXT_PUBLIC_LEGAL_EMAIL || '[CORREO DE CONTACTO]',
  phone: process.env.NEXT_PUBLIC_LEGAL_PHONE || '[TELÉFONO]',
  product: 'Luka',
  effectiveDate: '5 de noviembre de 2026',
  versions: {
    terminos: '2026-11-05',
    privacidad: '2026-11-05',
  },
} as const

export type LegalDoc = keyof typeof LEGAL.versions
