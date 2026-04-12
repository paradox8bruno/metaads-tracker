import { neon } from '@neondatabase/serverless'

// Lazy: só conecta quando chamado em runtime (não em build time)
function getDb() {
  const url = process.env.POSTGRES_URL
  if (!url) throw new Error('POSTGRES_URL não configurada. Configure no painel da Vercel.')
  return neon(url)
}

export function sql(...args: Parameters<ReturnType<typeof neon>>) {
  return getDb()(...args)
}

// Tipos
export interface Conversion {
  id: string
  created_at: string
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  value: number
  currency: string
  product_name: string | null
  notes: string | null
  event_id: string
  event_name: string
  meta_status: 'pending' | 'sent' | 'error'
  meta_response: Record<string, unknown> | null
  meta_sent_at: string | null
  source: 'manual' | 'stripe' | 'mercadopago'
  source_ref: string | null
}

// Inicializa o banco de dados (cria tabela se não existir)
export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS conversions (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at    TIMESTAMP DEFAULT now(),

      customer_name  TEXT,
      customer_phone TEXT,
      customer_email TEXT,

      value          NUMERIC(10,2) NOT NULL,
      currency       VARCHAR(3) DEFAULT 'BRL',
      product_name   TEXT,
      notes          TEXT,

      event_id       UUID NOT NULL UNIQUE,
      event_name     VARCHAR(50) DEFAULT 'Purchase',
      meta_status    VARCHAR(20) DEFAULT 'pending',
      meta_response  JSONB,
      meta_sent_at   TIMESTAMP,

      source         VARCHAR(20) DEFAULT 'manual',
      source_ref     TEXT UNIQUE
    )
  `
  return { ok: true }
}

// Lista todas as conversões
export async function listConversions(): Promise<Conversion[]> {
  const rows = await sql`
    SELECT * FROM conversions
    ORDER BY created_at DESC
    LIMIT 100
  `
  return rows as Conversion[]
}

// Busca uma conversão por ID
export async function getConversion(id: string): Promise<Conversion | null> {
  const rows = await sql`
    SELECT * FROM conversions WHERE id = ${id}
  `
  return (rows[0] as Conversion) || null
}

// Insere nova conversão
export async function insertConversion(data: {
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  value: number
  currency: string
  productName?: string
  notes?: string
  eventId: string
  eventName: string
  source?: string
  sourceRef?: string
}): Promise<Conversion> {
  const rows = await sql`
    INSERT INTO conversions (
      customer_name, customer_phone, customer_email,
      value, currency, product_name, notes,
      event_id, event_name, meta_status,
      source, source_ref
    ) VALUES (
      ${data.customerName || null},
      ${data.customerPhone || null},
      ${data.customerEmail || null},
      ${data.value},
      ${data.currency || 'BRL'},
      ${data.productName || null},
      ${data.notes || null},
      ${data.eventId},
      ${data.eventName || 'Purchase'},
      'pending',
      ${data.source || 'manual'},
      ${data.sourceRef || null}
    )
    RETURNING *
  `
  return rows[0] as Conversion
}

// Atualiza status após envio para Meta
export async function updateConversionMetaStatus(
  id: string,
  status: 'sent' | 'error',
  response: Record<string, unknown>
) {
  await sql`
    UPDATE conversions
    SET
      meta_status = ${status},
      meta_response = ${JSON.stringify(response)},
      meta_sent_at = now()
    WHERE id = ${id}
  `
}
