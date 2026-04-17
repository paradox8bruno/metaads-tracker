import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import {
  countConversions,
  countWebhookDeliveries,
  countWhatsAppConversations,
  countWhatsAppMessages,
  countWhatsAppWebhookTopicEvents,
  initDB,
  listLeadConversions,
  listWebhookDeliveries,
  listWhatsAppConversations,
  listWhatsAppMessages,
  listWhatsAppWebhookTopicEvents,
  type Conversion,
  type WebhookDelivery,
  type WhatsAppConversation,
  type WhatsAppMessage,
  type WhatsAppWebhookTopicEvent,
} from '@/lib/db'
import { formatDatabaseTimestamp } from '@/lib/datetime'
import { formatBrazilPhone } from '@/lib/phone'

function formatConversationPhone(phone: string | null) {
  if (!phone) return '—'

  try {
    return formatBrazilPhone(phone)
  } catch {
    return phone
  }
}

function formatEventLabel(message: WhatsAppMessage) {
  if (message.payload_type === 'status') {
    return message.status || 'status'
  }

  return message.message_type || 'message'
}

function AttributionBadge({ conversation }: { conversation: WhatsAppConversation }) {
  if (conversation.ctwa_clid) {
    return <span className="tag bg-[var(--success-soft)] text-[var(--success)]">CTWA atribuído</span>
  }

  return <span className="tag bg-[var(--warning-soft)] text-[var(--warning)]">Sem CTWA</span>
}

function OutcomeBadge({ delivery }: { delivery: WebhookDelivery }) {
  const styleMap: Record<WebhookDelivery['outcome'], string> = {
    accepted: 'bg-[var(--success-soft)] text-[var(--success)]',
    accepted_empty: 'bg-[rgba(36,50,71,0.08)] text-[#243247]',
    invalid_signature: 'bg-[var(--danger-soft)] text-[var(--danger)]',
    invalid_json: 'bg-[var(--danger-soft)] text-[var(--danger)]',
    missing_app_secret: 'bg-[var(--danger-soft)] text-[var(--danger)]',
    processing_error: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  }

  return <span className={`tag ${styleMap[delivery.outcome]}`}>{delivery.outcome}</span>
}

function LeadStatusBadge({ conversion }: { conversion?: Conversion }) {
  if (!conversion) {
    return <span className="tag bg-[rgba(36,50,71,0.08)] text-[#243247]">Sem lead enviado</span>
  }

  const styles = {
    sent: 'bg-[var(--success-soft)] text-[var(--success)]',
    error: 'bg-[var(--danger-soft)] text-[var(--danger)]',
    pending: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  }[conversion.meta_status]

  const labels = {
    sent: 'Lead enviado',
    error: 'Lead com erro',
    pending: 'Lead pendente',
  }[conversion.meta_status]

  return <span className={`tag ${styles}`}>{labels}</span>
}

function SignatureBadge({ delivery }: { delivery: WebhookDelivery }) {
  const label =
    delivery.signature_valid === null
      ? 'Assinatura n/a'
      : delivery.signature_valid
        ? 'Assinatura ok'
        : 'Assinatura inválida'

  const className =
    delivery.signature_valid === null
      ? 'bg-[rgba(36,50,71,0.08)] text-[#243247]'
      : delivery.signature_valid
        ? 'bg-[var(--info-soft)] text-[var(--info)]'
        : 'bg-[var(--danger-soft)] text-[var(--danger)]'

  return <span className={`tag ${className}`}>{label}</span>
}

function DataField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
        {label}
      </p>
      <p className={`mt-2 text-sm text-[#243247] ${mono ? 'break-all font-mono text-xs' : ''}`}>
        {value}
      </p>
    </div>
  )
}

