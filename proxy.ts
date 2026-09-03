import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // Il webhook di Telegram arriva dai server di Telegram, senza cookie di
  // sessione: si autentica da solo con il secret condiviso, quindi va escluso
  // dal controllo di autenticazione (altrimenti verrebbe rediretto a /landing).
  if (request.nextUrl.pathname.startsWith('/api/telegram/')) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Route raggiungibili senza autenticazione: la vetrina pubblica e il login.
  const PUBLIC_PATHS = ['/landing', '/login']
  const isPublic = PUBLIC_PATHS.includes(request.nextUrl.pathname)

  // Visitatore non autenticato su una route privata → mandalo alla vetrina.
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/landing'
    return NextResponse.redirect(url)
  }

  // Utente già autenticato che apre vetrina o login → portalo in home.
  if (user && isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
