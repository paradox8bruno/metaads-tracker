import { neon } from '@neondatabase/serverless'

function getDb() {
  const url = process.env.POSTGRES_URL
  if (!url) throw new Error('POSTGRES_URL não configurada. Configure no painel da Vercel.')
  return neon(url)
}

export function sql(...args: Parameters<ReturnType<typeof neon>>) {
  return getDb()(...args)
}

export interface Conversion {
  id: string
  created_at: string
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  value: number
  currency: string
  product_name: string | null
  notes: string | null
  event_id: string
  event_name: string
  meta_status: 'pending' | 'sent' | 'error'
  meta_response: Record<string, unknown> | null
  meta_event_payload: Record<string, unknown> | null
  meta_sent_at: string | null
  dataset_id: string | null
  whatsapp_conversation_id: string | null
  ctwa_clid: string | null
  source: 'manual' | 'stripe' | 'mercadopago' | 'whatsapp'
  source_ref: string | null
}

export interface WhatsAppConversation {
  id: string
  created_at: string
  updated_at: string
  waba_id: string
  phone_number_id: string | null
  display_phone_number: string | null
  wa_id: string
  customer_name: string | null
  customer_phone: string | null
  latest_message_id: string | null
  latest_message_at: string | null
  latest_message_text: string | null
  latest_message_type: string | null
  ctwa_clid: string | null
  referral_source_id: string | null
  referral_source_type: string | null
  referral_source_url: string | null
  referral_headline: string | null
  referral_body: string | null
  referral_media_type: string | null
  referral_media_id: string | null
  raw_referral: Record<string, unknown> | null
  raw_last_message: Record<string, unknown> | null
}

export interface WhatsAppMessage {
  id: string
  created_at: string
  conversation_id: string | null
  event_key: string
  waba_id: string
  wa_id: string | null
  phone_number_id: string | null
  payload_type: 'message' | 'status'
  message_id: string | null
  status: string | null
  direction: 'inbound' | 'outbound' | 'system'
  message_type: string | null
  message_text: string | null
  event_timestamp: string | null
  raw_payload: Record<string, unknown>
}

export interface WebhookDelivery {
  id: string
  created_at: string
  source: string
  event_type: string | null
  outcome:
    | 'accepted'
    | 'accepted_empty'
    | 'invalid_signature'
    | 'invalid_json'
    | 'missing_app_secret'
    | 'processing_error'
  signature_valid: boolean | null
  http_method: string
  request_headers: Record<string, unknown> | null
  raw_body: string
  payload: Record<string, unknown> | null
  entry_count: number
  change_count: number
  conversations_upserted: number
  message_events_stored: number
  status_events_stored: number
  ignored_entries: number
  ignored_changes: number
  error_message: string | null
}

