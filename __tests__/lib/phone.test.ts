import { describe, it, expect } from 'vitest'
import { normalizeBrazilPhone, formatBrazilPhone, isValidBrazilPhone } from '@/lib/phone'

describe('normalizeBrazilPhone', () => {
  it('normaliza celular com DDD sem código de país', () => {
    expect(normalizeBrazilPhone('11999999999')).toBe('5511999999999')
  })

  it('normaliza fixo com DDD sem código de país', () => {
    expect(normalizeBrazilPhone('1133334444')).toBe('551133334444')
  })

  it('normaliza com +55 já presente', () => {
    expect(normalizeBrazilPhone('+5511999999999')).toBe('5511999999999')
  })

  it('normaliza com 55 já presente (sem +)', () => {
    expect(normalizeBrazilPhone('5511999999999')).toBe('5511999999999')
  })

  it('normaliza removendo espaços, traços e parênteses', () => {
    expect(normalizeBrazilPhone('+55 (11) 99999-9999')).toBe('5511999999999')
    expect(normalizeBrazilPhone('(11) 9 9999-9999')).toBe('5511999999999')
  })

  it('normaliza com prefixo 00', () => {
    expect(normalizeBrazilPhone('005511999999999')).toBe('5511999999999')
  })

  it('normaliza com 0 de discagem nacional', () => {
    expect(normalizeBrazilPhone('011999999999')).toBe('5511999999999')
  })

  it('retorna null para número muito curto', () => {
    expect(normalizeBrazilPhone('99999')).toBeNull()
  })

  it('retorna null para string vazia', () => {
    expect(normalizeBrazilPhone('')).toBeNull()
  })

  it('retorna null para número sem DDD (8 dígitos)', () => {
    expect(normalizeBrazilPhone('99999999')).toBeNull()
  })

  it('retorna null para número com 14+ dígitos (claramente internacional)', () => {
    // Números com código de país diferente do Brasil e comprimento incompatível
    expect(normalizeBrazilPhone('+44 20 7946 0958')).toBeNull() // UK: 442079460958 = 12 dígitos → null (começa com 44, não 55)
  })

  it('limitação conhecida: número de 10-11 dígitos sem código de país é assumido brasileiro', () => {
    // +1 212 555 0100 → dígitos: 12125550100 (11 dígitos sem 55) → aceito como brasileiro
    // Este é o comportamento esperado: a função só suporta telefones brasileiros
    expect(normalizeBrazilPhone('+1 212 555 0100')).toBe('5512125550100')
  })

  it('normaliza wa_id (formato do WhatsApp sem +)', () => {
    expect(normalizeBrazilPhone('5511987654321')).toBe('5511987654321')
  })
})

describe('formatBrazilPhone', () => {
  it('formata celular com 9 dígitos', () => {
    expect(formatBrazilPhone('5511999999999')).toBe('+55 11 99999-9999')
  })

  it('formata fixo com 8 dígitos', () => {
    expect(formatBrazilPhone('551133334444')).toBe('+55 11 3333-4444')
  })

  it('retorna string original se não conseguir normalizar', () => {
    expect(formatBrazilPhone('invalido')).toBe('invalido')
  })

  it('formata a partir de número com +55 formatado', () => {
    expect(formatBrazilPhone('+55 (11) 99999-9999')).toBe('+55 11 99999-9999')
  })
})

describe('isValidBrazilPhone', () => {
  it('retorna true para celular válido', () => {
    expect(isValidBrazilPhone('5511999999999')).toBe(true)
    expect(isValidBrazilPhone('+55 11 99999-9999')).toBe(true)
  })

  it('retorna false para número inválido (muito curto ou sem DDD)', () => {
    expect(isValidBrazilPhone('99999')).toBe(false)
    expect(isValidBrazilPhone('')).toBe(false)
  })

  it('retorna false para número com código de país não suportado', () => {
    expect(isValidBrazilPhone('+44 20 7946 0958')).toBe(false) // UK
  })
})
