'use client'

import { useEffect, useState } from 'react'
import { Navbar } from '@/components/navbar'

interface CheckResult {
  ok: boolean
  label: string
  detail?: string
  latencyMs?: number
}

interface HealthData {
  ok: boolean
  checks: CheckResult[]
  env: Record<string, string | null>
}

function StatusIcon({ ok, loading }: { ok?: boolean; loading?: boolean }) {
  if (loading) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(96,165,250,0.14)]">
        <span className="spinner h-3.5 w-3.5 text-[var(--info)]" />
      </span>
    )
  }

  if (ok) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--success-soft)]">
        <svg className="h-3.5 w-3.5 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </span>
    )
  }

  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--danger-soft)]">
      <svg className="h-3.5 w-3.5 text-[var(--danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  )
}

function ConnectionCard({ check, loading }: { check?: CheckResult; loading: boolean }) {
  const cardClass = loading
    ? 'conn-card conn-card-loading'
    : check?.ok
      ? 'conn-card conn-card-ok'
      : 'conn-card conn-card-error'

  return (
    <div className={`${cardClass} p-5`}>
      <div className="flex items-start gap-3">
        <StatusIcon ok={check?.ok} loading={loading} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-bold text-[var(--foreground)] text-sm">{check?.label || '...'}</p>
            {check?.latencyMs !== undefined && (
              <span className="text-[0.68rem] font-mono text-[var(--foreground-muted)]">
                {check.latencyMs}ms
              </span>
            )}
          </div>
          <p className={`mt-1 text-xs leading-5 ${check?.ok ? 'text-[var(--success)]' : loading ? 'text-[var(--info)]' : 'text-[var(--danger)]'}`}>
            {loading ? 'Testando conexão...' : check?.detail || ''}
          </p>
        </div>
      </div>
    </div>
  )
}

