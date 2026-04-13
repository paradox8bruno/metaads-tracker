import { NextRequest, NextResponse } from 'next/server'
import {
  initDB,
  upsertWhatsAppConversationFromWebhook,
  upsertWhatsAppMessage,
} from '@/lib/db'
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
  value?: WebhookValue
}

interface WebhookEntry {
  id?: string
  changes?: WebhookChange[]
}

interface WhatsAppWebhookPayload {
  object?: string
  entry?: WebhookEntry[]
}

function getMessageText(message: WebhookMessage): string | null {
  if (message.text?.body) return message.text.body
  if (message.button?.text) return message.button.text
  if (message.interactive?.button_reply?.title) return message.interactive.button_reply.title
  if (message.interactive?.list_reply?.title) return message.interactive.list_reply.title
  return null
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
  if (!APP_SECRET) {
    return NextResponse.json(
      { error: 'META_APP_SECRET não configurada para validar a assinatura do webhook.' },
      { status: 500 }
    )
  }

  const rawBody = await req.text()
  const signatureHeader = req.headers.get('x-hub-signature-256')

  if (!verifyMetaWebhookSignature(rawBody, signatureHeader, APP_SECRET)) {
    return NextResponse.json({ error: 'Assinatura inválida do webhook.' }, { status: 403 })
  }

  let payload: WhatsAppWebhookPayload

  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Payload JSON inválido.' }, { status: 400 })
  }

  if (!payload.entry?.length) {
    return NextResponse.json({ ok: true, processed: 0 })
  }

  await initDB()

  let conversationsUpserted = 0
  let messageEventsStored = 0
  let statusEventsStored = 0
  let ignoredEntries = 0
  let ignoredChanges = 0

  for (const entry of payload.entry) {
    const wabaId = entry.id
    if (!wabaId) continue
    if (EXPECTED_WABA_ID && wabaId !== EXPECTED_WABA_ID) {
      ignoredEntries += 1
      continue
    }

    for (const change of entry.changes || []) {
      if (change.field !== 'messages' || !change.value) continue

      const value = change.value
      if (value.messaging_product && value.messaging_product !== 'whatsapp') {
        continue
      }

      const phoneNumberId = value.metadata?.phone_number_id || null
      const displayPhoneNumber = value.metadata?.display_phone_number || null

      if (EXPECTED_PHONE_NUMBER_ID && phoneNumberId !== EXPECTED_PHONE_NUMBER_ID) {
        ignoredChanges += 1
        continue
      }

      const contactsByWaId = new Map<string, WebhookContact>()
      for (const contact of value.contacts || []) {
        if (contact.wa_id) {
          contactsByWaId.set(contact.wa_id, contact)
        }
      }

      for (const message of value.messages || []) {
        const waId = message.from || value.contacts?.[0]?.wa_id || null
        if (!waId) continue

        const contact = contactsByWaId.get(waId) || value.contacts?.[0]
        const referral = message.referral
        const referralMedia = getReferralMedia(referral)
        const messageTimestamp = parseWebhookTimestamp(message.timestamp)

        const conversation = await upsertWhatsAppConversationFromWebhook({
          wabaId,
          phoneNumberId,
          displayPhoneNumber,
          waId,
          customerName: contact?.profile?.name || null,
          customerPhone: extractDigits(waId),
          latestMessageId: message.id || null,
          latestMessageAt: messageTimestamp,
          latestMessageText: getMessageText(message),
          latestMessageType: message.type || null,
          ctwaClid: referral?.ctwa_clid || null,
          referralSourceId: referral?.source_id || null,
          referralSourceType: referral?.source_type || null,
          referralSourceUrl: referral?.source_url || null,
          referralHeadline: referral?.headline || null,
          referralBody: referral?.body || null,
          referralMediaType: referralMedia.type,
          referralMediaId: referralMedia.id,
          rawReferral: referral ? (referral as unknown as Record<string, unknown>) : null,
          rawLastMessage: message as unknown as Record<string, unknown>,
        })

        conversationsUpserted += 1

        await upsertWhatsAppMessage({
          conversationId: conversation.id,
          eventKey: `message:${message.id || `${waId}:${message.timestamp || 'no-ts'}`}`,
          wabaId,
          waId,
          phoneNumberId,
          payloadType: 'message',
          messageId: message.id || null,
          direction: 'inbound',
          messageType: message.type || null,
          messageText: getMessageText(message),
          eventTimestamp: messageTimestamp,
          rawPayload: message as unknown as Record<string, unknown>,
        })

        messageEventsStored += 1
      }

      for (const status of value.statuses || []) {
        const waId = status.recipient_id || null
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
    }
  }

  return NextResponse.json({
    ok: true,
    conversationsUpserted,
    messageEventsStored,
    statusEventsStored,
    ignoredEntries,
    ignoredChanges,
  })
}
