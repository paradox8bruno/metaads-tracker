import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'crypto'
import { NextRequest } from 'next/server'

const dbMocks = vi.hoisted(() => ({
  getConversionBySourceRef: vi.fn(),
  initDB: vi.fn(),
  insertConversion: vi.fn(),
  insertWebhookDelivery: vi.fn(),
  updateConversionMetaStatus: vi.fn(),
  upsertWhatsAppConversationFromWebhook: vi.fn(),
  upsertWhatsAppMessage: vi.fn(),
  upsertWhatsAppWebhookTopicEvent: vi.fn(),
}))

const capiMocks = vi.hoisted(() => ({
  sendConversionEvent: vi.fn(),
}))

vi.mock('@/lib/db', () => dbMocks)
vi.mock('@/lib/meta-capi', () => capiMocks)

function makeSignature(body: string, secret: string) {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
}

function makePostRequest(body: Record<string, unknown>, secret: string) {
  const rawBody = JSON.stringify(body)

  return new NextRequest('http://localhost/api/webhooks/whatsapp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': makeSignature(rawBody, secret),
    },
    body: rawBody,
  })
}

async function loadRoute() {
  vi.resetModules()
  return import('@/app/api/webhooks/whatsapp/route')
}

describe('WhatsApp webhook route', () => {
  const appSecret = 'meta-secret-123'
  const verifyToken = 'verify-token-abc'

  beforeEach(() => {
    vi.stubEnv('META_APP_SECRET', appSecret)
    vi.stubEnv('WHATSAPP_WEBHOOK_VERIFY_TOKEN', verifyToken)
    vi.stubEnv('WHATSAPP_BUSINESS_ACCOUNT_ID', '25918732601086622')
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '1050440834824684')

    dbMocks.initDB.mockResolvedValue({ ok: true })
    dbMocks.insertWebhookDelivery.mockResolvedValue({ id: 'delivery-1' })
    dbMocks.getConversionBySourceRef.mockResolvedValue(null)
    dbMocks.insertConversion.mockResolvedValue({
      id: 'conversion-1',
      event_id: 'event-1',
    })
    dbMocks.updateConversionMetaStatus.mockResolvedValue(undefined)
    dbMocks.upsertWhatsAppConversationFromWebhook.mockResolvedValue({
      id: 'conversation-1',
      customer_name: 'Lead Teste',
      customer_phone: '5511999999999',
      ctwa_clid: 'AfiValidClickId123',
    })
    dbMocks.upsertWhatsAppMessage.mockResolvedValue({ id: 'message-1' })
    dbMocks.upsertWhatsAppWebhookTopicEvent.mockResolvedValue({ id: 'topic-1' })

    capiMocks.sendConversionEvent.mockResolvedValue({
      datasetId: '1710893766988755',
      eventPayload: { event_name: 'LeadSubmitted' },
      response: { events_received: 1 },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('verifica o webhook via GET', async () => {
    const { GET } = await loadRoute()
    const req = new NextRequest(
      `http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=12345&hub.verify_token=${verifyToken}`
    )

    const response = await GET(req)
    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe('12345')
  })

  it('processa mensagens inbound com referral e dispara lead automático', async () => {
    const { POST } = await loadRoute()

    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '25918732601086622',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '+55 11 93622-9510',
                  phone_number_id: '1050440834824684',
                },
                contacts: [
                  {
                    wa_id: '5511999999999',
                    profile: { name: 'Lead Teste' },
                  },
                ],
                messages: [
                  {
                    from: '5511999999999',
                    id: 'wamid.123',
                    timestamp: '1776000000',
                    type: 'text',
                    text: { body: 'Quero saber mais' },
                    referral: {
                      ctwa_clid: 'AfiValidClickId123',
                      source_id: '120248829876260273',
                      source_type: 'ad',
                      source_url: 'https://facebook.com/ad-preview',
                      headline: 'Teste',
                      body: 'Body do anúncio',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    const response = await POST(makePostRequest(payload, appSecret))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      ok: true,
      conversationsUpserted: 1,
      messageEventsStored: 1,
      echoEventsStored: 0,
      automaticEventsStored: 0,
      trackingEventsStored: 0,
    })

    expect(dbMocks.upsertWhatsAppConversationFromWebhook).toHaveBeenCalledTimes(1)
    expect(dbMocks.upsertWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payloadType: 'message',
        direction: 'inbound',
        messageText: 'Quero saber mais',
      })
    )
    expect(dbMocks.insertConversion).toHaveBeenCalledTimes(1)
    expect(capiMocks.sendConversionEvent).toHaveBeenCalledTimes(1)
    expect(dbMocks.insertWebhookDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'accepted',
        messageEventsStored: 1,
        echoEventsStored: 0,
        automaticEventsStored: 0,
        trackingEventsStored: 0,
      })
    )
  })

  it('processa smb_message_echoes como mensagem outbound', async () => {
    const { POST } = await loadRoute()

    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '25918732601086622',
          changes: [
            {
              field: 'smb_message_echoes',
              value: {
                metadata: {
                  display_phone_number: '+55 11 93622-9510',
                  phone_number_id: '1050440834824684',
                },
                contacts: [
                  {
                    wa_id: '5511888888888',
                    profile: { name: 'Contato App' },
                  },
                ],
                messages: [
                  {
                    to: '5511888888888',
                    id: 'wamid.echo123',
                    timestamp: '1776001234',
                    type: 'text',
                    text: { body: 'Resposta enviada pelo app' },
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    const response = await POST(makePostRequest(payload, appSecret))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      ok: true,
      conversationsUpserted: 1,
      messageEventsStored: 0,
      echoEventsStored: 1,
    })

    expect(dbMocks.upsertWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payloadType: 'echo',
        direction: 'outbound',
        messageText: 'Resposta enviada pelo app',
      })
    )
    expect(dbMocks.insertConversion).not.toHaveBeenCalled()
  })

  it('salva automatic_events e tracking_events para auditoria', async () => {
    const { POST } = await loadRoute()

    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '0',
          changes: [
            {
              field: 'automatic_events',
              value: {
                metadata: {
                  phone_number_id: '1050440834824684',
                },
                automatic_events: [
                  {
                    id: 'evt-auto-1',
                    event_name: 'purchase',
                    timestamp: '1776005000',
                    wa_id: '5511777777777',
                  },
                ],
              },
            },
            {
              field: 'tracking_events',
              value: {
                metadata: {
                  phone_number_id: '1050440834824684',
                },
                data: [
                  {
                    event_name: 'CONVERSATION_ATTRIBUTED',
                    timestamp: '1776006000',
                    recipient_id: '5511666666666',
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    const response = await POST(makePostRequest(payload, appSecret))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      ok: true,
      automaticEventsStored: 1,
      trackingEventsStored: 1,
    })

    expect(dbMocks.upsertWhatsAppWebhookTopicEvent).toHaveBeenCalledTimes(2)
    expect(dbMocks.insertWebhookDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        automaticEventsStored: 1,
        trackingEventsStored: 1,
      })
    )
  })
})
