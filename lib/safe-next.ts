/** Solo rutas internas (evita redirecciones abiertas a otros sitios). */
export function safeNext(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/')) return null
  // "//sitio.com" y "/\sitio.com" los navegadores los interpretan como otro dominio
  if (value.startsWith('//') || value.startsWith('/\\')) return null
  return value
}
