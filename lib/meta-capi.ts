import { normalizeAndHashPhone, hashEmail } from './hash'

const GRAPH_API_VERSION = 'v19.0'
const PIXEL_ID = process.env.META_PIXEL_ID!
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN!
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE // Remove em produção

export interface ConversionEventData {
  eventId: string
  eventName: string
  value: number
  currency: string
  customerPhone?: string
  customerEmail?: string
  customerName?: string
  fbclid?: string
}

export interface MetaCapiResponse extends Record<string, unknown> {
  events_received?: number
  messages?: string[]
  fbtrace_id?: string
  error?: {
    message: string
    type: string
    code: number
  }
}

export async function sendConversionEvent(data: ConversionEventData): Promise<MetaCapiResponse> {
  const eventTime = Math.floor(Date.now() / 1000)

  // Monta user_data com dados hasheados
  const userData: Record<string, string> = {}

  if (data.customerPhone) {
    userData.ph = normalizeAndHashPhone(data.customerPhone)
  }
  if (data.customerEmail) {
    userData.em = hashEmail(data.customerEmail)
  }
  if (data.fbclid) {
    userData.fbc = `fb.1.${Date.now()}.${data.fbclid}`
  }

  const eventPayload: Record<string, unknown> = {
    event_name: data.eventName,
    event_time: eventTime,
    event_id: data.eventId,
    action_source: 'other', // Vendas pelo WhatsApp = "other"
    event_source_url: process.env.NEXT_PUBLIC_APP_URL || 'https://metaads-tracker.vercel.app',
    user_data: userData,
    custom_data: {
      value: data.value,
      currency: data.currency,
    },
  }

  const body: Record<string, unknown> = {
    data: [eventPayload],
  }

  // Adiciona test event code em desenvolvimento
  if (TEST_EVENT_CODE) {
    body.test_event_code = TEST_EVENT_CODE
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const result = await response.json()
  return result as MetaCapiResponse
}
