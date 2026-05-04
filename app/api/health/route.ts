import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sql } from '@/lib/db'

interface CheckResult {
  ok: boolean
  label: string
  detail?: string
  latencyMs?: number
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now()
  try {
    if (!process.env.POSTGRES_URL) {
      return { ok: false, label: 'Banco de dados', detail: 'POSTGRES_URL não configurada' }
    }
    await sql`SELECT 1 AS ping`
    return {
      ok: true,
      label: 'Banco de dados',
      detail: 'Conexão com Neon PostgreSQL ok',
      latencyMs: Date.now() - start,
    }
  } catch (err) {
    return {
      ok: false,
      label: 'Banco de dados',
      detail: String(err),
      latencyMs: Date.now() - start,
    }
  }
}

async function checkMetaToken(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const token = process.env.META_ACCESS_TOKEN
    if (!token) return { ok: false, label: 'Meta Access Token', detail: 'META_ACCESS_TOKEN não configurado' }

    const version = process.env.META_GRAPH_API_VERSION || 'v22.0'
    const res = await fetch(`https://graph.facebook.com/${version}/me?fields=id,name&access_token=${token}`, {
      next: { revalidate: 0 },
    })

    const data = await res.json() as { id?: string; name?: string; error?: { message: string; code: number } }

    if (!res.ok || data.error) {
      return {
        ok: false,
        label: 'Meta Access Token',
        detail: data.error ? `${data.error.code}: ${data.error.message}` : `HTTP ${res.status}`,
        latencyMs: Date.now() - start,
      }
    }

    return {
      ok: true,
      label: 'Meta Access Token',
      detail: `Autenticado como ${data.name || data.id}`,
      latencyMs: Date.now() - start,
    }
  } catch (err) {
    return {
      ok: false,
      label: 'Meta Access Token',
      detail: String(err),
      latencyMs: Date.now() - start,
    }
  }
}

async function checkWABA(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const token = process.env.META_ACCESS_TOKEN
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID

    if (!token) return { ok: false, label: 'WhatsApp Business Account', detail: 'META_ACCESS_TOKEN não configurado' }
    if (!wabaId) return { ok: false, label: 'WhatsApp Business Account', detail: 'WHATSAPP_BUSINESS_ACCOUNT_ID não configurado' }

    const version = process.env.META_GRAPH_API_VERSION || 'v22.0'
    const res = await fetch(`https://graph.facebook.com/${version}/${wabaId}?fields=id,name,currency&access_token=${token}`, {
      next: { revalidate: 0 },
    })

    const data = await res.json() as { id?: string; name?: string; currency?: string; error?: { message: string; code: number } }

    if (!res.ok || data.error) {
      return {
        ok: false,
        label: 'WhatsApp Business Account',
        detail: data.error ? `${data.error.code}: ${data.error.message}` : `HTTP ${res.status}`,
        latencyMs: Date.now() - start,
      }
    }

    return {
      ok: true,
      label: 'WhatsApp Business Account',
      detail: `${data.name || wabaId} • ${data.currency || ''}`,
      latencyMs: Date.now() - start,
    }
  } catch (err) {
    return {
      ok: false,
      label: 'WhatsApp Business Account',
      detail: String(err),
      latencyMs: Date.now() - start,
    }
  }
}

