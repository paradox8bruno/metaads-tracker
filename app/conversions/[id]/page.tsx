import Link from 'next/link'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { getConversion, initDB, type Conversion } from '@/lib/db'
import { Navbar } from '@/components/navbar'
import { formatDatabaseTimestamp } from '@/lib/datetime'
import { formatBrazilPhone } from '@/lib/phone'

function StatusBadge({ status }: { status: string }) {
  const styles = {
    sent: 'bg-[var(--success-soft)] text-[var(--success)]',
    error: 'bg-[var(--danger-soft)] text-[var(--danger)]',
    pending: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  }[status] || 'bg-[rgba(36,50,71,0.08)] text-[#243247]'

  const labels = {
    sent: 'Enviado com sucesso',
    error: 'Erro no envio',
    pending: 'Pendente',
  }[status] || status

  return <span className={`tag ${styles}`}>{labels}</span>
}

function EventBadge({ eventName }: { eventName: string }) {
  const styles = {
    Purchase: 'bg-[var(--success-soft)] text-[var(--success)]',
    LeadSubmitted: 'bg-[var(--info-soft)] text-[var(--info)]',
    InitiateCheckout: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  }[eventName] || 'bg-[rgba(36,50,71,0.08)] text-[#243247]'

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
    manual: 'bg-[rgba(36,50,71,0.08)] text-[#243247]',
    stripe: 'bg-[rgba(87,82,195,0.12)] text-[#5146b5]',
    mercadopago: 'bg-[rgba(0,147,211,0.12)] text-[#0d6ea0]',
  }[source] || 'bg-[rgba(36,50,71,0.08)] text-[#243247]'

  return <span className={`tag ${styles}`}>{source}</span>
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(value)
}

function formatDisplayValue(conversion: Conversion) {
  if (conversion.event_name === 'LeadSubmitted') {
    return 'Lead automático'
  }

  return formatCurrency(Number(conversion.value), conversion.currency)
}

function MetaField({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
        {label}
      </p>
      <div className={`mt-2 break-all text-sm text-[#243247] ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </div>
    </div>
  )
}

export default async function ConversionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await initDB()
  const conversion = await getConversion(id)

  if (!conversion) notFound()

  const isAutomaticLead = conversion.event_name === 'LeadSubmitted'

  return (
    <div className="app-page min-h-screen">
      <Navbar />

      <main className="page-wrap py-8">
        <Link
          href="/conversions"
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--foreground-soft)] hover:text-[#162233]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar para conversões
        </Link>

        <section className="page-header">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="page-kicker">Event Detail</div>
              <h1 className="page-title mt-4">{formatDisplayValue(conversion)}</h1>
              <p className="page-subtitle mt-4">
                Registrado em {formatDatabaseTimestamp(conversion.created_at, { withSeconds: true })}.
                Esta visão junta contexto do cliente, identificadores de atribuição e o payload
                enviado para a API da Meta.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <EventBadge eventName={conversion.event_name} />
                <SourceBadge source={conversion.source} />
              </div>
            </div>
            <StatusBadge status={conversion.meta_status} />
          </div>
        </section>

        <section className="section-card surface mb-6 p-5">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
            Leitura do registro
          </p>
          <p className="mt-2 text-sm leading-7 text-[var(--foreground-soft)]">
            {isAutomaticLead
              ? 'Este evento foi criado automaticamente quando o webhook identificou uma conversa com ctwa_clid. Ele existe para alimentar o dataset do Meta no início da conversa.'
              : 'Este evento representa uma conversão de negócio enviada ao Meta. Em geral, Purchase é registrado depois da confirmação de pagamento.'}
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <section className="section-card surface overflow-hidden">
              <div className="border-b border-[rgba(52,39,24,0.08)] px-5 py-4">
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
                  Resumo do evento
                </p>
              </div>
              <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                <MetaField label="Evento" value={conversion.event_name} />
                <MetaField label="Origem" value={conversion.source} />
                <MetaField label="Valor" value={formatDisplayValue(conversion)} />
                <MetaField label="Produto / contexto" value={conversion.product_name || (isAutomaticLead ? 'Lead automático do WhatsApp' : '—')} />
                <MetaField
                  label="Registrado em"
                  value={formatDatabaseTimestamp(conversion.created_at, { withSeconds: true })}
                />
                <MetaField
                  label="Enviado ao Meta"
                  value={
                    conversion.meta_sent_at
                      ? formatDatabaseTimestamp(conversion.meta_sent_at, { withSeconds: true })
                      : '—'
                  }
                />
                <MetaField label="Status Meta" value={<StatusBadge status={conversion.meta_status} />} />
                <MetaField label="Source ref" value={conversion.source_ref || '—'} mono />
              </div>
            </section>

            <section className="section-card surface overflow-hidden">
              <div className="border-b border-[rgba(52,39,24,0.08)] px-5 py-4">
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
                  Cliente e atribuição
                </p>
              </div>
              <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                <MetaField label="Nome" value={conversion.customer_name || '—'} />
                <MetaField
                  label="Telefone"
                  value={conversion.customer_phone ? formatBrazilPhone(conversion.customer_phone) : '—'}
                />
                <MetaField label="Email" value={conversion.customer_email || '—'} />
                <MetaField label="Conversa WhatsApp" value={conversion.whatsapp_conversation_id || '—'} mono />
                <MetaField label="Event ID" value={conversion.event_id} mono />
                <MetaField label="Dataset ID" value={conversion.dataset_id || '—'} mono />
                <div className="md:col-span-2 xl:col-span-2">
                  <MetaField label="CTWA CLID" value={conversion.ctwa_clid || '—'} mono />
                </div>
              </div>

              {conversion.notes && (
                <div className="border-t border-[rgba(52,39,24,0.08)] px-5 py-5">
                  <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
                    Observações
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[var(--foreground-soft)]">
                    {conversion.notes}
                  </p>
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            {conversion.meta_event_payload && (
              <section className="section-card surface overflow-hidden">
                <div className="border-b border-[rgba(52,39,24,0.08)] px-5 py-4">
                  <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
                    Payload enviado ao Meta
                  </p>
                </div>
                <div className="px-5 py-5">
                  <pre className="code-block">
                    {JSON.stringify(conversion.meta_event_payload, null, 2)}
                  </pre>
                </div>
              </section>
            )}

            {conversion.meta_response && (
              <section className="section-card surface overflow-hidden">
                <div className="border-b border-[rgba(52,39,24,0.08)] px-5 py-4">
                  <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
                    Resposta da API do Meta
                  </p>
                </div>
                <div className="px-5 py-5">
                  <pre className="code-block">{JSON.stringify(conversion.meta_response, null, 2)}</pre>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
