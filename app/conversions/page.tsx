import Link from 'next/link'
import {
  countConversions,
  initDB,
  listConversions,
  type Conversion,
} from '@/lib/db'
import { Navbar } from '@/components/navbar'
import { formatDatabaseTimestamp } from '@/lib/datetime'
import { formatBrazilPhone } from '@/lib/phone'

function StatusBadge({ status }: { status: string }) {
  const styles = {
    sent: 'bg-[var(--success-soft)] text-[var(--success)]',
    error: 'bg-[var(--danger-soft)] text-[var(--danger)]',
    pending: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  }[status] || 'bg-[rgba(36,50,71,0.08)] text-[var(--foreground-soft)]'

  const labels = {
    sent: 'Enviado',
    error: 'Erro',
    pending: 'Pendente',
  }[status] || status

  return <span className={`tag ${styles}`}>{labels}</span>
}

function EventBadge({ eventName }: { eventName: string }) {
  const styles = {
    Purchase: 'bg-[var(--success-soft)] text-[var(--success)]',
    LeadSubmitted: 'bg-[var(--info-soft)] text-[var(--info)]',
    InitiateCheckout: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  }[eventName] || 'bg-[rgba(36,50,71,0.08)] text-[var(--foreground-soft)]'

  const labels = {
    Purchase: 'Purchase',
    LeadSubmitted: 'Lead automático',
    InitiateCheckout: 'Checkout iniciado',
  }[eventName] || eventName

  return <span className={`tag ${styles}`}>{labels}</span>
}

function SourceBadge({ source }: { source: Conversion['source'] }) {
  const styles = {
    whatsapp: 'bg-[var(--success-soft)] text-[var(--success)]',
    manual: 'bg-[rgba(36,50,71,0.08)] text-[var(--foreground-soft)]',
    stripe: 'bg-[rgba(129,140,248,0.16)] text-[#c7d2fe]',
    mercadopago: 'bg-[rgba(34,211,238,0.16)] text-[#a5f3fc]',
  }[source] || 'bg-[rgba(36,50,71,0.08)] text-[var(--foreground-soft)]'

  return <span className={`tag ${styles}`}>{source}</span>
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(value)
}

function formatConversionValue(conversion: Conversion) {
  if (conversion.event_name === 'LeadSubmitted') {
    return 'Lead automático'
  }

  return formatCurrency(Number(conversion.value), conversion.currency)
}