async function checkPhoneNumber(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const token = process.env.META_ACCESS_TOKEN
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID

    if (!token) return { ok: false, label: 'Número WhatsApp', detail: 'META_ACCESS_TOKEN não configurado' }
    if (!phoneId) return { ok: false, label: 'Número WhatsApp', detail: 'WHATSAPP_PHONE_NUMBER_ID não configurado' }

    const version = process.env.META_GRAPH_API_VERSION || 'v22.0'
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}?fields=id,display_phone_number,verified_name,quality_rating&access_token=${token}`, {
      next: { revalidate: 0 },
    })

    const data = await res.json() as {
      id?: string
      display_phone_number?: string
      verified_name?: string
      quality_rating?: string
      error?: { message: string; code: number }
    }

    if (!res.ok || data.error) {
      return {
        ok: false,
        label: 'Número WhatsApp',
        detail: data.error ? `${data.error.code}: ${data.error.message}` : `HTTP ${res.status}`,
        latencyMs: Date.now() - start,
      }
    }

    return {
      ok: true,
      label: 'Número WhatsApp',
      detail: `${data.display_phone_number} • ${data.verified_name || ''} • qualidade: ${data.quality_rating || '?'}`,
      latencyMs: Date.now() - start,
    }
  } catch (err) {
    return {
      ok: false,
      label: 'Número WhatsApp',
      detail: String(err),
      latencyMs: Date.now() - start,
    }
  }
}

async function checkDataset(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const token = process.env.META_ACCESS_TOKEN
    const datasetId = process.env.META_DATASET_ID

    if (!token) return { ok: false, label: 'Dataset CAPI', detail: 'META_ACCESS_TOKEN não configurado' }
    if (!datasetId) {
      return {
        ok: false,
        label: 'Dataset CAPI',
        detail: 'META_DATASET_ID não configurado (o sistema vai tentar descobrir automaticamente)',
      }
    }

    const version = process.env.META_GRAPH_API_VERSION || 'v22.0'
    const res = await fetch(`https://graph.facebook.com/${version}/${datasetId}?fields=id,name&access_token=${token}`, {
      next: { revalidate: 0 },
    })

    const data = await res.json() as { id?: string; name?: string; error?: { message: string; code: number } }

    if (!res.ok || data.error) {
      return {
        ok: false,
        label: 'Dataset CAPI',
        detail: data.error ? `${data.error.code}: ${data.error.message}` : `HTTP ${res.status}`,
        latencyMs: Date.now() - start,
      }
    }

    return {
      ok: true,
      label: 'Dataset CAPI',
      detail: `Dataset: ${data.name || data.id}`,
      latencyMs: Date.now() - start,
    }
  } catch (err) {
    return {
      ok: false,
      label: 'Dataset CAPI',
      detail: String(err),
      latencyMs: Date.now() - start,
    }
  }
}

function checkEnvVars(): CheckResult {
  const required = [
    'META_ACCESS_TOKEN',
    'META_APP_ID',
    'META_APP_SECRET',
    'WHATSAPP_BUSINESS_ACCOUNT_ID',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
    'POSTGRES_URL',
    'APP_SECRET',
  ]

  const missing = required.filter(k => !process.env[k])

  if (missing.length === 0) {
    return { ok: true, label: 'Variáveis de ambiente', detail: `${required.length}/${required.length} obrigatórias configuradas` }
  }

  return {
    ok: false,
    label: 'Variáveis de ambiente',
    detail: `Faltando: ${missing.join(', ')}`,
  }
}

export async function GET() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')
  if (!session?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [db, metaToken, waba, phone, dataset] = await Promise.all([
    checkDatabase(),
    checkMetaToken(),
    checkWABA(),
    checkPhoneNumber(),
    checkDataset(),
  ])

  const envVars = checkEnvVars()

  const checks = [db, metaToken, waba, phone, dataset, envVars]
  const allOk = checks.every(c => c.ok)

  return NextResponse.json({
    ok: allOk,
    checks,
    env: {
      META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN ? '***' + process.env.META_ACCESS_TOKEN.slice(-6) : null,
      META_APP_ID: process.env.META_APP_ID || null,
      META_APP_SECRET: process.env.META_APP_SECRET ? '***' + process.env.META_APP_SECRET.slice(-4) : null,
      WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || null,
      WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || null,
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
        ? '***' + process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN.slice(-4)
        : null,
      POSTGRES_URL: process.env.POSTGRES_URL ? 'postgresql://***' : null,
      APP_SECRET: process.env.APP_SECRET ? '***' : null,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || null,
      META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION || 'v22.0 (padrão)',
      META_TEST_EVENT_CODE: process.env.META_TEST_EVENT_CODE || null,
      META_DATASET_ID: process.env.META_DATASET_ID || null,
    },
  })
}
