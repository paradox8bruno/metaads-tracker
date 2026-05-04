import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import {
  extractDigits,
  parseWebhookTimestamp,
  verifyMetaWebhookSignature,
} from '@/lib/meta-webhooks'

describe('extractDigits', () => {
  it('extrai apenas dígitos de uma string', () => {
    expect(extractDigits('5511999999999')).toBe('5511999999999')
    expect(extractDigits('+55 (11) 99999-9999')).toBe('5511999999999')
    expect(extractDigits('abc123def456')).toBe('123456')
  })

  it('retorna null para string sem dígitos', () => {
    expect(extractDigits('abc')).toBeNull()
    expect(extractDigits('')).toBeNull()
  })

  it('retorna null para null/undefined', () => {
    expect(extractDigits(null)).toBeNull()
    expect(extractDigits(undefined)).toBeNull()
  })
})

describe('parseWebhookTimestamp', () => {
  it('converte timestamp Unix para ISO string', () => {
    // 1700000000 = 2023-11-14T22:13:20.000Z
    const result = parseWebhookTimestamp('1700000000')
    expect(result).toBe('2023-11-14T22:13:20.000Z')
  })

  it('retorna null para valor vazio', () => {
    expect(parseWebhookTimestamp(null)).toBeNull()
    expect(parseWebhookTimestamp(undefined)).toBeNull()
    expect(parseWebhookTimestamp('')).toBeNull()
  })

  it('retorna null para valor não numérico', () => {
    expect(parseWebhookTimestamp('abc')).toBeNull()
  })

  it('converte timestamp como número', () => {
    const ts = Math.floor(Date.now() / 1000)
    const result = parseWebhookTimestamp(String(ts))
    expect(result).not.toBeNull()
    expect(new Date(result!).getTime()).toBeCloseTo(ts * 1000, -3)
  })
})

describe('verifyMetaWebhookSignature', () => {
  const appSecret = 'test-secret-123'

  function makeSignature(body: string, secret: string): string {
    const hmac = createHmac('sha256', secret)
    hmac.update(body)
    return `sha256=${hmac.digest('hex')}`
  }

  it('retorna true para assinatura correta', () => {
    const body = '{"test":"payload"}'
    const signature = makeSignature(body, appSecret)
    expect(verifyMetaWebhookSignature(body, signature, appSecret)).toBe(true)
  })

  it('retorna false para assinatura incorreta', () => {
    const body = '{"test":"payload"}'
    expect(
      verifyMetaWebhookSignature(body, 'sha256=aabbccddeeff0011', appSecret)
    ).toBe(false)
  })

  it('retorna false para assinatura sem prefixo sha256=', () => {
    const body = '{"test":"payload"}'
    const hmac = createHmac('sha256', appSecret).update(body).digest('hex')
    expect(verifyMetaWebhookSignature(body, hmac, appSecret)).toBe(false)
  })

  it('retorna false para assinatura null', () => {
    expect(verifyMetaWebhookSignature('{}', null, appSecret)).toBe(false)
  })

  it('retorna false se tamanhos diferentes (previne timing attack)', () => {
    const body = '{"test":"payload"}'
    expect(
      verifyMetaWebhookSignature(body, 'sha256=abc', appSecret)
    ).toBe(false)
  })

  it('retorna true se appSecret é undefined (skip de verificação)', () => {
    // Comportamento atual: sem secret → não valida
    expect(verifyMetaWebhookSignature('{}', 'sha256=anything', undefined)).toBe(true)
  })

  it('payload vazio com assinatura válida', () => {
    const body = ''
    const signature = makeSignature(body, appSecret)
    expect(verifyMetaWebhookSignature(body, signature, appSecret)).toBe(true)
  })

  it('payload com caracteres especiais', () => {
    const body = '{"name":"João","emoji":"😀"}'
    const signature = makeSignature(body, appSecret)
    expect(verifyMetaWebhookSignature(body, signature, appSecret)).toBe(true)
  })
})
