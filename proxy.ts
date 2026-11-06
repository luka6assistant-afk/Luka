import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_OPTIONS } from './lib/supabase/cookie-options'

const PUBLIC_PATHS = ['/inicio', '/r/', '/robots.txt', '/sitemap.xml', '/login', '/registro', '/terminos', '/privacidad', '/reembolsos', '/cookies', '/tg', '/api/']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const path = request.nextUrl.pathname
  // Webhooks y cron se autentican con su propia firma o secreto
  if (path.startsWith('/api/')) return response

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p))
  // Sin sesión, la portada es la página de presentación (la URL sigue siendo "/")
  if (!user && path === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/inicio'
    return NextResponse.rewrite(url)
  }
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = path === '/' ? '' : `?next=${encodeURIComponent(path)}`
    return NextResponse.redirect(url)
  }
  if (user && (path === '/login' || path === '/registro')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
