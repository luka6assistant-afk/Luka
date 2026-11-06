import type { MetadataRoute } from 'next'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://luka6assistant.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/como-conectar', '/registro', '/terminos', '/privacidad', '/reembolsos', '/cookies'].map((p) => ({ url: `${APP_URL}${p}` }))
}