function EnvVarRow({ name, value }: { name: string; value: string | null }) {
  const present = value !== null

  return (
    <div className="env-row">
      <span className={`flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0 ${present ? 'bg-[var(--success-soft)]' : 'bg-[var(--danger-soft)]'}`}>
        {present ? (
          <svg className="h-3 w-3 text-[var(--success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-3 w-3 text-[var(--danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </span>
      <span className="env-key">{name}</span>
      <span className={`env-value ${present ? 'text-[var(--foreground-muted)]' : 'text-[var(--danger)] font-semibold'}`}>
        {present ? value : 'não configurada'}
      </span>
    </div>
  )
}

const REQUIRED_ENV = [
  'META_ACCESS_TOKEN',
  'META_APP_ID',
  'META_APP_SECRET',
  'WHATSAPP_BUSINESS_ACCOUNT_ID',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
  'POSTGRES_URL',
  'APP_SECRET',
]

const OPTIONAL_ENV = [
  'NEXT_PUBLIC_APP_URL',
  'META_GRAPH_API_VERSION',
  'META_TEST_EVENT_CODE',
  'META_DATASET_ID',
]

export default function SettingsPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<HealthData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tested, setTested] = useState(false)

  async function runChecks() {
    setLoading(true)
    setError(null)
    setTested(true)

    try {
      const res = await fetch('/api/health', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as HealthData
      setData(json)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void runChecks()
  }, [])

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/whatsapp`
    : '/api/webhooks/whatsapp'

  return (
    <div className="app-page min-h-screen">
      <Navbar />

      <main className="page-wrap py-8">
        <section className="page-header">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="page-kicker">Configurações</div>
              <h1 className="page-title mt-4">Conexões, variáveis e status do sistema.</h1>
              <p className="page-subtitle mt-4">
                Teste em tempo real se o banco de dados, o token da Meta e o WABA estão respondendo
                corretamente. Verifique quais variáveis de ambiente estão configuradas e qual URL
                usar no painel de webhooks da Meta.
              </p>
            </div>

            <button
              onClick={() => void runChecks()}
              disabled={loading}
              className="cta-secondary px-5 py-3 text-sm"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="spinner h-3.5 w-3.5" />
                  Testando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Testar novamente
                </span>
              )}
            </button>
          </div>
        </section>

        {error && (
          <div className="alert alert-danger mb-6">
            <p className="font-semibold">Erro ao buscar status das conexões</p>
            <p className="mt-1 text-xs">{error}</p>
          </div>
        )}

        {tested && data && (
          <div className={`alert mb-6 ${data.ok ? 'alert-success' : 'alert-warning'}`}>
            <p className="font-semibold">
              {data.ok
                ? 'Todas as conexões estão funcionando'
                : `${data.checks.filter(c => !c.ok).length} conexão(ões) com problema`}
            </p>
            <p className="mt-1 text-xs">
              {data.ok
                ? 'O sistema está pronto para receber e enviar conversões.'
                : 'Corrija as conexões abaixo antes de usar o sistema em produção.'}
            </p>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            {/* Connection checks */}
            <section className="section-card surface overflow-hidden">
              <div className="border-b border-[rgba(148,163,184,0.12)] px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="section-label">Diagnóstico</p>
                  <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] text-[var(--foreground)]">
                    Teste de conexões
                  </h2>
                </div>
                {tested && !loading && data && (
                  <span className={`tag ${data.ok ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-[var(--danger-soft)] text-[var(--danger)]'}`}>
                    <span className="tag-dot tag-dot-pulse" />
                    {data.ok ? 'Tudo ok' : `${data.checks.filter(c => !c.ok).length} erro(s)`}
                  </span>
                )}
              </div>

              <div className="p-5 grid gap-3 sm:grid-cols-2">
                {loading && !data
                  ? [0, 1, 2, 3, 4, 5].map(i => <ConnectionCard key={i} loading />)
                  : data?.checks.map((check, i) => (
                      <ConnectionCard key={i} check={check} loading={loading} />
                    ))
                }
              </div>
            </section>

            {/* Webhook URL */}
            <section className="section-card surface overflow-hidden">
              <div className="border-b border-[rgba(148,163,184,0.12)] px-5 py-4">
                <p className="section-label">Webhook</p>
                <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] text-[var(--foreground)]">
                  URL para configurar na Meta
                </h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <p className="field-label">Callback URL (POST + GET)</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 rounded-xl border border-[rgba(148,163,184,0.14)] bg-[#0a1424] px-4 py-2.5 font-mono text-xs text-[#cbd5e1] break-all">
                      {webhookUrl}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(webhookUrl)}
                      className="cta-ghost text-xs px-3 py-2 flex-shrink-0"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copiar
                    </button>
                  </div>
                </div>

                <div className="alert alert-info text-xs">
                  <p className="font-semibold mb-1">Como configurar na Meta</p>
                  <ol className="list-decimal list-inside space-y-1 text-[0.8rem]">
                    <li>Acesse o painel do seu App na Meta for Developers</li>
                    <li>Vá em WhatsApp → Configuração → Webhooks</li>
                    <li>Cole a URL acima no campo &quot;Callback URL&quot;</li>
                    <li>No campo &quot;Verify Token&quot; use o valor de <code className="bg-[rgba(96,165,250,0.12)] px-1 rounded">WHATSAPP_WEBHOOK_VERIFY_TOKEN</code></li>
                    <li>Assine os campos: <code className="bg-[rgba(37,89,178,0.12)] px-1 rounded">messages</code>, <code className="bg-[rgba(37,89,178,0.12)] px-1 rounded">message_deliveries</code>, <code className="bg-[rgba(37,89,178,0.12)] px-1 rounded">message_reads</code></li>
                  </ol>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            {/* Required env vars */}
            <section className="section-card surface overflow-hidden">
              <div className="border-b border-[rgba(148,163,184,0.12)] px-5 py-4">
                <p className="section-label">Obrigatórias</p>
                <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] text-[var(--foreground)]">
                  Variáveis de ambiente
                </h2>
              </div>
              <div className="px-5 py-4">
                {REQUIRED_ENV.map(key => (
                  <EnvVarRow key={key} name={key} value={data?.env[key] ?? null} />
                ))}
              </div>
            </section>

            {/* Optional env vars */}
            <section className="section-card surface overflow-hidden">
              <div className="border-b border-[rgba(148,163,184,0.12)] px-5 py-4">
                <p className="section-label">Opcionais</p>
                <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] text-[var(--foreground)]">
                  Variáveis extras
                </h2>
              </div>
              <div className="px-5 py-4">
                {OPTIONAL_ENV.map(key => (
                  <EnvVarRow key={key} name={key} value={data?.env[key] ?? null} />
                ))}
              </div>
            </section>

            {/* Quick links */}
            <section className="section-card surface-muted p-5">
              <p className="section-label mb-3">Links úteis</p>
              <ul className="space-y-2 text-sm">
                {[
                  { label: 'Meta for Developers', href: 'https://developers.facebook.com/apps' },
                  { label: 'WhatsApp Manager', href: 'https://business.facebook.com/wa/manage' },
                  { label: 'Business Messaging CAPI Docs', href: 'https://developers.facebook.com/docs/whatsapp/business-messaging/conversions-api' },
                  { label: 'Neon Database Console', href: 'https://console.neon.tech' },
                ].map(link => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[var(--info)] hover:text-white font-medium"
                    >
                      <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
