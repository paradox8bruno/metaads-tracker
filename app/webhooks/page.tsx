import { Navbar } from '@/components/navbar'
import {
  countWhatsAppConversations,
  countWhatsAppMessages,
  listWhatsAppConversations,
  listWhatsAppMessages,
  type WhatsAppConversation,
  type WhatsAppMessage,
} from '@/lib/db'
import { formatBrazilPhone } from '@/lib/phone'

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(dateStr))
}

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
        CTWA atribuido
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-800">
      Sem CTWA
    </span>
  )
}

export default async function WebhookHistoryPage() {
  let conversations: WhatsAppConversation[] = []
  let messages: WhatsAppMessage[] = []
  let totalConversations = 0
  let totalAttributed = 0
  let totalMessages = 0
  let dbError: string | null = null

  try {
    ;[conversations, messages, totalConversations, totalAttributed, totalMessages] =
      await Promise.all([
        listWhatsAppConversations(),
        listWhatsAppMessages({ limit: 100 }),
        countWhatsAppConversations(),
        countWhatsAppConversations({ onlyAttributed: true }),
        countWhatsAppMessages(),
      ])
  } catch (error) {
    dbError = String(error)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Histórico do Webhook</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Tudo que o WhatsApp webhook recebeu. A tela de nova venda mostra apenas conversas com
            `ctwa_clid`; aqui você vê também mensagens sem atribuição.
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
            <div className="mb-6 grid gap-4 md:grid-cols-3">
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
                  Eventos do webhook
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{totalMessages}</p>
              </div>
            </div>

            <div className="mb-8 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm font-medium text-yellow-900">Leitura do teste atual</p>
              <p className="mt-1 text-sm text-yellow-800">
                Se a mensagem aparece aqui, mas não aparece em `Nova Venda`, o webhook chegou sem
                `referral.ctwa_clid`. Isso significa que o lead entrou no WhatsApp, mas não entrou
                no fluxo oficial de atribuição CTWA que esta aplicação exige para enviar conversão.
              </p>
            </div>

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
                  {conversations.map(conversation => (
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
                          </div>
                          <p className="mt-1 text-sm text-gray-600">
                            {formatConversationPhone(conversation.customer_phone)}
                          </p>
                        </div>
                        <div className="text-xs text-gray-500">
                          Atualizado em {formatDate(conversation.updated_at)}
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
                            {conversation.display_phone_number || conversation.phone_number_id || '—'}
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

                      <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
                        <div>
                          <p className="text-xs text-gray-400">Tipo de referral</p>
                          <p className="text-gray-700">{conversation.referral_source_type || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Headline do anúncio</p>
                          <p className="text-gray-700">{conversation.referral_headline || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">URL de origem</p>
                          <p className="break-all text-gray-700">
                            {conversation.referral_source_url || '—'}
                          </p>
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
                  ))}
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
                              {formatDate(message.event_timestamp || message.created_at)}
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
