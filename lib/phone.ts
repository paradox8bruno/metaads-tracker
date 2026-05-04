/**
 * Meta CAPI espera telefone normalizado com código do país e apenas dígitos.
 * Para Brasil: 55 + DDD + número, totalizando 12 ou 13 dígitos.
 */
export function normalizeBrazilPhone(phone: string): string | null {
  if (!phone) return null

  let digits = phone.replace(/\D/g, '')

  if (!digits) return null

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  if (!digits.startsWith('55') && digits.startsWith('0')) {
    digits = digits.slice(1)
  }

  if (!digits.startsWith('55')) {
    if (digits.length === 10 || digits.length === 11) {
      digits = `55${digits}`
    } else {
      return null
    }
  }

  if (digits.length !== 12 && digits.length !== 13) {
    return null
  }

  return digits
}

export function formatBrazilPhone(phone: string): string {
  const normalized = normalizeBrazilPhone(phone)

  if (!normalized) return phone

  const nationalNumber = normalized.slice(2)
  const ddd = nationalNumber.slice(0, 2)
  const localNumber = nationalNumber.slice(2)

  if (localNumber.length === 8) {
    return `+55 ${ddd} ${localNumber.slice(0, 4)}-${localNumber.slice(4)}`
  }

  if (localNumber.length === 9) {
    return `+55 ${ddd} ${localNumber.slice(0, 5)}-${localNumber.slice(5)}`
  }

  return `+${normalized}`
}

export function isValidBrazilPhone(phone: string): boolean {
  return normalizeBrazilPhone(phone) !== null
}
