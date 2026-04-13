import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import {
  initDB,
  getWhatsAppConversation,
  insertConversion,
  listConversions,
  updateConversionMetaStatus,
} from '@/lib/db'
import { sendConversionEvent } from '@/lib/meta-capi'
import { normalizeBrazilPhone } from '@/lib/phone'

export async function GET() {
  try {
    await initDB()
    const conversions = await listConversions()
    return NextResponse.json(conversions)
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao buscar conversões', details: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    await initDB()
    const body = (await req.json()) as Record<string, unknown>

    const conversationId = String(body.conversationId || '')
    const value = Number(body.value)
    const currency = String(body.currency || 'BRL')
    const eventName = String(body.eventName || 'Purchase')
    const useTestEventCode = body.useTestEventCode === true

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Selecione uma conversa do WhatsApp com atribuição CTWA.' },
        { status: 400 }
      )
    }

    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json({ error: 'Valor da venda é obrigatório.' }, { status: 400 })
    }

    if (useTestEventCode && !process.env.META_TEST_EVENT_CODE) {
      return NextResponse.json(
        { error: 'META_TEST_EVENT_CODE não configurada para envio em modo de teste.' },
        { status: 400 }
      )
    }

    const conversation = await getWhatsAppConversation(conversationId)

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversa do WhatsApp não encontrada.' },
        { status: 404 }
      )
    }

    if (!conversation.ctwa_clid) {
      return NextResponse.json(
        {
          error:
            'Essa conversa ainda não possui ctwa_clid. Só é possível enviar conversões de leads vindos de anúncio Click to WhatsApp.',
        },
        { status: 400 }
      )
    }

    const providedPhone = typeof body.customerPhone === 'string' ? body.customerPhone : ''
    const normalizedCustomerPhone = providedPhone
      ? normalizeBrazilPhone(providedPhone)
      : conversation.customer_phone

    if (providedPhone && !normalizedCustomerPhone) {
      return NextResponse.json(
        {
          error: 'Telefone inválido. Use DDD + número. Pode digitar com ou sem +55, espaços e traços.',
        },
        { status: 400 }
      )
    }

    const customerName =
      typeof body.customerName === 'string' && body.customerName.trim()
        ? body.customerName.trim()
        : conversation.customer_name || undefined

    const customerEmail =
      typeof body.customerEmail === 'string' && body.customerEmail.trim()
        ? body.customerEmail.trim()
        : undefined

    const productName =
      typeof body.productName === 'string' && body.productName.trim()
        ? body.productName.trim()
        : undefined

    const notes =
      typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : undefined

    const eventId = randomUUID()

    const conversion = await insertConversion({
      customerName,
      customerPhone: normalizedCustomerPhone || undefined,
      customerEmail,
      value,
      currency,
      productName,
      notes,
      eventId,
      eventName,
      source: 'whatsapp',
      whatsappConversationId: conversation.id,
      ctwaClid: conversation.ctwa_clid,
      sourceRef: `whatsapp:${conversation.id}:${eventId}`,
    })

    let metaStatus: 'sent' | 'error' = 'sent'
    let metaResponse: Record<string, unknown>
    let metaEventPayload: Record<string, unknown> | null = null
    let datasetId: string | null = null

    try {
      const result = await sendConversionEvent({
        eventId,
        eventName,
        value,
        currency,
        customerPhone: normalizedCustomerPhone || undefined,
        customerEmail,
        customerName,
        testEventCode: useTestEventCode ? process.env.META_TEST_EVENT_CODE : undefined,
        conversation,
      })

      datasetId = result.datasetId
      metaResponse = result.response
      metaEventPayload = result.eventPayload

      if (result.response.error) {
        metaStatus = 'error'
      }
    } catch (error) {
      metaStatus = 'error'
      metaResponse = { error: String(error) }
    }

    await updateConversionMetaStatus(conversion.id, metaStatus, metaResponse, {
      datasetId,
      ctwaClid: conversation.ctwa_clid,
      metaEventPayload,
    })

    return NextResponse.json({
      ok: true,
      id: conversion.id,
      metaStatus,
      metaResponse,
      datasetId,
      testEventCodeUsed: useTestEventCode ? process.env.META_TEST_EVENT_CODE : undefined,
      eventsReceived:
        typeof metaResponse.events_received === 'number' ? metaResponse.events_received : undefined,
    })
  } catch (error) {
    console.error('Erro ao registrar conversão:', error)
    return NextResponse.json(
      { error: 'Erro interno ao registrar conversão', details: String(error) },
      { status: 500 }
    )
  }
}
