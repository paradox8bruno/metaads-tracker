import { NextRequest, NextResponse } from 'next/server'
import { countWhatsAppMessages, initDB, listWhatsAppMessages } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    await initDB()

    const limitParam = Number(req.nextUrl.searchParams.get('limit') || '100')
    const limit = Number.isFinite(limitParam) ? limitParam : 100

    const [items, total] = await Promise.all([
      listWhatsAppMessages({ limit }),
      countWhatsAppMessages(),
    ])

    return NextResponse.json({
      total,
      count: items.length,
      items,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao buscar mensagens do WhatsApp', details: String(error) },
      { status: 500 }
    )
  }
}
