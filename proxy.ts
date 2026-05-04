import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/webhooks')) {
    return NextResponse.next()
  }

  if (pathname === '/api/auth') {
    return NextResponse.next()
  }

  if (pathname === '/login') {
    return NextResponse.next()
  }

  // Lido dentro da função para funcionar corretamente com testes e Edge Runtime
  const appSecret = process.env.APP_SECRET

  if (!appSecret) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'APP_SECRET não configurada.' }, { status: 500 })
    }

    return new NextResponse('APP_SECRET não configurada.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const session = request.cookies.get('session')?.value

  if (session !== appSecret) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
