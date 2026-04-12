import { NextResponse } from 'next/server'
import { initDB, listWhatsAppConversations } from '@/lib/db'

export async function GET() {
  try {
    await initDB()
    const conversations = await listWhatsAppConversations({ onlyAttributed: true })
    return NextResponse.json(conversations)
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao buscar conversas do WhatsApp', details: String(error) },
      { status: 500 }
    )
  }
}