export async function initDB() {
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`

  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT now()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS whatsapp_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now(),

      waba_id TEXT NOT NULL,
      phone_number_id TEXT,
      display_phone_number TEXT,
      wa_id TEXT NOT NULL,
      customer_name TEXT,
      customer_phone TEXT,

      latest_message_id TEXT,
      latest_message_at TIMESTAMP,
      latest_message_text TEXT,
      latest_message_type TEXT,

      ctwa_clid TEXT,
      referral_source_id TEXT,
      referral_source_type TEXT,
      referral_source_url TEXT,
      referral_headline TEXT,
      referral_body TEXT,
      referral_media_type TEXT,
      referral_media_id TEXT,
      raw_referral JSONB,
      raw_last_message JSONB,

      UNIQUE (waba_id, wa_id)
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS whatsapp_conversations_ctwa_clid_idx
      ON whatsapp_conversations (ctwa_clid)
  `

  await sql`
    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMP DEFAULT now(),
      conversation_id UUID REFERENCES whatsapp_conversations(id),

      event_key TEXT NOT NULL UNIQUE,
      waba_id TEXT NOT NULL,
      wa_id TEXT,
      phone_number_id TEXT,
      payload_type VARCHAR(20) NOT NULL,
      message_id TEXT,
      status TEXT,
      direction VARCHAR(20) DEFAULT 'system',
      message_type TEXT,
      message_text TEXT,
      event_timestamp TIMESTAMP,
      raw_payload JSONB NOT NULL
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS conversions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMP DEFAULT now(),

      customer_name TEXT,
      customer_phone TEXT,
      customer_email TEXT,

      value NUMERIC(10,2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'BRL',
      product_name TEXT,
      notes TEXT,

      event_id UUID NOT NULL UNIQUE,
      event_name VARCHAR(50) DEFAULT 'Purchase',
      meta_status VARCHAR(20) DEFAULT 'pending',
      meta_response JSONB,
      meta_event_payload JSONB,
      meta_sent_at TIMESTAMP,
      dataset_id TEXT,
      whatsapp_conversation_id UUID REFERENCES whatsapp_conversations(id),
      ctwa_clid TEXT,

      source VARCHAR(20) DEFAULT 'manual',
      source_ref TEXT UNIQUE
    )
  `

  await sql`
    ALTER TABLE conversions
    ADD COLUMN IF NOT EXISTS meta_event_payload JSONB
  `
  await sql`
    ALTER TABLE conversions
    ADD COLUMN IF NOT EXISTS dataset_id TEXT
  `
  await sql`
    ALTER TABLE conversions
    ADD COLUMN IF NOT EXISTS whatsapp_conversation_id UUID
  `
  await sql`
    ALTER TABLE conversions
    ADD COLUMN IF NOT EXISTS ctwa_clid TEXT
  `

  await sql`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMP DEFAULT now(),
      source TEXT NOT NULL DEFAULT 'whatsapp',
      event_type TEXT,
      outcome TEXT NOT NULL,
      signature_valid BOOLEAN,
      http_method TEXT NOT NULL DEFAULT 'POST',
      request_headers JSONB,
      raw_body TEXT NOT NULL,
      payload JSONB,
      entry_count INTEGER DEFAULT 0,
      change_count INTEGER DEFAULT 0,
      conversations_upserted INTEGER DEFAULT 0,
      message_events_stored INTEGER DEFAULT 0,
      status_events_stored INTEGER DEFAULT 0,
      ignored_entries INTEGER DEFAULT 0,
      ignored_changes INTEGER DEFAULT 0,
      error_message TEXT
    )
  `

  return { ok: true }
}

export async function getAppSetting(key: string): Promise<string | null> {
  const rows = await sql`
    SELECT value
    FROM app_settings
    WHERE key = ${key}
    LIMIT 1
  `

  return typeof rows[0]?.value === 'string' ? rows[0].value : null
}

export async function setAppSetting(key: string, value: string) {
  await sql`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (${key}, ${value}, now())
    ON CONFLICT (key)
    DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = now()
  `
}

export async function listConversions(): Promise<Conversion[]> {
  const rows = await sql`
    SELECT *
    FROM conversions
    ORDER BY created_at DESC
    LIMIT 100
  `

  return rows as Conversion[]
}

export async function countConversions(options?: {
  eventName?: string
  status?: Conversion['meta_status']
}): Promise<number> {
  const eventName = options?.eventName || null
  const status = options?.status || null

  const rows =
    eventName && status
      ? await sql`
          SELECT count(*)::int AS count
          FROM conversions
          WHERE event_name = ${eventName}
            AND meta_status = ${status}
        `
      : eventName
        ? await sql`
            SELECT count(*)::int AS count
            FROM conversions
            WHERE event_name = ${eventName}
          `
        : status
          ? await sql`
              SELECT count(*)::int AS count
              FROM conversions
              WHERE meta_status = ${status}
            `
          : await sql`
              SELECT count(*)::int AS count
              FROM conversions
            `

  return Number(rows[0]?.count || 0)
}

export async function getConversion(id: string): Promise<Conversion | null> {
  const rows = await sql`
    SELECT *
    FROM conversions
    WHERE id = ${id}
    LIMIT 1
  `

  return (rows[0] as Conversion) || null
}

export async function getConversionBySourceRef(sourceRef: string): Promise<Conversion | null> {
  const rows = await sql`
    SELECT *
    FROM conversions
    WHERE source_ref = ${sourceRef}
    LIMIT 1
  `

  return (rows[0] as Conversion) || null
}

export async function listLeadConversions(): Promise<Conversion[]> {
  const rows = await sql`
    SELECT *
    FROM conversions
    WHERE event_name = 'LeadSubmitted'
    ORDER BY created_at DESC
    LIMIT 300
  `

  return rows as Conversion[]
}

