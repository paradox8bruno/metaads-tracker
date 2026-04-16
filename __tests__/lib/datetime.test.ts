import { describe, it, expect } from 'vitest'
import { parseDatabaseTimestamp, formatDatabaseTimestamp } from '@/lib/datetime'

describe('parseDatabaseTimestamp', () => {
  it('retorna null para null/undefined', () => {
    expect(parseDatabaseTimestamp(null)).toBeNull()
    expect(parseDatabaseTimestamp(undefined)).toBeNull()
  })

  it('retorna a mesma Date para instância válida de Date', () => {
    const d = new Date('2024-01-15T10:30:00.000Z')
    expect(parseDatabaseTimestamp(d)).toBe(d)
  })

  it('retorna null para Date inválida', () => {
    expect(parseDatabaseTimestamp(new Date('invalid'))).toBeNull()
  })

  it('parseia formato Postgres sem timezone (wall-clock UTC)', () => {
    const result = parseDatabaseTimestamp('2024-01-15 10:30:45')
    expect(result).not.toBeNull()
    expect(result!.getUTCFullYear()).toBe(2024)
    expect(result!.getUTCMonth()).toBe(0) // Janeiro
    expect(result!.getUTCDate()).toBe(15)
    expect(result!.getUTCHours()).toBe(10)
    expect(result!.getUTCMinutes()).toBe(30)
    expect(result!.getUTCSeconds()).toBe(45)
  })

  it('parseia formato ISO com T', () => {
    const result = parseDatabaseTimestamp('2024-06-20T15:00:00')
    expect(result).not.toBeNull()
    expect(result!.getUTCHours()).toBe(15)
  })

  it('parseia com milissegundos', () => {
    const result = parseDatabaseTimestamp('2024-01-15 10:30:45.123')
    expect(result).not.toBeNull()
    expect(result!.getUTCMilliseconds()).toBe(123)
  })

  it('parseia sem segundos', () => {
    const result = parseDatabaseTimestamp('2024-01-15 10:30')
    expect(result).not.toBeNull()
    expect(result!.getUTCSeconds()).toBe(0)
  })

  it('parseia com sufixo Z', () => {
    const result = parseDatabaseTimestamp('2024-01-15T10:30:45Z')
    expect(result).not.toBeNull()
    expect(result!.getUTCHours()).toBe(10)
  })

  it('fallback para new Date() em formato não suportado', () => {
    const result = parseDatabaseTimestamp('2024-01-15T10:30:45+00:00')
    expect(result).not.toBeNull()
  })

  it('retorna null para string inválida', () => {
    expect(parseDatabaseTimestamp('nao-e-data')).toBeNull()
  })
})

describe('formatDatabaseTimestamp', () => {
  it('retorna "—" para null/undefined', () => {
    expect(formatDatabaseTimestamp(null)).toBe('—')
    expect(formatDatabaseTimestamp(undefined)).toBe('—')
  })

  it('retorna "—" para string inválida', () => {
    expect(formatDatabaseTimestamp('nao-e-data')).toBe('—')
  })

  it('formata data no padrão pt-BR', () => {
    const result = formatDatabaseTimestamp('2024-01-15 10:30:00')
    // Esperado: "15/01/2024, 10:30" ou similar
    expect(result).toContain('15')
    expect(result).toContain('01')
    expect(result).toContain('2024')
    expect(result).toContain('10')
    expect(result).toContain('30')
  })

  it('inclui segundos quando withSeconds=true', () => {
    const result = formatDatabaseTimestamp('2024-01-15 10:30:45', { withSeconds: true })
    expect(result).toContain('45')
  })

  it('não inclui segundos quando withSeconds=false (padrão)', () => {
    const result = formatDatabaseTimestamp('2024-01-15 10:30:45')
    // Sem segundos, o formato pt-BR é "15/01/2024, 10:30"
    expect(result).not.toContain(':45')
  })

  it('preserva hora corretamente sem drift de timezone', () => {
    // Timestamp Postgres sem timezone: 2024-07-01 09:00:00
    // Deve mostrar 09:00, não deslocado pelo fuso local
    const result = formatDatabaseTimestamp('2024-07-01 09:00:00', { withSeconds: true })
    expect(result).toContain('09')
    expect(result).toContain('00')
  })
})