export default async function ConversionsPage() {
  let conversions: Conversion[] = []
  let totalConversions = 0
  let totalLeadConversions = 0
  let totalPurchaseConversions = 0
  let sentCount = 0
  let errorCount = 0
  let pendingCount = 0
  let dbError: string | null = null

  try {
    await initDB()

    ;[
      conversions,
      totalConversions,
      totalLeadConversions,
      totalPurchaseConversions,
      sentCount,
      errorCount,
      pendingCount,
    ] = await Promise.all([
      listConversions(),
      countConversions(),
      countConversions({ eventName: 'LeadSubmitted' }),
      countConversions({ eventName: 'Purchase' }),
      countConversions({ status: 'sent' }),
      countConversions({ status: 'error' }),
      countConversions({ status: 'pending' }),
    ])
  } catch (err) {
    dbError = String(err)
  }

  return (
    <div className="app-page min-h-screen">
      <Navbar />

      <main className="page-wrap py-8">
        <section className="page-header">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="page-kicker">Revenue Console</div>
              <h1 className="page-title mt-4">Conversões e leads do WhatsApp em uma visão só.</h1>
              <p className="page-subtitle mt-4">
                Esta área consolida leads automáticos criados pelo webhook e eventos enviados ao
                dataset do Meta via Business Messaging CAPI. É a visão operacional para saber o que
                entrou, o que foi enviado e o que travou.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/webhooks" className="cta-secondary px-5 py-3 text-sm">
                Auditoria do webhook
              </Link>
              <Link href="/conversions/new" className="cta-primary px-5 py-3 text-sm">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Registrar evento
              </Link>
            </div>
          </div>
        </section>

        {dbError && (
          <div className="section-card surface mb-6 p-5">
            <p className="text-sm font-semibold text-[var(--danger)]">Banco de dados não inicializado</p>
            <p className="mt-1 text-xs text-[var(--foreground-soft)]">{dbError}</p>
          </div>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="metric-card p-5">
            <p className="metric-label">Total de registros</p>
            <p className="metric-value">{totalConversions}</p>
            <p className="metric-note">Todos os eventos persistidos localmente.</p>
          </div>
          <div className="metric-card p-5">
            <p className="metric-label">Leads automáticos</p>
            <p className="metric-value text-[var(--info)]">{totalLeadConversions}</p>
            <p className="metric-note">Criados quando a conversa chega com CTWA.</p>
          </div>
          <div className="metric-card p-5">
            <p className="metric-label">Purchases</p>
            <p className="metric-value text-[var(--success)]">{totalPurchaseConversions}</p>
            <p className="metric-note">Conversões de venda confirmadas.</p>
          </div>
          <div className="metric-card p-5">
            <p className="metric-label">Enviadas ao Meta</p>
            <p className="metric-value text-[var(--success)]">{sentCount}</p>
            <p className="metric-note">Eventos aceitos pelo fluxo atual.</p>
          </div>
          <div className="metric-card p-5">
            <p className="metric-label">Pendentes</p>
            <p className="metric-value text-[var(--warning)]">{pendingCount}</p>
            <p className="metric-note">Aguardando processamento ou reenvio.</p>
          </div>
          <div className="metric-card p-5">
            <p className="metric-label">Com erro</p>
            <p className="metric-value text-[var(--danger)]">{errorCount}</p>
            <p className="metric-note">Precisam de validação de payload ou asset.</p>
          </div>
        </section>

        <section className="section-card surface mb-6 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
                Interpretação operacional
              </p>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-[var(--foreground-soft)]">
                <code className="rounded-lg bg-[rgba(96,165,250,0.12)] px-2 py-1 text-[var(--info)]">
                  LeadSubmitted
                </code>{' '}
                nasce automaticamente quando o webhook recebe uma conversa atribuída com{' '}
                <code className="rounded-lg bg-[rgba(59,130,246,0.12)] px-2 py-1 text-[var(--accent-ink)]">
                  ctwa_clid
                </code>
                .{' '}
                <code className="rounded-lg bg-[rgba(74,222,128,0.12)] px-2 py-1 text-[var(--success)]">
                  Purchase
                </code>{' '}
                entra depois, quando a venda foi confirmada.
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(148,163,184,0.12)] bg-[rgba(17,29,48,0.78)] px-4 py-3 text-sm text-[var(--foreground-soft)]">
              Use esta tela para operação diária.
            </div>
          </div>
        </section>

        {conversions.length === 0 && !dbError ? (
          <section className="section-card surface-strong p-10 text-center">
            <div className="mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.6rem] border border-[rgba(148,163,184,0.12)] bg-[rgba(17,29,48,0.82)]">
              <svg className="h-9 w-9 text-[var(--foreground-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <h2 className="mt-5 text-2xl font-extrabold tracking-[-0.04em] text-[var(--foreground)]">
              Nenhuma conversão registrada ainda
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[var(--foreground-soft)]">
              Os leads aparecem automaticamente quando o webhook recebe mensagem atribuída. Se já
              houve venda, registre um evento manual ligado à conversa correta.
            </p>
            <Link href="/conversions/new" className="cta-primary mt-6 px-5 py-3 text-sm">
              Registrar primeiro evento
            </Link>
          </section>
        ) : (
          <section className="section-card surface overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-[rgba(148,163,184,0.12)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
                  Timeline operacional
                </p>
                <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] text-[var(--foreground)]">
                  Últimos registros de conversão
                </h2>
              </div>
              {errorCount > 0 && (
                <div className="tag bg-[var(--danger-soft)] text-[var(--danger)]">
                  {errorCount} evento(s) com erro no envio
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="data-table min-w-[980px]">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Cliente</th>
                    <th>Contexto</th>
                    <th className="text-right">Valor</th>
                    <th className="text-center">Status Meta</th>
                    <th className="text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {conversions.map(c => (
                    <tr key={c.id}>
                      <td className="whitespace-nowrap text-[var(--foreground-muted)]">
                        {formatDatabaseTimestamp(c.created_at, { withSeconds: true })}
                      </td>
                      <td>
                        <EventBadge eventName={c.event_name} />
                      </td>
                      <td>
                        <div className="font-semibold text-[var(--foreground)]">{c.customer_name || '—'}</div>
                        <div className="mt-1 text-xs text-[var(--foreground-muted)]">
                          {c.customer_phone ? formatBrazilPhone(c.customer_phone) : c.customer_email || ''}
                        </div>
                      </td>
                      <td>
                        <div className="font-medium text-[var(--foreground-soft)]">
                          {c.product_name ||
                            (c.event_name === 'LeadSubmitted' ? 'Lead automático do WhatsApp' : '—')}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <SourceBadge source={c.source} />
                        </div>
                        {c.source_ref && (
                          <div className="mt-2 break-all font-mono text-[11px] text-[var(--foreground-muted)]">
                            {c.source_ref}
                          </div>
                        )}
                      </td>
                      <td className="text-right font-semibold text-[var(--foreground)]">
                        {formatConversionValue(c)}
                      </td>
                      <td className="text-center">
                        <StatusBadge status={c.meta_status} />
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/conversions/${c.id}`}
                          className="font-semibold text-[var(--info)] hover:text-white"
                        >
                          Abrir →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