export async function listWhatsAppConversations(options?: {
  onlyAttributed?: boolean
}): Promise<WhatsAppConversation[]> {
  const onlyAttributed = options?.onlyAttributed ?? false

  const rows = onlyAttributed
    ? await sql`
        SELECT *
        FROM whatsapp_conversations
        WHERE ctwa_clid IS NOT NULL
        ORDER BY latest_message_at DESC NULLS LAST, updated_at DESC
        LIMIT 200
      `
    : await sql`
        SELECT *
        FROM whatsapp_conversations
        ORDER BY latest_message_at DESC NULLS LAST, updated_at DESC
        LIMIT 200
      `

  return rows as WhatsAppConversation[]
}

export async function countWhatsAppConversations(options?: {
  onlyAttributed?: boolean
}): Promise<number> {
  const onlyAttributed = options?.onlyAttributed ?? false

  const rows = onlyAttributed
    ? await sql`
        SELECT count(*)::int AS count
        FROM whatsapp_conversations
        WHERE ctwa_clid IS NOT NULL
      `
    : await sql`
        SELECT count(*)::int AS count
        FROM whatsapp_conversations
      `

  return Number(rows[0]?.count || 0)
}

export async function getWhatsAppConversation(id: string): Promise<WhatsAppConversation | null> {
  const rows = await sql`
    SELECT *
    FROM whatsapp_conversations
    WHERE id = ${id}
    LIMIT 1
  `

  return (rows[0] as WhatsAppConversation) || null
}

export async function listWhatsAppMessages(options?: {
  limit?: number
}): Promise<WhatsAppMessage[]> {
  const limit = Math.max(1, Math.min(options?.limit ?? 100, 500))

  const rows = await sql`
    SELECT *
    FROM whatsapp_messages
    ORDER BY event_timestamp DESC NULLS LAST, created_at DESC
    LIMIT ${limit}
  `

  return rows as WhatsAppMessage[]
}

export async function countWhatsAppMessages(): Promise<number> {
  const rows = await sql`
    SELECT count(*)::int AS count
    FROM whatsapp_messages
  `

  return Number(rows[0]?.count || 0)
}

export async function listWebhookDeliveries(options?: {
  limit?: number
}): Promise<WebhookDelivery[]> {
  const limit = Math.max(1, Math.min(options?.limit ?? 100, 500))

  const rows = await sql`
    SELECT *
    FROM webhook_deliveries
    ORDER BY created_at DESC
    LIMIT ${limit}
  `

  return rows as WebhookDelivery[]
}

export async function countWebhookDeliveries(): Promise<number> {
  const rows = await sql`
    SELECT count(*)::int AS count
    FROM webhook_deliveries
  `

  return Number(rows[0]?.count || 0)
}

export async function insertWebhookDelivery(data: {
  source?: string
  eventType?: string | null
  outcome: WebhookDelivery['outcome']
  signatureValid?: boolean | null
  httpMethod?: string
  requestHeaders?: Record<string, unknown> | null
  rawBody: string
  payload?: Record<string, unknown> | null
  entryCount?: number
  changeCount?: number
  conversationsUpserted?: number
  messageEventsStored?: number
  statusEventsStored?: number
  ignoredEntries?: number
  ignoredChanges?: number
  errorMessage?: string | null
}): Promise<WebhookDelivery> {
  const rows = await sql`
    INSERT INTO webhook_deliveries (
      source,
      event_type,
      outcome,
      signature_valid,
      http_method,
      request_headers,
      raw_body,
      payload,
      entry_count,
      change_count,
      conversations_upserted,
      message_events_stored,
      status_events_stored,
      ignored_entries,
      ignored_changes,
      error_message
    ) VALUES (
      ${data.source || 'whatsapp'},
      ${data.eventType || null},
      ${data.outcome},
      ${data.signatureValid ?? null},
      ${data.httpMethod || 'POST'},
      ${data.requestHeaders ? JSON.stringify(data.requestHeaders) : null},
      ${data.rawBody},
      ${data.payload ? JSON.stringify(data.payload) : null},
      ${data.entryCount || 0},
      ${data.changeCount || 0},
      ${data.conversationsUpserted || 0},
      ${data.messageEventsStored || 0},
      ${data.statusEventsStored || 0},
      ${data.ignoredEntries || 0},
      ${data.ignoredChanges || 0},
      ${data.errorMessage || null}
    )
    RETURNING *
  `

  return rows[0] as WebhookDelivery
}

