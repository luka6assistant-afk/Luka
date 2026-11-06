import type { MetadataRoute } from 'next'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://luka6assistant.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: ['/', '/terminos', '/privacidad', '/reembolsos', '/cookies'], disallow: ['/api/', '/admin/', '/r/', '/tg'] },
    sitemap: `${APP_URL}/sitemap.xml`,
  }
}
