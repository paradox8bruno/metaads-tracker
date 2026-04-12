import { NextResponse } from 'next/server'
import { initDB } from '@/lib/db'

export async function GET() {
  try {
    await initDB()
    return NextResponse.json({ ok: true, message: 'Banco de dados inicializado!' })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao inicializar banco', details: String(error) },
      { status: 500 }
    )
  }
}
