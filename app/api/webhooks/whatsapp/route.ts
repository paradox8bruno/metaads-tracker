import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID } from 'crypto'
import {
  getConversionBySourceRef,
  initDB,
  insertConversion,
  insertWebhookDelivery,
  updateConversionMetaStatus,
  upsertWhatsAppConversationFromWebhook,
  upsertWhatsAppMessage,
  upsertWhatsAppWebhookTopicEvent,
} from '@/lib/db'
import { sendConversionEvent } from '@/lib/meta-capi'
import {
  extractDigits,
  parseWebhookTimestamp,
  verifyMetaWebhookSignature,
} from '@/lib/meta-webhooks'

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
const APP_SECRET = process.env.META_APP_SECRET
const EXPECTED_WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || null
const EXPECTED_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || null

interface WebhookContact {
  wa_id?: string
  profile?: {
    name?: string
  }
}

interface WebhookReferral {
  ctwa_clid?: string
  source_id?: string
  source_type?: string
  source_url?: string
  headline?: string
  body?: string
  image?: {
    id?: string
  }
  video?: {
    id?: string
  }
}

interface WebhookMessage {
  from?: string
  to?: string
  recipient_id?: string
  id?: string
  timestamp?: string
  type?: string
  text?: {
    body?: string
  }
  button?: {
    text?: string
  }
  interactive?: {
    button_reply?: {
      title?: string
    }
    list_reply?: {
      title?: string
    }
  }
  referral?: WebhookReferral
}

interface WebhookStatus {
  id?: string
  status?: string
  timestamp?: string
  recipient_id?: string
}

interface WebhookValue {
  messaging_product?: string
  metadata?: {
    display_phone_number?: string
    phone_number_id?: string
  }
  contacts?: WebhookContact[]
  messages?: WebhookMessage[]
  statuses?: WebhookStatus[]
}

interface WebhookChange {
  field?: string
  value?: Record<string, unknown>
}

interface WebhookEntry {
  id?: string
  changes?: WebhookChange[]
}

interface WhatsAppWebhookPayload {
  object?: string
  entry?: WebhookEntry[]
}

function asRecord(
  payload: WhatsAppWebhookPayload | null
): Record<string, unknown> | null {
  return payload ? (payload as unknown as Record<string, unknown>) : null
}

function getMessageText(message: WebhookMessage): string | null {
  if (message.text?.body) return message.text.body
  if (message.button?.text) return message.button.text
  if (message.interactive?.button_reply?.title) return message.interactive.button_reply.title
  if (message.interactive?.list_reply?.title) return message.interactive.list_reply.title
  return null
}

function makeEventKey(prefix: string, payload: Record<string, unknown>): string {
  const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  return `${prefix}:${digest}`
}

function getReferralMedia(referral?: WebhookReferral): { type: string | null; id: string | null } {
  if (referral?.image?.id) {
    return { type: 'image', id: referral.image.id }
  }

  if (referral?.video?.id) {
    return { type: 'video', id: referral.video.id }
  }

  return { type: null, id: null }
}

function getMessageWaId(message: WebhookMessage, fallbackWaId: string | null): string | null {
  return (
    extractDigits(message.from) ||
    extractDigits(message.to) ||
    extractDigits(message.recipient_id) ||
    fallbackWaId
  )
}

function buildContactsByWaId(value: WebhookValue): Map<string, WebhookContact> {
  const contactsByWaId = new Map<string, WebhookContact>()

  for (const contact of value.contacts || []) {
    if (contact.wa_id) {
      contactsByWaId.set(contact.wa_id, contact)
      const normalizedWaId = extractDigits(contact.wa_id)
      if (normalizedWaId) {
        contactsByWaId.set(normalizedWaId, contact)
      }
    }
  }

  return contactsByWaId
}

function shouldIgnorePhoneNumber(phoneNumberId: string | null): boolean {
  return Boolean(EXPECTED_PHONE_NUMBER_ID && phoneNumberId && phoneNumberId !== EXPECTED_PHONE_NUMBER_ID)
}

function extractEventTimestamp(payload: Record<string, unknown>): string | null {
  const candidates = [
    payload.timestamp,
    payload.event_time,
    payload.occurred_at,
    payload.detected_time,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const parsed = parseWebhookTimestamp(candidate)
      if (parsed) return parsed

      const fallback = new Date(candidate)
      if (!Number.isNaN(fallback.getTime())) {
        return fallback.toISOString()
      }
    }

    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return new Date(candidate * 1000).toISOString()
    }
  }

  return null
}

