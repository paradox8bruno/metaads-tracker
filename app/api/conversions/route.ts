import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { insertConversion, updateConversionMetaStatus, listConversions } from '@/lib/db'
import { sendConversionEvent } from '@/lib/meta-capi'

// GET - Lista conversões
export async function GET() {
  try {
    const conversions = await listConversions()
    return NextResponse.json(conversions)
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao buscar conversões', details: String(error) },
      { status: 500 }
    )
  }
}

// POST - Registra nova conversão e envia para Meta CAPI
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      customerName,
      customerPhone,
      customerEmail,
      value,
      currency = 'BRL',
      productName,
      notes,
      eventName = 'Purchase',
      fbclid,
    } = body

    // Valida campos obrigatórios
    if (!value || isNaN(Number(value))) {
      return NextResponse.json({ error: 'Valor da venda é obrigatório' }, { status: 400 })
    }
    if (!customerPhone && !customerEmail) {
      return NextResponse.json(
        { error: 'Informe pelo menos o telefone ou email do cliente' },
        { status: 400 }
      )
    }

    // Gera ID único para o evento (usado para deduplicação)
    const eventId = randomUUID()

    // Salva no banco com status "pending"
    const conversion = await insertConversion({
      customerName,
      customerPhone,
      customerEmail,
      value: Number(value),
      currency,
      productName,
      notes,
      eventId,
      eventName,
      source: 'manual',
    })

    // Envia para Meta CAPI
    let metaStatus: 'sent' | 'error' = 'sent'
    let metaResponse

    try {
      metaResponse = await sendConversionEvent({
        eventId,
        eventName,
        value: Number(value),
        currency,
        customerPhone,
        customerEmail,
        customerName,
        fbclid,
      })

      if (metaResponse.error) {
        metaStatus = 'error'
      }
    } catch (err) {
      metaStatus = 'error'
      metaResponse = { error: String(err) }
    }

    // Atualiza status no banco
    await updateConversionMetaStatus(conversion.id, metaStatus, metaResponse)

    return NextResponse.json({
      ok: true,
      id: conversion.id,
      metaStatus,
      metaResponse,
      eventsReceived: metaResponse?.events_received,
    })
  } catch (error) {
    console.error('Erro ao registrar conversão:', error)
    return NextResponse.json(
      { error: 'Erro interno ao registrar conversão', details: String(error) },
      { status: 500 }
    )
  }
}
