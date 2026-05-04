import { createHash } from 'crypto'
import { normalizeBrazilPhone } from './phone'

/**
 * Normaliza e hasheia dados de PII para o Meta CAPI.
 * O Meta exige SHA-256 de dados em lowercase/sem espaços.
 */

export function hashData(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

/**
 * Normaliza telefone brasileiro para dígitos com código do país antes de hashear.
 * Ex: "(11) 99999-9999" → "5511999999999"
 */
export function normalizeAndHashPhone(phone: string): string | null {
  const normalizedPhone = normalizeBrazilPhone(phone)

  if (!normalizedPhone) return null

  return hashData(normalizedPhone)
}

/**
 * Hasheia email normalizando para lowercase
 */
export function hashEmail(email: string): string {
  return hashData(email.toLowerCase().trim())
}
