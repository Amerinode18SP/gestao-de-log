import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rotas públicas (login + fluxo de recuperação/convite)
  // /redefinir-senha e /esqueci-senha precisam estar aqui pra que o link
  // do email do Supabase consiga abrir antes da sessao estar estabelecida.
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/esqueci-senha') ||
    pathname.startsWith('/redefinir-senha') ||
    pathname.startsWith('/aceitar-convite') ||
    pathname.startsWith('/api/')
  ) {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|esqueci-senha|redefinir-senha|aceitar-convite).*)'],
}
