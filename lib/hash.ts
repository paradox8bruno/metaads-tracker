import { createHash } from 'crypto'

/**
 * Normaliza e hasheia dados de PII para o Meta CAPI.
 * O Meta exige SHA-256 de dados em lowercase/sem espaços.
 */

export function hashData(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

/**
 * Normaliza telefone brasileiro para formato E.164 antes de hashear.
 * Ex: "(11) 99999-9999" → "5511999999999"
 */
export function normalizeAndHashPhone(phone: string): string {
  // Remove tudo que não é número
  let digits = phone.replace(/\D/g, '')

  // Se começar com 0, remove
  if (digits.startsWith('0')) {
    digits = digits.substring(1)
  }

  // Se não tiver código do país (BR = 55), adiciona
  if (!digits.startsWith('55') && digits.length <= 11) {
    digits = '55' + digits
  }

  return hashData(digits)
}

/**
 * Hasheia email normalizando para lowercase
 */
export function hashEmail(email: string): string {
  return hashData(email.toLowerCase().trim())
}
