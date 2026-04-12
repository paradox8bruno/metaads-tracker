import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const APP_SECRET = process.env.APP_SECRET || 'metaads2024'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Webhooks não precisam de autenticação
  if (pathname.startsWith('/api/webhooks')) {
    return NextResponse.next()
  }

  // A rota de autenticação precisa permanecer pública para permitir login/logout
  if (pathname === '/api/auth') {
    return NextResponse.next()
  }

  // Rota de login não precisa de autenticação
  if (pathname === '/login') {
    return NextResponse.next()
  }

  // Verifica cookie de sessão
  const session = request.cookies.get('session')?.value

  if (session !== APP_SECRET) {
    // Se for chamada de API, retorna 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    // Redireciona para login
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
