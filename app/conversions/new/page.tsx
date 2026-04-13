'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { formatBrazilPhone, normalizeBrazilPhone } from '@/lib/phone'

interface WhatsAppConversationOption {
  id: string
  customer_name: string | null
  customer_phone: string | null
  latest_message_at: string | null
  latest_message_text: string | null
  referral_headline: string | null
  referral_body: string | null
  referral_source_url: string | null
  ctwa_clid: string | null
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'Sem data'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

function formatConversationPhone(phone: string | null) {
  if (!phone) return '—'
  return normalizeBrazilPhone(phone) ? formatBrazilPhone(phone) : phone
}

export default function NewConversionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [conversationsError, setConversationsError] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{
    id: string
    metaStatus: string
    datasetId?: string
    eventsReceived?: number
  } | null>(null)
  const [conversations, setConversations] = useState<WhatsAppConversationOption[]>([])

  const [form, setForm] = useState({
    conversationId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    value: '',
    currency: 'BRL',
    productName: '',
    notes: '',
    eventName: 'Purchase',
    useTestEventCode: false,
  })

  useEffect(() => {
    let cancelled = false

    async function loadConversations() {
      try {
        const response = await fetch('/api/whatsapp/conversations')
        const data = (await response.json()) as WhatsAppConversationOption[] & {
          error?: string
        }

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao carregar conversas do WhatsApp')
        }

        if (!cancelled) {
          setConversations(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        if (!cancelled) {
          setConversationsError(String(error))
        }
      } finally {
        if (!cancelled) {
          setLoadingConversations(false)
        }
      }
    }

    void loadConversations()

    return () => {
      cancelled = true
    }
  }, [])

  const selectedConversation =
    conversations.find(conversation => conversation.id === form.conversationId) || null

  const normalizedPhone = form.customerPhone ? normalizeBrazilPhone(form.customerPhone) : null
  const phoneIsInvalid = form.customerPhone.trim() !== '' && !normalizedPhone

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const value =
      e.target instanceof HTMLInputElement && e.target.type === 'checkbox'
        ? e.target.checked
        : e.target.value

    setForm(prev => ({ ...prev, [e.target.name]: value }))
  }

  function handleConversationChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const conversationId = e.target.value
    const conversation = conversations.find(item => item.id === conversationId) || null

