import { NextRequest, NextResponse } from 'next/server'
import { countWebhookDeliveries, initDB, listWebhookDeliveries } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    await initDB()

    const limitParam = Number(req.nextUrl.searchParams.get('limit') || '100')
    const limit = Number.isFinite(limitParam) ? limitParam : 100

    const [items, total] = await Promise.all([
      listWebhookDeliveries({ limit }),
      countWebhookDeliveries(),
    ])

    return NextResponse.json({
      total,
      count: items.length,
      items,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao buscar entregas do webhook', details: String(error) },
      { status: 500 }
    )
  }
}
