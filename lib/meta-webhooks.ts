import { createHmac, timingSafeEqual } from 'crypto'

export function extractDigits(value: string | null | undefined): string | null {
  if (!value) return null

  const digits = value.replace(/\D/g, '')
  return digits || null
}

export function parseWebhookTimestamp(value: string | null | undefined): string | null {
  if (!value) return null

  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return null

  return new Date(timestamp * 1000).toISOString()
}

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | undefined
): boolean {
  if (!appSecret) {
    return true
  }

  if (!signatureHeader?.startsWith('sha256=')) {
    return false
  }

  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex')
  const received = signatureHeader.slice('sha256='.length)

  if (expected.length !== received.length) {
    return false
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(received))
}