    setForm(prev => ({
      ...prev,
      conversationId,
      customerName: conversation?.customer_name || prev.customerName,
      customerPhone: conversation?.customer_phone
        ? formatConversationPhone(conversation.customer_phone)
        : prev.customerPhone,
    }))
  }

  function handlePhoneBlur() {
    if (!normalizedPhone) return

    setForm(prev => ({
      ...prev,
      customerPhone: formatBrazilPhone(normalizedPhone),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.conversationId) {
      setError('Selecione um lead do WhatsApp para enviar a conversão.')
      return
    }

    if (phoneIsInvalid) {
      setError('Telefone inválido. Use DDD + número. Ex.: +55 11 99999-9999')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(null)

    try {
      const res = await fetch('/api/conversions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          customerPhone: normalizedPhone || form.customerPhone,
          value: parseFloat(form.value.replace(',', '.')),
        }),
      })

      const data = (await res.json()) as {
        error?: string
        id: string
        metaStatus: string
        datasetId?: string
        eventsReceived?: number
      }

      if (!res.ok) {
        setError(data.error || 'Erro ao registrar conversão')
        setLoading(false)
        return
      }

      setSuccess(data)
      setLoading(false)
      setTimeout(() => router.push('/conversions'), 2000)
    } catch {
      setError('Erro de conexão. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Registrar Nova Venda</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Vincule a venda a uma conversa real de Click to WhatsApp para enviar ao Meta pelo fluxo
            oficial de Business Messaging
          </p>
        </div>

        {success && (
          <div
            className={`rounded-xl p-5 mb-6 ${
              success.metaStatus === 'sent'
                ? 'bg-green-50 border border-green-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  success.metaStatus === 'sent' ? 'bg-green-100' : 'bg-yellow-100'
                }`}
              >
                {success.metaStatus === 'sent' ? (
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4 text-yellow-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01"
                    />
                  </svg>
                )}
              </div>
              <div>
                <p
                  className={`font-semibold ${
                    success.metaStatus === 'sent' ? 'text-green-800' : 'text-yellow-800'
                  }`}
                >
                  {success.metaStatus === 'sent'
                    ? 'Conversão enviada ao Meta'
                    : 'Venda salva, mas houve erro no envio ao Meta'}
                </p>
                {success.datasetId && (
                  <p className="text-xs text-gray-500 mt-1">Dataset usado: {success.datasetId}</p>
                )}
                {success.eventsReceived !== undefined && (
                  <p className="text-sm text-green-600 mt-0.5">
                    {success.eventsReceived} evento(s) recebido(s) pelo Meta
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">Redirecionando para a lista...</p>
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold">
                1
              </span>
              Lead do WhatsApp
            </h2>

            {loadingConversations ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                Carregando conversas capturadas no webhook...
              </div>
            ) : conversations.length === 0 ? (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
                <p className="text-sm font-medium text-yellow-800">
                  Nenhum lead atribuído disponível.
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  O lead só aparece aqui depois que o webhook do WhatsApp receber uma mensagem com
                  `ctwa_clid` vinda de anúncio Click to WhatsApp.
                </p>
                {conversationsError && (
                  <p className="text-xs text-yellow-700 mt-1">{conversationsError}</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Conversa atribuída <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="conversationId"
                    value={form.conversationId}
                    onChange={handleConversationChange}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                  >
                    <option value="">Selecione um lead com CTWA</option>
                    {conversations.map(conversation => (
                      <option key={conversation.id} value={conversation.id}>
                        {(conversation.customer_name || 'Lead sem nome') +
                          ' • ' +
                          formatConversationPhone(conversation.customer_phone) +
                          ' • ' +
                          formatDate(conversation.latest_message_at)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Essa lista mostra apenas conversas que já chegaram com `ctwa_clid` no webhook.
                  </p>
                </div>

                {selectedConversation && (
                  <div className="rounded-xl border border-green-100 bg-green-50 p-4 text-sm">
                    <p className="font-medium text-green-900">
                      {selectedConversation.customer_name || 'Lead sem nome'}
                    </p>
                    <p className="text-green-800 mt-1">
                      {formatConversationPhone(selectedConversation.customer_phone)}
                    </p>
                    <p className="text-green-700 text-xs mt-2">
                      Última mensagem: {selectedConversation.latest_message_text || 'Sem texto'}
                    </p>
                    {selectedConversation.referral_headline && (
                      <p className="text-green-700 text-xs mt-1">
                        Anúncio: {selectedConversation.referral_headline}
                      </p>
                    )}
                    <p className="text-green-700 text-xs mt-1 break-all">
                      CTWA CLID: {selectedConversation.ctwa_clid}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                2
              </span>
              Dados do Cliente
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do cliente
                </label>
                <input
                  type="text"
                  name="customerName"
                  value={form.customerName}
                  onChange={handleChange}
                  placeholder="Ex: João Silva"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    WhatsApp / Telefone
                  </label>
                  <input
                    type="tel"
                    name="customerPhone"
                    value={form.customerPhone}
                    onChange={handleChange}
                    onBlur={handlePhoneBlur}
                    placeholder="+55 11 99999-9999"
                    inputMode="tel"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p
                    className={`text-xs mt-1 ${
                      phoneIsInvalid ? 'text-red-500' : 'text-gray-400'
                    }`}
                  >
                    {phoneIsInvalid
                      ? 'Formato inválido. Informe DDD + número; o sistema assume Brasil (+55).'
                      : 'Opcional para complementar o match do Meta. O envio sai normalizado como 5511999999999.'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email (opcional)
                  </label>
                  <input
                    type="email"
                    name="customerEmail"
                    value={form.customerEmail}
                    onChange={handleChange}
                    placeholder="cliente@email.com"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                3
              </span>
              Dados da Venda
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor da venda <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                      R$
                    </span>
                    <input
                      type="text"
                      name="value"
                      value={form.value}
                      onChange={handleChange}
                      placeholder="297,00"
                      required
                      className="w-full pl-9 pr-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de evento
                  </label>
                  <select
                    name="eventName"
                    value={form.eventName}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="Purchase">Purchase (Compra)</option>
                    <option value="Lead">Lead</option>
                    <option value="InitiateCheckout">Início de Checkout</option>
                    <option value="CompleteRegistration">Registro Completo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Produto / Serviço
                </label>
                <input
                  type="text"
                  name="productName"
                  value={form.productName}
                  onChange={handleChange}
                  placeholder="Ex: Curso Online, Consultoria..."
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Notas internas (não enviadas ao Meta)"
                  rows={2}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>

          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center text-xs font-bold">
                4
              </span>
              Atribuição Meta
            </h2>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              <p>
                O `ctwa_clid` é capturado automaticamente no webhook do WhatsApp e enviado ao Meta
                pelo dataset de Business Messaging. Não é mais necessário informar `fbclid`
                manualmente.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                A conversa selecionada acima é a origem oficial da atribuição desta conversão.
              </p>
              <label className="mt-4 flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3">
                <input
                  type="checkbox"
                  name="useTestEventCode"
                  checked={form.useTestEventCode}
                  onChange={handleChange}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-700">
                    Enviar como evento de teste
                  </span>
                  <span className="block text-xs text-gray-500 mt-1">
                    Use isso apenas para validar em Test Events. Desmarcado, a conversão segue como
                    evento real.
                  </span>
                </span>
              </label>
            </div>
          </div>

          {error && (
            <div className="px-6 py-4 bg-red-50 border-b border-red-100">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="px-6 py-5 flex items-center gap-3 bg-gray-50">
            <button
              type="submit"
              disabled={loading || !!success || loadingConversations || conversations.length === 0}
              className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Enviando ao Meta...
                </span>
              ) : success ? (
                'Enviado'
              ) : (
                'Registrar e Enviar ao Meta'
              )}
            </button>
            <button
              type="button"
              onClick={() => router.push('/conversions')}
              className="px-5 py-3 text-gray-600 hover:text-gray-900 text-sm font-medium transition"
            >
              Cancelar
            </button>
          </div>
        </form>

        <div className="mt-4 bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-green-700 text-xs font-medium">Fluxo correto de CTWA</p>
          <p className="text-green-600 text-xs mt-1">
            1. O usuário clica no anúncio. 2. Entra no WhatsApp. 3. O webhook captura a mensagem com
            `ctwa_clid`. 4. Você registra a venda usando a conversa atribuída. 5. A API envia a
            conversão ao dataset de Business Messaging.
          </p>
        </div>
      </main>
    </div>
  )
}