export default async function WebhookHistoryPage() {
  let deliveries: WebhookDelivery[] = []
  let leadConversions: Conversion[] = []
  let conversations: WhatsAppConversation[] = []
  let messages: WhatsAppMessage[] = []
  let topicEvents: WhatsAppWebhookTopicEvent[] = []
  let totalDeliveries = 0
  let totalConversations = 0
  let totalAttributed = 0
  let totalMessages = 0
  let totalTopicEvents = 0
  let totalAutomaticEvents = 0
  let totalTrackingEvents = 0
  let totalLeadCreated = 0
  let totalLeadSent = 0
  let totalLeadError = 0
  let dbError: string | null = null

  try {
    await initDB()

    ;[
      deliveries,
      leadConversions,
      conversations,
      messages,
      topicEvents,
      totalDeliveries,
      totalConversations,
      totalAttributed,
      totalMessages,
      totalTopicEvents,
      totalAutomaticEvents,
      totalTrackingEvents,
      totalLeadCreated,
      totalLeadSent,
      totalLeadError,
    ] = await Promise.all([
      listWebhookDeliveries({ limit: 100 }),
      listLeadConversions(),
      listWhatsAppConversations(),
      listWhatsAppMessages({ limit: 100 }),
      listWhatsAppWebhookTopicEvents({ limit: 100 }),
      countWebhookDeliveries(),
      countWhatsAppConversations(),
      countWhatsAppConversations({ onlyAttributed: true }),
      countWhatsAppMessages(),
      countWhatsAppWebhookTopicEvents(),
      countWhatsAppWebhookTopicEvents({ field: 'automatic_events' }),
      countWhatsAppWebhookTopicEvents({ field: 'tracking_events' }),
      countConversions({ eventName: 'LeadSubmitted' }),
      countConversions({ eventName: 'LeadSubmitted', status: 'sent' }),
      countConversions({ eventName: 'LeadSubmitted', status: 'error' }),
    ])
  } catch (error) {
    dbError = String(error)
  }

  const totalLeadPending = Math.max(0, totalLeadCreated - totalLeadSent - totalLeadError)

  const leadByConversationId = new Map<string, Conversion>()
  for (const conversion of leadConversions) {
    if (conversion.whatsapp_conversation_id && !leadByConversationId.has(conversion.whatsapp_conversation_id)) {
      leadByConversationId.set(conversion.whatsapp_conversation_id, conversion)
    }
  }

  return (
    <div className="app-page min-h-screen">
      <Navbar />

      <main className="page-wrap py-8">
        <section className="page-header">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="page-kicker">Webhook Intelligence</div>
              <h1 className="page-title mt-4">Tudo que o WhatsApp entregou, sem caixa-preta.</h1>
              <p className="page-subtitle mt-4">
                Esta tela é a base de auditoria do projeto: requests brutos, mensagens, echoes,
                automatic events, tracking events, conversas persistidas e os leads automáticos
                gerados para o Meta.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/conversions" className="cta-secondary px-5 py-3 text-sm">
                Abrir conversões
              </Link>
              <Link href="/conversions/new" className="cta-primary px-5 py-3 text-sm">
                Registrar venda
              </Link>
            </div>
          </div>
        </section>

        {dbError && (
          <div className="section-card mb-6 border border-[rgba(180,35,24,0.16)] bg-[var(--danger-soft)] p-5">
            <p className="text-sm font-semibold text-[var(--danger)]">Erro ao carregar histórico</p>
            <p className="mt-1 text-xs text-[var(--foreground-soft)]">{dbError}</p>
          </div>
        )}

        {!dbError && (
          <>
            <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="metric-card p-5">
                <p className="metric-label">Requests</p>
                <p className="metric-value">{totalDeliveries}</p>
                <p className="metric-note">Entradas brutas do webhook.</p>
              </div>
              <div className="metric-card p-5">
                <p className="metric-label">Eventos</p>
                <p className="metric-value">{totalMessages}</p>
                <p className="metric-note">Mensagens, status e echoes persistidos.</p>
              </div>
              <div className="metric-card p-5">
                <p className="metric-label">Extras</p>
                <p className="metric-value">{totalTopicEvents}</p>
                <p className="metric-note">
                  {totalAutomaticEvents} automáticos • {totalTrackingEvents} tracking
                </p>
              </div>
              <div className="metric-card p-5">
                <p className="metric-label">Conversas</p>
                <p className="metric-value">{totalConversations}</p>
                <p className="metric-note">{totalAttributed} com CTWA válido.</p>
              </div>
              <div className="metric-card p-5">
                <p className="metric-label">Leads</p>
                <p className="metric-value">{totalLeadCreated}</p>
                <p className="metric-note">
                  {totalLeadSent} enviados • {totalLeadPending} pendentes • {totalLeadError} erro
                </p>
              </div>
            </section>

            <section className="section-card surface mb-8 p-5">
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
                Leitura operacional
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--foreground-soft)]">
                Quando a conversa chega com{' '}
                <code className="rounded bg-[rgba(183,100,43,0.08)] px-2 py-1 text-[var(--accent-ink)]">
                  ctwa_clid
                </code>
                , o sistema registra a conversa, preserva o request bruto e cria{' '}
                <code className="rounded bg-[rgba(37,89,178,0.08)] px-2 py-1 text-[var(--info)]">
                  LeadSubmitted
                </code>{' '}
                automaticamente. Se a conversa chega sem CTWA, ela continua disponível aqui para
                debug e auditoria, mas não entra no fluxo oficial de atribuição.
              </p>
            </section>

            <section className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
                    Auto leads
                  </p>
                  <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] text-[#162233]">
                    Leads automáticos enviados
                  </h2>
                </div>
                <Link href="/conversions" className="text-sm font-semibold text-[var(--info)] hover:text-[#173f84]">
                  Ver conversões →
                </Link>
              </div>

              {leadConversions.length === 0 ? (
                <div className="section-card surface p-8 text-sm text-[var(--foreground-soft)]">
                  Nenhum lead automático registrado ainda.
                </div>
              ) : (
                <div className="section-card surface overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="data-table min-w-[1100px]">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Cliente</th>
                          <th>Telefone</th>
                          <th>Conversa</th>
                          <th>CTWA CLID</th>
                          <th>Status Meta</th>
                          <th className="text-right">Detalhes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leadConversions.map(conversion => (
                          <tr key={conversion.id}>
                            <td>{formatDatabaseTimestamp(conversion.created_at, { withSeconds: true })}</td>
                            <td>
                              <div className="font-semibold text-[#162233]">
                                {conversion.customer_name || 'Lead sem nome'}
                              </div>
                              <div className="mt-1 font-mono text-[11px] text-[var(--foreground-muted)]">
                                {conversion.source_ref || 'sem source_ref'}
                              </div>
                            </td>
                            <td>{formatConversationPhone(conversion.customer_phone)}</td>
                            <td>
                              <div className="font-mono text-xs text-[#243247]">
                                {conversion.whatsapp_conversation_id || '—'}
                              </div>
                              {conversion.whatsapp_conversation_id && (
                                <div className="mt-1 text-xs text-[var(--foreground-muted)]">
                                  Origem: {conversion.source}
                                </div>
                              )}
                            </td>
                            <td>
                              <div className="max-w-xs break-all font-mono text-xs text-[#243247]">
                                {conversion.ctwa_clid || '—'}
                              </div>
                            </td>
                            <td>
                              <LeadStatusBadge conversion={conversion} />
                              <div className="mt-2 text-xs text-[var(--foreground-muted)]">
                                {conversion.meta_sent_at
                                  ? `Meta: ${formatDatabaseTimestamp(conversion.meta_sent_at, {
                                      withSeconds: true,
                                    })}`
                                  : 'Ainda sem confirmação de envio'}
                              </div>
                            </td>
                            <td className="text-right">
                              <Link
                                href={`/conversions/${conversion.id}`}
                                className="font-semibold text-[var(--info)] hover:text-[#173f84]"
                              >
                                Abrir →
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            <section className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
                    Raw ingress
                  </p>
                  <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] text-[#162233]">
                    Entregas brutas do webhook
                  </h2>
                </div>
                <p className="text-xs text-[var(--foreground-muted)]">{deliveries.length} mais recentes exibidas</p>
              </div>

              {deliveries.length === 0 ? (
                <div className="section-card surface p-8 text-sm text-[var(--foreground-soft)]">
                  Nenhum request do webhook salvo ainda.
                </div>
              ) : (
                <div className="space-y-4">
                  {deliveries.map(delivery => (
                    <article key={delivery.id} className="section-card surface p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold tracking-[-0.03em] text-[#162233]">
                              Webhook recebido
                            </h3>
                            <OutcomeBadge delivery={delivery} />
                            <SignatureBadge delivery={delivery} />
                          </div>
                          <p className="mt-2 text-sm text-[var(--foreground-soft)]">
                            {formatDatabaseTimestamp(delivery.created_at, { withSeconds: true })} •{' '}
                            {delivery.http_method} • {delivery.event_type || 'sem object'}
                          </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3 xl:min-w-[420px]">
                          <DataField label="Entries" value={String(delivery.entry_count)} />
                          <DataField label="Changes" value={String(delivery.change_count)} />
                          <DataField label="Conversas" value={String(delivery.conversations_upserted)} />
                          <DataField label="Mensagens" value={String(delivery.message_events_stored)} />
                          <DataField label="Echoes" value={String(delivery.echo_events_stored)} />
                          <DataField label="Statuses" value={String(delivery.status_events_stored)} />
                          <DataField label="Automatic" value={String(delivery.automatic_events_stored)} />
                          <DataField label="Tracking" value={String(delivery.tracking_events_stored)} />
                          <DataField label="Ignorados" value={String(delivery.ignored_entries + delivery.ignored_changes)} />
                        </div>
                      </div>

                      {delivery.error_message && (
                        <div className="mt-4 rounded-2xl border border-[rgba(180,35,24,0.16)] bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]">
                          {delivery.error_message}
                        </div>
                      )}

                      <div className="mt-4 space-y-3">
                        <details className="rounded-2xl border border-[rgba(52,39,24,0.08)] bg-[rgba(239,231,220,0.56)] p-4">
                          <summary className="cursor-pointer text-sm font-semibold text-[#243247]">
                            Headers recebidos
                          </summary>
                          <pre className="code-block mt-3">{JSON.stringify(delivery.request_headers, null, 2)}</pre>
                        </details>
                        <details className="rounded-2xl border border-[rgba(52,39,24,0.08)] bg-[rgba(239,231,220,0.56)] p-4">
                          <summary className="cursor-pointer text-sm font-semibold text-[#243247]">
                            Payload parseado
                          </summary>
                          <pre className="code-block mt-3">{JSON.stringify(delivery.payload, null, 2)}</pre>
                        </details>
                        <details className="rounded-2xl border border-[rgba(52,39,24,0.08)] bg-[rgba(239,231,220,0.56)] p-4">
                          <summary className="cursor-pointer text-sm font-semibold text-[#243247]">
                            Body bruto
                          </summary>
                          <pre className="code-block mt-3">{delivery.raw_body}</pre>
                        </details>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
                    Extra topics
                  </p>
                  <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] text-[#162233]">
                    Automatic e tracking events
                  </h2>
                </div>
                <p className="text-xs text-[var(--foreground-muted)]">{topicEvents.length} mais recentes exibidos</p>
              </div>

              {topicEvents.length === 0 ? (
                <div className="section-card surface p-8 text-sm text-[var(--foreground-soft)]">
                  Nenhum evento extra de webhook salvo ainda.
                </div>
              ) : (
                <div className="space-y-4">
                  {topicEvents.map(event => (
                    <article key={event.id} className="section-card surface p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold tracking-[-0.03em] text-[#162233]">
                              {event.event_name || event.field}
                            </h3>
                            <span className="tag bg-[var(--info-soft)] text-[var(--info)]">
                              {event.field}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-[var(--foreground-soft)]">
                            {formatDatabaseTimestamp(event.created_at, { withSeconds: true })}
                          </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3 xl:min-w-[480px]">
                          <DataField label="WA ID" value={event.wa_id || '—'} mono />
                          <DataField label="Phone Number ID" value={event.phone_number_id || '—'} mono />
                          <DataField
                            label="Event time"
                            value={
                              event.event_timestamp
                                ? formatDatabaseTimestamp(event.event_timestamp, { withSeconds: true })
                                : '—'
                            }
                          />
                        </div>
                      </div>

                      <details className="mt-4 rounded-2xl border border-[rgba(52,39,24,0.08)] bg-[rgba(239,231,220,0.56)] p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-[#243247]">
                          Payload bruto
                        </summary>
                        <pre className="code-block mt-3">{JSON.stringify(event.raw_payload, null, 2)}</pre>
                      </details>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
                    Conversations
                  </p>
                  <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] text-[#162233]">
                    Conversas recebidas
                  </h2>
                </div>
                <p className="text-xs text-[var(--foreground-muted)]">{conversations.length} mais recentes exibidas</p>
              </div>

              {conversations.length === 0 ? (
                <div className="section-card surface p-8 text-sm text-[var(--foreground-soft)]">
                  Nenhuma conversa recebida ainda.
                </div>
              ) : (
                <div className="space-y-4">
                  {conversations.map(conversation => {
                    const leadConversion = leadByConversationId.get(conversation.id)

                    return (
                      <article key={conversation.id} className="section-card surface p-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-bold tracking-[-0.03em] text-[#162233]">
                                {conversation.customer_name || 'Lead sem nome'}
                              </h3>
                              <AttributionBadge conversation={conversation} />
                              <LeadStatusBadge conversion={leadConversion} />
                            </div>
                            <p className="mt-2 text-sm text-[var(--foreground-soft)]">
                              {formatConversationPhone(conversation.customer_phone)}
                            </p>
                          </div>
                          <div className="text-xs text-[var(--foreground-muted)]">
                            Atualizado em {formatDatabaseTimestamp(conversation.updated_at, { withSeconds: true })}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <DataField label="WA ID" value={conversation.wa_id} mono />
                          <DataField
                            label="Número Business"
                            value={conversation.display_phone_number || conversation.phone_number_id || '—'}
                            mono
                          />
                          <DataField label="CTWA CLID" value={conversation.ctwa_clid || '—'} mono />
                          <DataField label="Última mensagem" value={conversation.latest_message_text || '—'} />
                          <DataField
                            label="Criada em"
                            value={formatDatabaseTimestamp(conversation.created_at, { withSeconds: true })}
                          />
                          <DataField
                            label="Último evento"
                            value={formatDatabaseTimestamp(conversation.latest_message_at || conversation.updated_at, {
                              withSeconds: true,
                            })}
                          />
                          <DataField label="Tipo de referral" value={conversation.referral_source_type || '—'} />
                          <DataField label="Headline do anúncio" value={conversation.referral_headline || '—'} />
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <DataField label="URL de origem" value={conversation.referral_source_url || '—'} />
                          <div>
                            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
                              Lead automático vinculado
                            </p>
                            {leadConversion ? (
                              <div className="mt-2">
                                <p className="font-mono text-xs text-[#243247]">{leadConversion.id}</p>
                                <Link
                                  href={`/conversions/${leadConversion.id}`}
                                  className="mt-2 inline-flex text-sm font-semibold text-[var(--info)] hover:text-[#173f84]"
                                >
                                  Abrir conversão →
                                </Link>
                              </div>
                            ) : (
                              <p className="mt-2 text-sm text-[var(--foreground-soft)]">
                                {conversation.ctwa_clid
                                  ? 'Ainda não há lead automático vinculado.'
                                  : 'Não se aplica: conversa sem CTWA.'}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          <details className="rounded-2xl border border-[rgba(52,39,24,0.08)] bg-[rgba(239,231,220,0.56)] p-4">
                            <summary className="cursor-pointer text-sm font-semibold text-[#243247]">
                              Referral bruto
                            </summary>
                            <pre className="code-block mt-3">{JSON.stringify(conversation.raw_referral, null, 2)}</pre>
                          </details>
                          <details className="rounded-2xl border border-[rgba(52,39,24,0.08)] bg-[rgba(239,231,220,0.56)] p-4">
                            <summary className="cursor-pointer text-sm font-semibold text-[#243247]">
                              Última mensagem bruta
                            </summary>
                            <pre className="code-block mt-3">{JSON.stringify(conversation.raw_last_message, null, 2)}</pre>
                          </details>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
                    Event stream
                  </p>
                  <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] text-[#162233]">
                    Eventos do webhook
                  </h2>
                </div>
                <p className="text-xs text-[var(--foreground-muted)]">{messages.length} mais recentes exibidos</p>
              </div>

              {messages.length === 0 ? (
                <div className="section-card surface p-8 text-sm text-[var(--foreground-soft)]">
                  Nenhum evento recebido ainda.
                </div>
              ) : (
                <div className="section-card surface overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="data-table min-w-[900px]">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Tipo</th>
                          <th>Direção</th>
                          <th>WA ID</th>
                          <th>Evento</th>
                          <th>Texto</th>
                          <th>Payload</th>
                        </tr>
                      </thead>
                      <tbody>
                        {messages.map(message => (
                          <tr key={message.id}>
                            <td>
                              {formatDatabaseTimestamp(message.event_timestamp || message.created_at, {
                                withSeconds: true,
                              })}
                            </td>
                            <td>{message.payload_type}</td>
                            <td>{message.direction}</td>
                            <td className="font-mono text-xs text-[#243247]">{message.wa_id || '—'}</td>
                            <td>{formatEventLabel(message)}</td>
                            <td className="max-w-sm">{message.message_text || '—'}</td>
                            <td>
                              <details className="rounded-2xl border border-[rgba(52,39,24,0.08)] bg-[rgba(239,231,220,0.56)] p-3">
                                <summary className="cursor-pointer text-xs font-semibold text-[#243247]">
                                  Ver JSON
                                </summary>
                                <pre className="code-block mt-3 max-w-md">{JSON.stringify(message.raw_payload, null, 2)}</pre>
                              </details>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
