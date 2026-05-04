import { NextRequest, NextResponse } from 'next/server'
import { initDB, listWhatsAppConversations } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    await initDB()
    const attributedOnlyParam = req.nextUrl.searchParams.get('attributedOnly')
    const onlyAttributed =
      attributedOnlyParam === '1' ||
      attributedOnlyParam === 'true' ||
      attributedOnlyParam === 'yes'

    const conversations = await listWhatsAppConversations({ onlyAttributed })
    return NextResponse.json(conversations)
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao buscar conversas do WhatsApp', details: String(error) },
      { status: 500 }
    )
  }
}