function extractEventName(payload: Record<string, unknown>): string | null {
  const candidates = [payload.event, payload.event_name, payload.type, payload.name]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  return null
}

function extractEventWaId(payload: Record<string, unknown>): string | null {
  const candidates = [payload.wa_id, payload.from, payload.to, payload.recipient_id, payload.user_id]

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const digits = extractDigits(candidate)
      if (digits) return digits
    }
  }

  if (
    typeof payload.user === 'object' &&
    payload.user !== null &&
    'wa_id' in payload.user &&
    typeof payload.user.wa_id === 'string'
  ) {
    return extractDigits(payload.user.wa_id)
  }

  return null
}

function normalizeTopicEventPayloads(value: Record<string, unknown>): Record<string, unknown>[] {
  const nestedCandidates = [value.events, value.data]

  for (const candidate of nestedCandidates) {
    if (Array.isArray(candidate)) {
      const items = candidate.filter(
        item => typeof item === 'object' && item !== null
      ) as Record<string, unknown>[]

      if (items.length > 0) {
        return items
      }
    }
  }

  return [value]
}

async function upsertConversationMessageEvent(params: {
  wabaId: string
  phoneNumberId: string | null
  displayPhoneNumber: string | null
  value: WebhookValue
  message: WebhookMessage
  direction: 'inbound' | 'outbound'
  payloadType: 'message' | 'echo'
}) {
  const fallbackWaId =
    extractDigits(params.value.contacts?.[0]?.wa_id) ||
    extractDigits(params.message.to) ||
    extractDigits(params.message.recipient_id) ||
    null

  const waId = getMessageWaId(params.message, fallbackWaId)
  if (!waId) {
    return { conversation: null, stored: false }
  }

  const contactsByWaId = buildContactsByWaId(params.value)
  const contact = contactsByWaId.get(waId) || params.value.contacts?.[0]
  const referral = params.message.referral
  const referralMedia = getReferralMedia(referral)
  const messageTimestamp = parseWebhookTimestamp(params.message.timestamp)

  const conversation = await upsertWhatsAppConversationFromWebhook({
    wabaId: params.wabaId,
    phoneNumberId: params.phoneNumberId,
    displayPhoneNumber: params.displayPhoneNumber,
    waId,
    customerName: contact?.profile?.name || null,
    customerPhone: extractDigits(waId),
    latestMessageId: params.message.id || null,
    latestMessageAt: messageTimestamp,
    latestMessageText: getMessageText(params.message),
    latestMessageType: params.message.type || null,
    ctwaClid: referral?.ctwa_clid || null,
    referralSourceId: referral?.source_id || null,
    referralSourceType: referral?.source_type || null,
    referralSourceUrl: referral?.source_url || null,
    referralHeadline: referral?.headline || null,
    referralBody: referral?.body || null,
    referralMediaType: referralMedia.type,
    referralMediaId: referralMedia.id,
    rawReferral: referral ? (referral as unknown as Record<string, unknown>) : null,
    rawLastMessage: params.message as unknown as Record<string, unknown>,
  })

  await upsertWhatsAppMessage({
    conversationId: conversation.id,
    eventKey:
      params.payloadType === 'echo'
        ? `echo:${params.message.id || `${waId}:${params.message.timestamp || 'no-ts'}`}`
        : `message:${params.message.id || `${waId}:${params.message.timestamp || 'no-ts'}`}`,
    wabaId: params.wabaId,
    waId,
    phoneNumberId: params.phoneNumberId,
    payloadType: params.payloadType,
    messageId: params.message.id || null,
    direction: params.direction,
    messageType: params.message.type || null,
    messageText: getMessageText(params.message),
    eventTimestamp: messageTimestamp,
    rawPayload: params.message as unknown as Record<string, unknown>,
  })

  return { conversation, stored: true }
}

async function storeWebhookTopicEvents(params: {
  field: 'automatic_events' | 'tracking_events'
  wabaId: string
  phoneNumberId: string | null
  value: Record<string, unknown>
}) {
  let stored = 0

  for (const eventPayload of normalizeTopicEventPayloads(params.value)) {
    await upsertWhatsAppWebhookTopicEvent({
      eventKey: makeEventKey(params.field, eventPayload),
      wabaId: params.wabaId,
      phoneNumberId: params.phoneNumberId,
      waId: extractEventWaId(eventPayload),
      field: params.field,
      eventName: extractEventName(eventPayload),
      eventTimestamp: extractEventTimestamp(eventPayload),
      rawPayload: eventPayload,
    })
    stored += 1
  }

  return stored
}

