type DatabaseTimestampInput = string | Date | null | undefined

function parseDatabaseTimestampParts(value: string) {
  const match = value
    .trim()
    .replace(' ', 'T')
    .match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?(?:Z)?$/
    )

  if (!match) {
    return null
  }

  const [, year, month, day, hour, minute, second = '0', millisecond = '0'] = match

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
    millisecond: Number(millisecond.padEnd(3, '0')),
  }
}

export function parseDatabaseTimestamp(value: DatabaseTimestampInput): Date | null {
  if (!value) return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value !== 'string') {
    const fallback = new Date(value)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }

  const parts = parseDatabaseTimestampParts(value)
  if (!parts) {
    const fallback = new Date(value)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }

  // Postgres TIMESTAMP columns are stored without timezone. Some drivers serialize them with "Z",
  // which makes the UI shift the wall-clock time. Rebuild them as wall-clock UTC to preserve the
  // original database value during formatting.
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.millisecond
    )
  )
}

export function formatDatabaseTimestamp(
  value: DatabaseTimestampInput,
  options?: {
    withSeconds?: boolean
  }
) {
  const date = parseDatabaseTimestamp(value)
  if (!date) return '—'

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: options?.withSeconds ? '2-digit' : undefined,
  }).format(date)
}
