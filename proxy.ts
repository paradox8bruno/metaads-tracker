import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const APP_SECRET = process.env.APP_SECRET

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

  if (!APP_SECRET) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'APP_SECRET não configurada.' }, { status: 500 })
    }

    return new NextResponse('APP_SECRET não configurada.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const session = request.cookies.get('session')?.value

  if (session !== APP_SECRET) {
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