export async function upsertWhatsAppConversationFromWebhook(data: {
  wabaId: string
  phoneNumberId?: string | null
  displayPhoneNumber?: string | null
  waId: string
  customerName?: string | null
  customerPhone?: string | null
  latestMessageId?: string | null
  latestMessageAt?: string | null
  latestMessageText?: string | null
  latestMessageType?: string | null
  ctwaClid?: string | null
  referralSourceId?: string | null
  referralSourceType?: string | null
  referralSourceUrl?: string | null
  referralHeadline?: string | null
  referralBody?: string | null
  referralMediaType?: string | null
  referralMediaId?: string | null
  rawReferral?: Record<string, unknown> | null
  rawLastMessage?: Record<string, unknown> | null
}): Promise<WhatsAppConversation> {
  const rows = await sql`
    INSERT INTO whatsapp_conversations (
      waba_id,
      phone_number_id,
      display_phone_number,
      wa_id,
      customer_name,
      customer_phone,
      latest_message_id,
      latest_message_at,
      latest_message_text,
      latest_message_type,
      ctwa_clid,
      referral_source_id,
      referral_source_type,
      referral_source_url,
      referral_headline,
      referral_body,
      referral_media_type,
      referral_media_id,
      raw_referral,
      raw_last_message,
      updated_at
    ) VALUES (
      ${data.wabaId},
      ${data.phoneNumberId || null},
      ${data.displayPhoneNumber || null},
      ${data.waId},
      ${data.customerName || null},
      ${data.customerPhone || null},
      ${data.latestMessageId || null},
      ${data.latestMessageAt || null},
      ${data.latestMessageText || null},
      ${data.latestMessageType || null},
      ${data.ctwaClid || null},
      ${data.referralSourceId || null},
      ${data.referralSourceType || null},
      ${data.referralSourceUrl || null},
      ${data.referralHeadline || null},
      ${data.referralBody || null},
      ${data.referralMediaType || null},
      ${data.referralMediaId || null},
      ${data.rawReferral ? JSON.stringify(data.rawReferral) : null},
      ${data.rawLastMessage ? JSON.stringify(data.rawLastMessage) : null},
      now()
    )
    ON CONFLICT (waba_id, wa_id)
    DO UPDATE SET
      updated_at = now(),
      phone_number_id = COALESCE(EXCLUDED.phone_number_id, whatsapp_conversations.phone_number_id),
      display_phone_number = COALESCE(EXCLUDED.display_phone_number, whatsapp_conversations.display_phone_number),
      customer_name = COALESCE(EXCLUDED.customer_name, whatsapp_conversations.customer_name),
      customer_phone = COALESCE(EXCLUDED.customer_phone, whatsapp_conversations.customer_phone),
      latest_message_id = COALESCE(EXCLUDED.latest_message_id, whatsapp_conversations.latest_message_id),
      latest_message_at = COALESCE(EXCLUDED.latest_message_at, whatsapp_conversations.latest_message_at),
      latest_message_text = COALESCE(EXCLUDED.latest_message_text, whatsapp_conversations.latest_message_text),
      latest_message_type = COALESCE(EXCLUDED.latest_message_type, whatsapp_conversations.latest_message_type),
      ctwa_clid = COALESCE(EXCLUDED.ctwa_clid, whatsapp_conversations.ctwa_clid),
      referral_source_id = COALESCE(EXCLUDED.referral_source_id, whatsapp_conversations.referral_source_id),
      referral_source_type = COALESCE(EXCLUDED.referral_source_type, whatsapp_conversations.referral_source_type),
      referral_source_url = COALESCE(EXCLUDED.referral_source_url, whatsapp_conversations.referral_source_url),
      referral_headline = COALESCE(EXCLUDED.referral_headline, whatsapp_conversations.referral_headline),
      referral_body = COALESCE(EXCLUDED.referral_body, whatsapp_conversations.referral_body),
      referral_media_type = COALESCE(EXCLUDED.referral_media_type, whatsapp_conversations.referral_media_type),
      referral_media_id = COALESCE(EXCLUDED.referral_media_id, whatsapp_conversations.referral_media_id),
      raw_referral = COALESCE(EXCLUDED.raw_referral, whatsapp_conversations.raw_referral),
      raw_last_message = COALESCE(EXCLUDED.raw_last_message, whatsapp_conversations.raw_last_message)
    RETURNING *
  `

  return rows[0] as WhatsAppConversation
}

