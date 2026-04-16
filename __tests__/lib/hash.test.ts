import { describe, it, expect } from 'vitest'
import { hashData, hashEmail, normalizeAndHashPhone } from '@/lib/hash'

describe('hashData', () => {
  it('produz SHA-256 hex de 64 chars', () => {
    const result = hashData('test')
    expect(result).toHaveLength(64)
    expect(result).toMatch(/^[a-f0-9]+$/)
  })

  it('normaliza para lowercase antes de hashear', () => {
    expect(hashData('TEST')).toBe(hashData('test'))
    expect(hashData('Hello')).toBe(hashData('hello'))
  })

  it('trim antes de hashear', () => {
    expect(hashData('  test  ')).toBe(hashData('test'))
  })

  it('hash conhecido para string vazia', () => {
    // SHA-256 de "" é e3b0c44298fc1c149afb...
    expect(hashData('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})

describe('hashEmail', () => {
  it('normaliza email para lowercase e hasheia', () => {
    expect(hashEmail('USER@EXAMPLE.COM')).toBe(hashEmail('user@example.com'))
  })

  it('faz trim do email', () => {
    expect(hashEmail('  user@example.com  ')).toBe(hashEmail('user@example.com'))
  })

  it('produz hash de 64 chars', () => {
    expect(hashEmail('user@example.com')).toHaveLength(64)
  })
})

describe('normalizeAndHashPhone', () => {
  it('normaliza telefone brasileiro e hasheia', () => {
    const result = normalizeAndHashPhone('11999999999')
    expect(result).not.toBeNull()
    expect(result).toHaveLength(64)
  })

  it('resulta no mesmo hash independente da formatação', () => {
    const h1 = normalizeAndHashPhone('5511999999999')
    const h2 = normalizeAndHashPhone('+55 (11) 99999-9999')
    const h3 = normalizeAndHashPhone('11999999999')
    expect(h1).toBe(h2)
    expect(h1).toBe(h3)
  })

  it('retorna null para telefone muito curto ou vazio', () => {
    expect(normalizeAndHashPhone('99999')).toBeNull()
    expect(normalizeAndHashPhone('')).toBeNull()
  })

  it('retorna null para número com código de país não suportado', () => {
    expect(normalizeAndHashPhone('+44 20 7946 0958')).toBeNull() // UK
  })

  it('o hash é de "5511999999999" (normalizado)', () => {
    const expected = hashData('5511999999999')
    expect(normalizeAndHashPhone('11999999999')).toBe(expected)
  })
})