async function ensureAutomaticLeadSubmitted(params: {
  conversationId: string
  wabaId: string
  ctwaClid: string
  customerName: string | null
  customerPhone: string | null
}) {
  const sourceRef = `auto-lead:${params.conversationId}`
  const existing = await getConversionBySourceRef(sourceRef)

  if (existing?.meta_status === 'sent') {
    return
  }

  const conversion =
    existing ||
    (await insertConversion({
      customerName: params.customerName || undefined,
      customerPhone: params.customerPhone || undefined,
      value: 0,
      currency: 'BRL',
      eventId: randomUUID(),
      eventName: 'LeadSubmitted',
      source: 'whatsapp',
      whatsappConversationId: params.conversationId,
      ctwaClid: params.ctwaClid,
      sourceRef,
    }))

  const result = await sendConversionEvent({
    eventId: conversion.event_id,
    eventName: 'LeadSubmitted',
    customerPhone: params.customerPhone || undefined,
    customerName: params.customerName || undefined,
    conversation: {
      waba_id: params.wabaId,
      ctwa_clid: params.ctwaClid,
    },
  })

  const metaStatus: 'sent' | 'error' = result.error || result.response.error ? 'error' : 'sent'

  await updateConversionMetaStatus(conversion.id, metaStatus, result.response, {
    datasetId: result.datasetId,
    ctwaClid: params.ctwaClid,
    metaEventPayload: result.eventPayload,
  })
}

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')
  const verifyToken = req.nextUrl.searchParams.get('hub.verify_token')

  if (!VERIFY_TOKEN) {
    return NextResponse.json(
      { error: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN não configurada.' },
      { status: 500 }
    )
  }

  if (mode === 'subscribe' && challenge && verifyToken === VERIFY_TOKEN) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  return NextResponse.json({ error: 'Falha na verificação do webhook.' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signatureHeader = req.headers.get('x-hub-signature-256')
  const requestHeaders = Object.fromEntries(req.headers.entries())

  await initDB()

  let payload: WhatsAppWebhookPayload | null = null
  let parseError = false

  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookPayload
  } catch {
    parseError = true
  }

  const entryCount = payload?.entry?.length || 0
  const changeCount =
    payload?.entry?.reduce((total, entry) => total + (entry.changes?.length || 0), 0) || 0

  if (!APP_SECRET) {
    await insertWebhookDelivery({
      outcome: 'missing_app_secret',
      signatureValid: null,
      httpMethod: req.method,
      requestHeaders,
      rawBody,
      payload: asRecord(payload),
      eventType: payload?.object || null,
      entryCount,
      changeCount,
      errorMessage: 'META_APP_SECRET não configurada para validar a assinatura do webhook.',
    })

    return NextResponse.json(
      { error: 'META_APP_SECRET não configurada para validar a assinatura do webhook.' },
      { status: 500 }
    )
  }

  const signatureValid = verifyMetaWebhookSignature(rawBody, signatureHeader, APP_SECRET)

  if (!signatureValid) {
    await insertWebhookDelivery({
      outcome: 'invalid_signature',
      signatureValid: false,
      httpMethod: req.method,
      requestHeaders,
      rawBody,
      payload: asRecord(payload),
      eventType: payload?.object || null,
      entryCount,
      changeCount,
      errorMessage: 'Assinatura inválida do webhook.',
    })

    return NextResponse.json({ error: 'Assinatura inválida do webhook.' }, { status: 403 })
  }

  if (parseError || !payload) {
    await insertWebhookDelivery({
      outcome: 'invalid_json',
      signatureValid: true,
      httpMethod: req.method,
      requestHeaders,
      rawBody,
      payload: null,
      eventType: null,
      entryCount: 0,
      changeCount: 0,
      errorMessage: 'Payload JSON inválido.',
    })

    return NextResponse.json({ error: 'Payload JSON inválido.' }, { status: 400 })
  }

  if (!payload.entry?.length) {
    await insertWebhookDelivery({
      outcome: 'accepted_empty',
      signatureValid: true,
      httpMethod: req.method,
      requestHeaders,
      rawBody,
      payload: asRecord(payload),
      eventType: payload.object || null,
      entryCount,
      changeCount,
    })

    return NextResponse.json({ ok: true, processed: 0 })
  }

  let conversationsUpserted = 0
  let messageEventsStored = 0
  let echoEventsStored = 0
  let statusEventsStored = 0
  let automaticEventsStored = 0
  let trackingEventsStored = 0
  let ignoredEntries = 0
  let ignoredChanges = 0

  try {
    for (const entry of payload.entry) {
      const wabaId = entry.id
      if (!wabaId) continue
      if (EXPECTED_WABA_ID && wabaId !== EXPECTED_WABA_ID) {
        ignoredEntries += 1
        continue
      }

      for (const change of entry.changes || []) {
        if (!change.field || !change.value) continue

        const value = change.value as WebhookValue
        const phoneNumberId = value.metadata?.phone_number_id || null
        const displayPhoneNumber = value.metadata?.display_phone_number || null

        if (shouldIgnorePhoneNumber(phoneNumberId)) {
          ignoredChanges += 1
          continue
        }

        switch (change.field) {
          case 'messages': {
            if (value.messaging_product && value.messaging_product !== 'whatsapp') {
              continue
            }

            for (const message of value.messages || []) {
              const result = await upsertConversationMessageEvent({
                wabaId,
                phoneNumberId,
                displayPhoneNumber,
                value,
                message,
                direction: 'inbound',
                payloadType: 'message',
              })

              if (!result.stored || !result.conversation) continue

              conversationsUpserted += 1
              messageEventsStored += 1

              if (result.conversation.ctwa_clid) {
                await ensureAutomaticLeadSubmitted({
                  conversationId: result.conversation.id,
                  wabaId,
                  ctwaClid: result.conversation.ctwa_clid,
                  customerName: result.conversation.customer_name,
                  customerPhone: result.conversation.customer_phone,
                })
              }
            }

            for (const status of value.statuses || []) {
              const waId = extractDigits(status.recipient_id) || null
              const statusTimestamp = parseWebhookTimestamp(status.timestamp)

              const conversation = waId
                ? await upsertWhatsAppConversationFromWebhook({
                    wabaId,
                    phoneNumberId,
                    displayPhoneNumber,
                    waId,
                    customerPhone: extractDigits(waId),
                  })
                : null

              if (conversation) {
                conversationsUpserted += 1
              }

              await upsertWhatsAppMessage({
                conversationId: conversation?.id || null,
                eventKey: `status:${status.id || 'no-id'}:${status.status || 'unknown'}:${status.timestamp || 'no-ts'}`,
                wabaId,
                waId,
                phoneNumberId,
                payloadType: 'status',
                messageId: status.id || null,
                status: status.status || null,
                direction: 'outbound',
                eventTimestamp: statusTimestamp,
                rawPayload: status as unknown as Record<string, unknown>,
              })

              statusEventsStored += 1
            }
            break
          }

          case 'smb_message_echoes': {
            for (const message of value.messages || []) {
              const result = await upsertConversationMessageEvent({
                wabaId,
                phoneNumberId,
                displayPhoneNumber,
                value,
                message,
                direction: 'outbound',
                payloadType: 'echo',
              })

              if (!result.stored || !result.conversation) continue

              conversationsUpserted += 1
              echoEventsStored += 1
            }
            break
          }

          case 'automatic_events': {
            automaticEventsStored += await storeWebhookTopicEvents({
              field: 'automatic_events',
              wabaId,
              phoneNumberId,
              value: change.value,
            })
            break
          }

          case 'tracking_events': {
            trackingEventsStored += await storeWebhookTopicEvents({
              field: 'tracking_events',
              wabaId,
              phoneNumberId,
              value: change.value,
            })
            break
          }

          default:
            continue
        }
      }
    }
  } catch (error) {
    await insertWebhookDelivery({
      outcome: 'processing_error',
      signatureValid: true,
      httpMethod: req.method,
      requestHeaders,
      rawBody,
      payload: asRecord(payload),
      eventType: payload.object || null,
      entryCount,
      changeCount,
      conversationsUpserted,
      messageEventsStored,
      echoEventsStored,
      statusEventsStored,
      automaticEventsStored,
      trackingEventsStored,
      ignoredEntries,
      ignoredChanges,
      errorMessage: String(error),
    })

    throw error
  }

  await insertWebhookDelivery({
    outcome: 'accepted',
    signatureValid: true,
    httpMethod: req.method,
    requestHeaders,
    rawBody,
    payload: asRecord(payload),
    eventType: payload.object || null,
    entryCount,
    changeCount,
    conversationsUpserted,
    messageEventsStored,
    echoEventsStored,
    statusEventsStored,
    automaticEventsStored,
    trackingEventsStored,
    ignoredEntries,
    ignoredChanges,
  })

  return NextResponse.json({
    ok: true,
    conversationsUpserted,
    messageEventsStored,
    echoEventsStored,
    statusEventsStored,
    automaticEventsStored,
    trackingEventsStored,
    ignoredEntries,
    ignoredChanges,
  })
}
