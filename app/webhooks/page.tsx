import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import {
  countConversions,
  countWebhookDeliveries,
  countWhatsAppConversations,
  countWhatsAppMessages,
  initDB,
  listLeadConversions,
  listWebhookDeliveries,
  listWhatsAppConversations,
  listWhatsAppMessages,
  type Conversion,
  type WebhookDelivery,
  type WhatsAppConversation,
  type WhatsAppMessage,
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
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
        CTWA atribuído
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-800">
      Sem CTWA
    </span>
  )
}

function OutcomeBadge({ delivery }: { delivery: WebhookDelivery }) {
  const styleMap: Record<WebhookDelivery['outcome'], string> = {
    accepted: 'bg-green-100 text-green-700',
    accepted_empty: 'bg-gray-100 text-gray-700',
    invalid_signature: 'bg-red-100 text-red-700',
    invalid_json: 'bg-red-100 text-red-700',
    missing_app_secret: 'bg-red-100 text-red-700',
    processing_error: 'bg-yellow-100 text-yellow-800',
  }

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styleMap[delivery.outcome]}`}>
      {delivery.outcome}
    </span>
  )
}

function LeadStatusBadge({ conversion }: { conversion?: Conversion }) {
  if (!conversion) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
        Sem lead enviado
      </span>
    )
  }

  const styles = {
    sent: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-800',
  }[conversion.meta_status]

  const labels = {
    sent: 'Lead enviado',
    error: 'Lead com erro',
    pending: 'Lead pendente',
  }[conversion.meta_status]

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}>
      {labels}
    </span>
  )
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
      ? 'bg-gray-100 text-gray-700'
      : delivery.signature_valid
        ? 'bg-blue-100 text-blue-700'
        : 'bg-red-100 text-red-700'

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

export default async function WebhookHistoryPage() {
  let deliveries: WebhookDelivery[] = []
  let leadConversions: Conversion[] = []
  let conversations: WhatsAppConversation[] = []
  let messages: WhatsAppMessage[] = []
  let totalDeliveries = 0
  let totalConversations = 0
  let totalAttributed = 0
  let totalMessages = 0
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
      totalDeliveries,
      totalConversations,
      totalAttributed,
      totalMessages,
      totalLeadCreated,
      totalLeadSent,
      totalLeadError,
    ] = await Promise.all([
      listWebhookDeliveries({ limit: 100 }),
      listLeadConversions(),
      listWhatsAppConversations(),
      listWhatsAppMessages({ limit: 100 }),
      countWebhookDeliveries(),
      countWhatsAppConversations(),
      countWhatsAppConversations({ onlyAttributed: true }),
      countWhatsAppMessages(),
      countConversions({ eventName: 'LeadSubmitted' }),
      countConversions({ eventName: 'LeadSubmitted', status: 'sent' }),
      countConversions({ eventName: 'LeadSubmitted', status: 'error' }),
    ])
  } catch (error) {
    dbError = String(error)
  }

  const totalUnattributed = Math.max(0, totalConversations - totalAttributed)
  const totalLeadPending = Math.max(0, totalLeadCreated - totalLeadSent - totalLeadError)

  const leadByConversationId = new Map<string, Conversion>()
  for (const conversion of leadConversions) {
    if (conversion.whatsapp_conversation_id && !leadByConversationId.has(conversion.whatsapp_conversation_id)) {
      leadByConversationId.set(conversion.whatsapp_conversation_id, conversion)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Histórico do webhook</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Auditoria completa do que entrou pelo webhook do WhatsApp: requests brutos, conversas,
            mensagens, atribuição CTWA e o lead automático enviado ao Meta.
          </p>
        </div>

        {dbError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Erro ao carregar histórico</p>
            <p className="mt-1 text-xs text-red-700">{dbError}</p>
          </div>
        )}

        {!dbError && (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Requests do webhook
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{totalDeliveries}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Eventos recebidos
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{totalMessages}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Conversas recebidas
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{totalConversations}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Conversas com CTWA
                </p>
                <p className="mt-1 text-2xl font-bold text-green-600">{totalAttributed}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Conversas sem CTWA
                </p>
                <p className="mt-1 text-2xl font-bold text-yellow-700">{totalUnattributed}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Leads automáticos
                </p>
                <p className="mt-1 text-2xl font-bold text-blue-700">{totalLeadCreated}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Leads enviados
                </p>
                <p className="mt-1 text-2xl font-bold text-green-600">{totalLeadSent}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Leads com erro
                </p>
                <p className="mt-1 text-2xl font-bold text-red-600">{totalLeadError}</p>
              </div>
            </div>

            <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900">Leitura operacional</p>
              <p className="mt-1 text-sm text-blue-800">
                Quando a conversa chega com <code className="rounded bg-blue-100 px-1 py-0.5">ctwa_clid</code>,
                o sistema registra a conversa, grava o request bruto e cria o evento{' '}
                <code className="rounded bg-blue-100 px-1 py-0.5">LeadSubmitted</code>{' '}
                automaticamente. Quando a conversa chega sem CTWA, ela continua aparecendo aqui
                para auditoria e debug, mas não entra no fluxo oficial de atribuição do Meta.
              </p>
              <p className="mt-2 text-xs text-blue-700">
                Leads pendentes: <span className="font-semibold">{totalLeadPending}</span> •
                Leads exibidos na tabela: <span className="font-semibold">{leadConversions.length}</span>
              </p>
            </div>

            <section className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Leads automáticos enviados</h2>
                  <p className="text-xs text-gray-500">
                    Conversas atribuídas que geraram <code>LeadSubmitted</code>.
                  </p>
                </div>
                <Link
                  href="/conversions"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Ver todas as conversões →
                </Link>
              </div>

              {leadConversions.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
                  Nenhum lead automático registrado ainda.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                            Data
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                            Cliente
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                            Telefone
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                            Conversa
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                            CTWA CLID
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                            Status Meta
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                            Detalhes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {leadConversions.map(conversion => (
                          <tr key={conversion.id} className="align-top">
                            <td className="px-4 py-4 text-gray-600">
                              {formatDatabaseTimestamp(conversion.created_at, {
                                withSeconds: true,
                              })}
                            </td>
                            <td className="px-4 py-4">
                              <div className="font-medium text-gray-900">
                                {conversion.customer_name || 'Lead sem nome'}
                              </div>
                              <div className="mt-1 font-mono text-[11px] text-gray-400">
                                {conversion.source_ref || 'sem source_ref'}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-gray-600">
                              {formatConversationPhone(conversion.customer_phone)}
                            </td>
                            <td className="px-4 py-4">
                              <div className="font-mono text-xs text-gray-600">
                                {conversion.whatsapp_conversation_id || '—'}
                              </div>
                              {conversion.whatsapp_conversation_id && (
                                <div className="mt-1 text-xs text-gray-400">
                                  Origem: {conversion.source}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="max-w-xs break-all font-mono text-xs text-gray-600">
                                {conversion.ctwa_clid || '—'}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <LeadStatusBadge conversion={conversion} />
                              <div className="mt-1 text-xs text-gray-400">
                                {conversion.meta_sent_at
                                  ? `Meta: ${formatDatabaseTimestamp(conversion.meta_sent_at, {
                                      withSeconds: true,
                                    })}`
                                  : 'Ainda sem confirmação de envio'}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <Link
                                href={`/conversions/${conversion.id}`}
                                className="text-xs font-medium text-blue-600 hover:text-blue-700"
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
                <h2 className="text-lg font-semibold text-gray-900">Entregas brutas do webhook</h2>
                <p className="text-xs text-gray-500">{deliveries.length} mais recentes exibidas</p>
              </div>

              {deliveries.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
                  Nenhum request do webhook salvo ainda.
                </div>
              ) : (
                <div className="space-y-4">
                  {deliveries.map(delivery => (
                    <article
                      key={delivery.id}
                      className="rounded-xl border border-gray-200 bg-white p-5"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-gray-900">Webhook recebido</h3>
                            <OutcomeBadge delivery={delivery} />
                            <SignatureBadge delivery={delivery} />
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {formatDatabaseTimestamp(delivery.created_at, {
                              withSeconds: true,
                            })}{' '}
                            • {delivery.http_method} • {delivery.event_type || 'sem object'}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-gray-600 md:grid-cols-3">
                          <div>
                            <p className="text-gray-400">Entries</p>
                            <p>{delivery.entry_count}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Changes</p>
                            <p>{delivery.change_count}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Conversas</p>
                            <p>{delivery.conversations_upserted}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Mensagens</p>
                            <p>{delivery.message_events_stored}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Statuses</p>
                            <p>{delivery.status_events_stored}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Ignorados</p>
                            <p>{delivery.ignored_entries + delivery.ignored_changes}</p>
                          </div>
                        </div>
                      </div>

                      {delivery.error_message && (
                        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                          {delivery.error_message}
                        </div>
                      )}

                      <div className="mt-4 space-y-2">
                        <details className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <summary className="cursor-pointer text-sm font-medium text-gray-700">
                            Headers recebidos
                          </summary>
                          <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-700">
                            {JSON.stringify(delivery.request_headers, null, 2)}
                          </pre>
                        </details>
                        <details className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <summary className="cursor-pointer text-sm font-medium text-gray-700">
                            Payload parseado
                          </summary>
                          <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-700">
                            {JSON.stringify(delivery.payload, null, 2)}
                          </pre>
                        </details>
                        <details className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <summary className="cursor-pointer text-sm font-medium text-gray-700">
                            Body bruto
                          </summary>
                          <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-700">
                            {delivery.raw_body}
                          </pre>
                        </details>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Conversas recebidas</h2>
                <p className="text-xs text-gray-500">
                  {conversations.length} mais recentes exibidas
                </p>
              </div>

              {conversations.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
                  Nenhuma conversa recebida ainda.
                </div>
              ) : (
                <div className="space-y-4">
                  {conversations.map(conversation => {
                    const leadConversion = leadByConversationId.get(conversation.id)

                    return (
                      <article
                        key={conversation.id}
                        className="rounded-xl border border-gray-200 bg-white p-5"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-gray-900">
                                {conversation.customer_name || 'Lead sem nome'}
                              </h3>
                              <AttributionBadge conversation={conversation} />
                              <LeadStatusBadge conversion={leadConversion} />
                            </div>
                            <p className="mt-1 text-sm text-gray-600">
                              {formatConversationPhone(conversation.customer_phone)}
                            </p>
                          </div>
                          <div className="text-xs text-gray-500">
                            Atualizado em{' '}
                            {formatDatabaseTimestamp(conversation.updated_at, {
                              withSeconds: true,
                            })}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <p className="text-xs text-gray-400">WA ID</p>
                            <p className="break-all font-mono text-xs text-gray-700">
                              {conversation.wa_id}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Número WhatsApp Business</p>
                            <p className="break-all font-mono text-xs text-gray-700">
                              {conversation.display_phone_number ||
                                conversation.phone_number_id ||
                                '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">CTWA CLID</p>
                            <p className="break-all font-mono text-xs text-gray-700">
                              {conversation.ctwa_clid || '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Última mensagem</p>
                            <p className="text-gray-700">{conversation.latest_message_text || '—'}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <p className="text-xs text-gray-400">Criada em</p>
                            <p className="text-gray-700">
                              {formatDatabaseTimestamp(conversation.created_at, {
                                withSeconds: true,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Último evento</p>
                            <p className="text-gray-700">
                              {formatDatabaseTimestamp(
                                conversation.latest_message_at || conversation.updated_at,
                                { withSeconds: true }
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Tipo de referral</p>
                            <p className="text-gray-700">{conversation.referral_source_type || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Headline do anúncio</p>
                            <p className="text-gray-700">{conversation.referral_headline || '—'}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
                          <div>
                            <p className="text-xs text-gray-400">URL de origem</p>
                            <p className="break-all text-gray-700">
                              {conversation.referral_source_url || '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Lead automático vinculado</p>
                            {leadConversion ? (
                              <div>
                                <p className="font-mono text-xs text-gray-700">
                                  {leadConversion.id}
                                </p>
                                <Link
                                  href={`/conversions/${leadConversion.id}`}
                                  className="mt-1 inline-flex text-xs font-medium text-blue-600 hover:text-blue-700"
                                >
                                  Abrir conversão →
                                </Link>
                              </div>
                            ) : (
                              <p className="text-gray-700">
                                {conversation.ctwa_clid
                                  ? 'Ainda não há lead automático vinculado.'
                                  : 'Não se aplica: conversa sem CTWA.'}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <details className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <summary className="cursor-pointer text-sm font-medium text-gray-700">
                              Referral bruto
                            </summary>
                            <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-700">
                              {JSON.stringify(conversation.raw_referral, null, 2)}
                            </pre>
                          </details>
                          <details className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <summary className="cursor-pointer text-sm font-medium text-gray-700">
                              Última mensagem bruta
                            </summary>
                            <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-700">
                              {JSON.stringify(conversation.raw_last_message, null, 2)}
                            </pre>
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
                <h2 className="text-lg font-semibold text-gray-900">Eventos do webhook</h2>
                <p className="text-xs text-gray-500">{messages.length} mais recentes exibidos</p>
              </div>

              {messages.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
                  Nenhum evento recebido ainda.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                            Data
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                            Tipo
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                            Direção
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                            WA ID
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                            Evento
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                            Texto
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                            Payload
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {messages.map(message => (
                          <tr key={message.id} className="align-top">
                            <td className="px-4 py-4 text-gray-600">
                              {formatDatabaseTimestamp(
                                message.event_timestamp || message.created_at,
                                { withSeconds: true }
                              )}
                            </td>
                            <td className="px-4 py-4 text-gray-700">{message.payload_type}</td>
                            <td className="px-4 py-4 text-gray-700">{message.direction}</td>
                            <td className="px-4 py-4 font-mono text-xs text-gray-600">
                              {message.wa_id || '—'}
                            </td>
                            <td className="px-4 py-4 text-gray-700">{formatEventLabel(message)}</td>
                            <td className="max-w-sm px-4 py-4 text-gray-700">
                              {message.message_text || '—'}
                            </td>
                            <td className="px-4 py-4">
                              <details className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                                <summary className="cursor-pointer text-xs font-medium text-gray-700">
                                  Ver JSON
                                </summary>
                                <pre className="mt-2 max-w-md overflow-auto whitespace-pre-wrap break-words text-xs text-gray-700">
                                  {JSON.stringify(message.raw_payload, null, 2)}
                                </pre>
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
