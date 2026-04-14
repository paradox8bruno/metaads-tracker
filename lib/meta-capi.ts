import { getAppSetting, setAppSetting, type WhatsAppConversation } from './db'
import { hashEmail, normalizeAndHashPhone } from './hash'

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v25.0'
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN

export interface ConversionEventData {
  eventId: string
  eventName: string
  value?: number
  currency?: string
  customerPhone?: string
  customerEmail?: string
  customerName?: string
  testEventCode?: string | null
  conversation: Pick<WhatsAppConversation, 'waba_id' | 'ctwa_clid'>
}

export interface MetaCapiResponse extends Record<string, unknown> {
  events_received?: number
  messages?: string[]
  fbtrace_id?: string
  error?: {
    message: string
    type: string
    code: number
    error_subcode?: number
  }
}

export interface SentBusinessMessagingEvent {
  datasetId: string
  eventPayload: Record<string, unknown>
  response: MetaCapiResponse
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} não configurada.`)
  }

  return value
}

function extractDatasetId(payload: Record<string, unknown> | null | undefined): string | null {
  if (!payload) return null

  if (typeof payload.id === 'string' && payload.id) {
    return payload.id
  }

  if (Array.isArray(payload.data)) {
    const first = payload.data[0]
    if (
      typeof first === 'object' &&
      first !== null &&
      'id' in first &&
      typeof first.id === 'string' &&
      first.id
    ) {
      return first.id
    }
  }

  return null
}

async function graphApiRequest(
  path: string,
  options?: {
    method?: 'GET' | 'POST'
    body?: Record<string, unknown>
  }
): Promise<Record<string, unknown>> {
  const token = requireEnv('META_ACCESS_TOKEN', ACCESS_TOKEN)
  const separator = path.includes('?') ? '&' : '?'
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}${path}${separator}access_token=${token}`

  const response = await fetch(url, {
    method: options?.method || 'GET',
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })

  const rawResponse = await response.text()
  let result: Record<string, unknown>

  try {
    result = rawResponse ? (JSON.parse(rawResponse) as Record<string, unknown>) : {}
  } catch {
    result = { error: { message: rawResponse || 'Resposta inválida da Graph API' } }
  }

  if (!response.ok) {
    throw new Error(
      typeof result?.error === 'object' && result.error !== null && 'message' in result.error
        ? String(result.error.message)
        : `Graph API respondeu com status ${response.status}`
    )
  }

  return result
}

async function findDatasetIdForWaba(
  wabaId: string,
  method: 'GET' | 'POST'
): Promise<string | null> {
  const edges = ['dataset', 'datasets']

  for (const edge of edges) {
    try {
      const result = await graphApiRequest(`/${wabaId}/${edge}`, {
        method,
      })
      const datasetId = extractDatasetId(result)
      if (datasetId) {
        return datasetId
      }
    } catch {
      continue
    }
  }

  return null
}

export async function getOrCreateDatasetId(): Promise<string> {
  if (process.env.META_DATASET_ID) {
    return process.env.META_DATASET_ID
  }

  const cached = await getAppSetting('meta_dataset_id')
  if (cached) {
    return cached
  }

  const wabaId = requireEnv(
    'WHATSAPP_BUSINESS_ACCOUNT_ID',
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
  )

  let datasetId = await findDatasetIdForWaba(wabaId, 'GET')

  if (!datasetId) {
    datasetId = await findDatasetIdForWaba(wabaId, 'POST')
  }

  if (!datasetId) {
    throw new Error('Não foi possível obter o dataset do WhatsApp Business Account.')
  }

  await setAppSetting('meta_dataset_id', datasetId)
  return datasetId
}

export async function sendConversionEvent(
  data: ConversionEventData
): Promise<SentBusinessMessagingEvent> {
  if (!data.conversation.ctwa_clid) {
    throw new Error('A conversa selecionada não possui ctwa_clid.')
  }

  const datasetId = await getOrCreateDatasetId()
  const eventTime = Math.floor(Date.now() / 1000)

  const userData: Record<string, string> = {
    whatsapp_business_account_id:
      data.conversation.waba_id ||
      requireEnv('WHATSAPP_BUSINESS_ACCOUNT_ID', process.env.WHATSAPP_BUSINESS_ACCOUNT_ID),
    ctwa_clid: data.conversation.ctwa_clid,
  }

  if (data.customerPhone) {
    const hashedPhone = normalizeAndHashPhone(data.customerPhone)
    if (hashedPhone) {
      userData.ph = hashedPhone
    }
  }

  if (data.customerEmail) {
    userData.em = hashEmail(data.customerEmail)
  }

  const eventPayload: Record<string, unknown> = {
    event_name: data.eventName,
    event_time: eventTime,
    event_id: data.eventId,
    action_source: 'business_messaging',
    messaging_channel: 'whatsapp',
    user_data: userData,
  }

  if (typeof data.value === 'number' && Number.isFinite(data.value) && data.currency) {
    eventPayload.custom_data = {
      value: data.value,
      currency: data.currency,
    }
  }

  const body: Record<string, unknown> = {
    data: [eventPayload],
  }

  if (data.testEventCode) {
    body.test_event_code = data.testEventCode
  }

  const response = (await graphApiRequest(`/${datasetId}/events`, {
    method: 'POST',
    body,
  })) as MetaCapiResponse

  return {
    datasetId,
    eventPayload,
    response,
  }
}
