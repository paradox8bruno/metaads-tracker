import { NextRequest, NextResponse } from 'next/server'

const APP_SECRET = process.env.APP_SECRET

export async function POST(req: NextRequest) {
  if (!APP_SECRET) {
    return NextResponse.json({ error: 'APP_SECRET não configurada.' }, { status: 500 })
  }

  let body: { password?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const { password } = body

  if (typeof password !== 'string' || password !== APP_SECRET) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })

  // Define cookie de sessão (válido por 30 dias)
  response.cookies.set('session', APP_SECRET, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 dias
    path: '/',
  })

  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('session')
  return response
}