export async function upsertWhatsAppMessage(data: {
  conversationId?: string | null
  eventKey: string
  wabaId: string
  waId?: string | null
  phoneNumberId?: string | null
  payloadType: 'message' | 'status'
  messageId?: string | null
  status?: string | null
  direction: 'inbound' | 'outbound' | 'system'
  messageType?: string | null
  messageText?: string | null
  eventTimestamp?: string | null
  rawPayload: Record<string, unknown>
}): Promise<WhatsAppMessage> {
  const rows = await sql`
    INSERT INTO whatsapp_messages (
      conversation_id,
      event_key,
      waba_id,
      wa_id,
      phone_number_id,
      payload_type,
      message_id,
      status,
      direction,
      message_type,
      message_text,
      event_timestamp,
      raw_payload
    ) VALUES (
      ${data.conversationId || null},
      ${data.eventKey},
      ${data.wabaId},
      ${data.waId || null},
      ${data.phoneNumberId || null},
      ${data.payloadType},
      ${data.messageId || null},
      ${data.status || null},
      ${data.direction},
      ${data.messageType || null},
      ${data.messageText || null},
      ${data.eventTimestamp || null},
      ${JSON.stringify(data.rawPayload)}
    )
    ON CONFLICT (event_key)
    DO UPDATE SET
      conversation_id = COALESCE(EXCLUDED.conversation_id, whatsapp_messages.conversation_id),
      status = COALESCE(EXCLUDED.status, whatsapp_messages.status),
      message_text = COALESCE(EXCLUDED.message_text, whatsapp_messages.message_text),
      raw_payload = EXCLUDED.raw_payload
    RETURNING *
  `

  return rows[0] as WhatsAppMessage
}

export async function insertConversion(data: {
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  value: number
  currency: string
  productName?: string
  notes?: string
  eventId: string
  eventName: string
  source?: Conversion['source']
  sourceRef?: string
  whatsappConversationId?: string
  ctwaClid?: string
  datasetId?: string
}): Promise<Conversion> {
  const rows = await sql`
    INSERT INTO conversions (
      customer_name,
      customer_phone,
      customer_email,
      value,
      currency,
      product_name,
      notes,
      event_id,
      event_name,
      meta_status,
      dataset_id,
      whatsapp_conversation_id,
      ctwa_clid,
      source,
      source_ref
    ) VALUES (
      ${data.customerName || null},
      ${data.customerPhone || null},
      ${data.customerEmail || null},
      ${data.value},
      ${data.currency || 'BRL'},
      ${data.productName || null},
      ${data.notes || null},
      ${data.eventId},
      ${data.eventName || 'Purchase'},
      'pending',
      ${data.datasetId || null},
      ${data.whatsappConversationId || null},
      ${data.ctwaClid || null},
      ${data.source || 'manual'},
      ${data.sourceRef || null}
    )
    RETURNING *
  `

  return rows[0] as Conversion
}

export async function updateConversionMetaStatus(
  id: string,
  status: 'sent' | 'error',
  response: Record<string, unknown>,
  options?: {
    datasetId?: string | null
    ctwaClid?: string | null
    metaEventPayload?: Record<string, unknown> | null
  }
) {
  await sql`
    UPDATE conversions
    SET
      meta_status = ${status},
      meta_response = ${JSON.stringify(response)},
      meta_event_payload = ${options?.metaEventPayload ? JSON.stringify(options.metaEventPayload) : null},
      dataset_id = COALESCE(${options?.datasetId || null}, dataset_id),
      ctwa_clid = COALESCE(${options?.ctwaClid || null}, ctwa_clid),
      meta_sent_at = now()
    WHERE id = ${id}
  `
}
