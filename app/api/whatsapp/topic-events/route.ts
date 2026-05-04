import { NextRequest, NextResponse } from 'next/server'
import {
  countWhatsAppWebhookTopicEvents,
  initDB,
  listWhatsAppWebhookTopicEvents,
} from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    await initDB()

    const limitParam = Number(req.nextUrl.searchParams.get('limit') || '100')
    const limit = Number.isFinite(limitParam) ? limitParam : 100
    const fieldParam = req.nextUrl.searchParams.get('field')
    const field =
      fieldParam === 'automatic_events' || fieldParam === 'tracking_events' ? fieldParam : undefined

    const [items, total] = await Promise.all([
      listWhatsAppWebhookTopicEvents({ limit }),
      countWhatsAppWebhookTopicEvents({ field }),
    ])

    return NextResponse.json({
      total,
      count: field ? items.filter(item => item.field === field).length : items.length,
      items: field ? items.filter(item => item.field === field) : items,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao buscar eventos extras do webhook', details: String(error) },
      { status: 500 }
    )
  }
}
