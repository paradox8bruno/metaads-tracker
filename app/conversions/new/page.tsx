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

function StepHeader({
  step,
  title,
  tone,
}: {
  step: string
  title: string
  tone: 'green' | 'blue' | 'slate'
}) {
  const toneMap = {
    green: 'bg-[var(--success-soft)] text-[var(--success)]',
    blue: 'bg-[var(--info-soft)] text-[var(--info)]',
    slate: 'bg-[rgba(36,50,71,0.08)] text-[#243247]',
  }

  return (
    <div className="mb-5 flex items-center gap-3">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold ${toneMap[tone]}`}>
        {step}
      </span>
      <div>
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
          Etapa {step}
        </p>
        <h2 className="text-base font-bold tracking-[-0.03em] text-[#162233]">{title}</h2>
      </div>
    </div>
  )
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
    value: '69',
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
        const response = await fetch('/api/whatsapp/conversations?attributedOnly=1')
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
    <div className="app-page min-h-screen">
      <Navbar />

      <main className="page-wrap py-8">
        <section className="page-header">
          <div className="page-kicker">Manual Conversion</div>
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
            <div>
              <h1 className="page-title">Registrar venda com atribuição oficial do WhatsApp.</h1>
              <p className="page-subtitle mt-4">
                Selecione uma conversa que já chegou com CTWA, complete os dados comerciais e envie
                o evento para o dataset correto do WABA. A tela prioriza o fluxo oficial de
                Business Messaging.
              </p>
            </div>
            <div className="surface section-card p-5">
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
                Fluxo correto
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--foreground-soft)]">
                1. Clique no anúncio. 2. Mensagem chega no WhatsApp. 3. O webhook salva o
                <code className="mx-1 rounded bg-[rgba(183,100,43,0.08)] px-2 py-1 text-[var(--accent-ink)]">
                  ctwa_clid
                </code>
                . 4. Você registra a venda ligada à conversa. 5. O projeto envia a conversão ao
                dataset.
              </p>
            </div>
          </div>
        </section>

        {success && (
          <div
            className={`section-card mb-6 border p-5 ${
              success.metaStatus === 'sent'
                ? 'border-[rgba(31,106,79,0.16)] bg-[var(--success-soft)]'
                : 'border-[rgba(150,100,0,0.16)] bg-[var(--warning-soft)]'
            }`}
          >
            <p className={`text-base font-bold ${success.metaStatus === 'sent' ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
              {success.metaStatus === 'sent'
                ? 'Conversão enviada ao Meta'
                : 'Venda salva, mas houve erro no envio ao Meta'}
            </p>
            {success.datasetId && (
              <p className="mt-2 text-sm text-[var(--foreground-soft)]">
                Dataset usado: <span className="font-mono text-xs">{success.datasetId}</span>
              </p>
            )}
            {success.eventsReceived !== undefined && (
              <p className="mt-1 text-sm text-[var(--foreground-soft)]">
                {success.eventsReceived} evento(s) recebido(s) pelo Meta.
              </p>
            )}
            <p className="mt-1 text-xs text-[var(--foreground-muted)]">
              Redirecionando para a lista...
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <section className="section-card surface overflow-hidden p-6">
              <StepHeader step="1" title="Lead do WhatsApp" tone="green" />

              {loadingConversations ? (
                <div className="rounded-2xl border border-[rgba(52,39,24,0.08)] bg-[rgba(239,231,220,0.56)] px-4 py-4 text-sm text-[var(--foreground-soft)]">
                  Carregando conversas capturadas no webhook...
                </div>
              ) : conversations.length === 0 ? (
                <div className="rounded-2xl border border-[rgba(150,100,0,0.16)] bg-[var(--warning-soft)] px-4 py-4">
                  <p className="text-sm font-semibold text-[var(--warning)]">
                    Nenhum lead atribuído disponível.
                  </p>
                  <p className="mt-1 text-sm leading-7 text-[var(--foreground-soft)]">
                    O lead só aparece aqui depois que o webhook do WhatsApp receber uma mensagem com
                    <code className="mx-1 rounded bg-white px-2 py-1 text-[var(--accent-ink)]">
                      ctwa_clid
                    </code>
                    vinda de anúncio Click to WhatsApp.
                  </p>
                  {conversationsError && (
                    <p className="mt-2 text-xs text-[var(--warning)]">{conversationsError}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#243247]">
                      Conversa atribuída <span className="text-[var(--danger)]">*</span>
                    </label>
                    <select
                      name="conversationId"
                      value={form.conversationId}
                      onChange={handleConversationChange}
                      required
                      className="field-select"
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
                    <p className="mt-2 text-xs text-[var(--foreground-muted)]">
                      Esta lista mostra apenas conversas que chegaram com CTWA válido no webhook.
                    </p>
                  </div>

                  {selectedConversation && (
                    <div className="rounded-[1.4rem] border border-[rgba(31,106,79,0.16)] bg-[rgba(217,239,228,0.68)] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-bold tracking-[-0.03em] text-[#163225]">
                            {selectedConversation.customer_name || 'Lead sem nome'}
                          </p>
                          <p className="mt-1 text-sm text-[var(--success)]">
                            {formatConversationPhone(selectedConversation.customer_phone)}
                          </p>
                        </div>
                        <div className="tag bg-white text-[var(--success)]">CTWA pronto</div>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
                            Última mensagem
                          </p>
                          <p className="mt-2 text-sm leading-7 text-[var(--foreground-soft)]">
                            {selectedConversation.latest_message_text || 'Sem texto'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
                            Anúncio
                          </p>
                          <p className="mt-2 text-sm leading-7 text-[var(--foreground-soft)]">
                            {selectedConversation.referral_headline || 'Sem headline'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 rounded-2xl border border-white/70 bg-white/70 px-4 py-3">
                        <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
                          CTWA CLID
                        </p>
                        <p className="mt-2 break-all font-mono text-xs text-[#243247]">
                          {selectedConversation.ctwa_clid}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="section-card surface overflow-hidden p-6">
              <StepHeader step="2" title="Dados do cliente" tone="blue" />
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#243247]">
                    Nome do cliente
                  </label>
                  <input
                    type="text"
                    name="customerName"
                    value={form.customerName}
                    onChange={handleChange}
                    placeholder="Ex: João Silva"
                    className="field-input"
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#243247]">
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
                      className="field-input"
                    />
                    <p className={`mt-2 text-xs ${phoneIsInvalid ? 'text-[var(--danger)]' : 'text-[var(--foreground-muted)]'}`}>
                      {phoneIsInvalid
                        ? 'Formato inválido. Informe DDD + número; o sistema assume Brasil (+55).'
                        : 'Opcional para complementar o match do Meta. O envio sai normalizado como 5511999999999.'}
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#243247]">
                      Email
                    </label>
                    <input
                      type="email"
                      name="customerEmail"
                      value={form.customerEmail}
                      onChange={handleChange}
                      placeholder="cliente@email.com"
                      className="field-input"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="section-card surface overflow-hidden p-6">
              <StepHeader step="3" title="Dados da venda" tone="blue" />
              <div className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#243247]">
                      Valor da venda <span className="text-[var(--danger)]">*</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--foreground-muted)]">
                        R$
                      </span>
                      <input
                        type="text"
                        name="value"
                        value={form.value}
                        onChange={handleChange}
                        placeholder="297,00"
                        required
                        className="field-input pl-11"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#243247]">
                      Tipo de evento
                    </label>
                    <select
                      name="eventName"
                      value={form.eventName}
                      onChange={handleChange}
                      className="field-select"
                    >
                      <option value="Purchase">Purchase (Compra)</option>
                      <option value="LeadSubmitted">LeadSubmitted</option>
                      <option value="InitiateCheckout">Início de Checkout</option>
                    </select>
                    <p className="mt-2 text-xs text-[var(--foreground-muted)]">
                      Esta tela usa os eventos oficiais suportados pela Meta para Business Messaging.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#243247]">
                    Produto / Serviço
                  </label>
                  <input
                    type="text"
                    name="productName"
                    value={form.productName}
                    onChange={handleChange}
                    placeholder="Ex: Curso Online, Consultoria..."
                    className="field-input"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#243247]">
                    Observações
                  </label>
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    placeholder="Notas internas (não enviadas ao Meta)"
                    rows={3}
                    className="field-textarea"
                  />
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="section-card surface overflow-hidden p-6">
              <StepHeader step="4" title="Atribuição Meta" tone="slate" />
              <div className="space-y-4 text-sm leading-7 text-[var(--foreground-soft)]">
                <p>
                  O <code className="rounded bg-[rgba(183,100,43,0.08)] px-2 py-1 text-[var(--accent-ink)]">ctwa_clid</code>{' '}
                  é capturado automaticamente no webhook e enviado ao Meta pelo dataset de Business
                  Messaging.
                </p>
                <p>
                  A conversa selecionada é a origem oficial da atribuição desta conversão. Não é mais
                  necessário preencher <code className="rounded bg-[rgba(37,89,178,0.08)] px-2 py-1 text-[var(--info)]">fbclid</code>{' '}
                  manualmente.
                </p>

                <label className="flex items-start gap-3 rounded-2xl border border-[rgba(52,39,24,0.08)] bg-[rgba(239,231,220,0.56)] px-4 py-4">
                  <input
                    type="checkbox"
                    name="useTestEventCode"
                    checked={form.useTestEventCode}
                    onChange={handleChange}
                    className="mt-1 h-4 w-4 rounded border-[rgba(52,39,24,0.14)] text-[var(--info)] focus:ring-[var(--info)]"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[#243247]">
                      Enviar como evento de teste
                    </span>
                    <span className="mt-1 block text-xs leading-6 text-[var(--foreground-muted)]">
                      Use apenas para validar em Test Events. Desmarcado, a conversão segue como evento real.
                    </span>
                  </span>
                </label>
              </div>
            </section>

            <section className="section-card surface-muted p-5">
              <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
                Checklist antes de enviar
              </p>
              <ul className="mt-3 space-y-3 text-sm leading-7 text-[var(--foreground-soft)]">
                <li>Conversa precisa ter vindo com CTWA válido.</li>
                <li>Telefone do cliente deve estar em formato brasileiro válido.</li>
                <li>Valor padrão do projeto está em R$ 69 e pode ser sobrescrito.</li>
                <li>Use evento de teste só quando estiver com a aba Test Events aberta.</li>
              </ul>
            </section>

            {error && (
              <section className="section-card border border-[rgba(180,35,24,0.16)] bg-[var(--danger-soft)] p-4">
                <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
              </section>
            )}

            <section className="section-card surface overflow-hidden p-6">
              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={loading || !!success || loadingConversations || conversations.length === 0}
                  className="cta-primary w-full px-5 py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Enviando ao Meta...
                    </span>
                  ) : success ? (
                    'Enviado'
                  ) : (
                    'Registrar e enviar ao Meta'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => router.push('/conversions')}
                  className="cta-secondary w-full px-5 py-3 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </section>
          </aside>
        </form>
      </main>
    </div>
  )
}
