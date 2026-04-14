import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getConversion, initDB, type Conversion } from '@/lib/db'
import { Navbar } from '@/components/navbar'
import { formatDatabaseTimestamp } from '@/lib/datetime'
import { formatBrazilPhone } from '@/lib/phone'

function StatusBadge({ status }: { status: string }) {
  const styles = {
    sent: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
  }[status] || 'bg-gray-100 text-gray-700'

  const labels = {
    sent: 'Enviado com sucesso',
    error: 'Erro no envio',
    pending: 'Pendente',
  }[status] || status

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${styles}`}>
      {labels}
    </span>
  )
}

function EventBadge({ eventName }: { eventName: string }) {
  const styles = {
    Purchase: 'bg-emerald-100 text-emerald-700',
    LeadSubmitted: 'bg-blue-100 text-blue-700',
    InitiateCheckout: 'bg-amber-100 text-amber-700',
  }[eventName] || 'bg-gray-100 text-gray-700'

  const labels = {
    Purchase: 'Purchase',
    LeadSubmitted: 'Lead automático',
    InitiateCheckout: 'Checkout iniciado',
  }[eventName] || eventName

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${styles}`}>
      {labels}
    </span>
  )
}

function SourceBadge({ source }: { source: Conversion['source'] }) {
  const styles = {
    whatsapp: 'bg-green-100 text-green-700',
    manual: 'bg-slate-100 text-slate-700',
    stripe: 'bg-indigo-100 text-indigo-700',
    mercadopago: 'bg-cyan-100 text-cyan-700',
  }[source] || 'bg-gray-100 text-gray-700'

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${styles}`}>
      {source}
    </span>
  )
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

export default async function ConversionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await initDB()
  const conversion = await getConversion(id)

  if (!conversion) notFound()

  const isAutomaticLead = conversion.event_name === 'LeadSubmitted'

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/conversions" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar para conversões
        </Link>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {formatDisplayValue(conversion)}
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Registrado em{' '}
              {formatDatabaseTimestamp(conversion.created_at, { withSeconds: true })}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <EventBadge eventName={conversion.event_name} />
              <SourceBadge source={conversion.source} />
            </div>
          </div>
          <StatusBadge status={conversion.meta_status} />
        </div>

        <div className={`mb-6 rounded-xl border p-4 ${isAutomaticLead ? 'border-blue-200 bg-blue-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <p className={`text-sm font-medium ${isAutomaticLead ? 'text-blue-900' : 'text-emerald-900'}`}>
            {isAutomaticLead ? 'Lead automático do WhatsApp' : 'Evento de conversão enviado ao Meta'}
          </p>
          <p className={`mt-1 text-sm ${isAutomaticLead ? 'text-blue-800' : 'text-emerald-800'}`}>
            {isAutomaticLead
              ? 'Este registro foi criado automaticamente quando o webhook identificou uma conversa atribuída com ctwa_clid. Ele existe para alimentar o dataset do Meta assim que o lead inicia a conversa.'
              : 'Este registro representa um evento de negócio enviado ao Meta. Em geral, Purchase é informado depois que o pagamento é confirmado.'}
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Resumo do evento</h2>
            </div>
            <div className="px-5 py-4 grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Evento</p>
                <p className="text-gray-900 font-medium">{conversion.event_name}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Origem</p>
                <p className="text-gray-900 font-medium">{conversion.source}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Status Meta</p>
                <StatusBadge status={conversion.meta_status} />
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Valor</p>
                <p className="text-gray-900 font-medium">{formatDisplayValue(conversion)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Registrado em</p>
                <p className="text-gray-900 font-medium">
                  {formatDatabaseTimestamp(conversion.created_at, { withSeconds: true })}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Enviado ao Meta em</p>
                <p className="text-gray-900 font-medium">
                  {conversion.meta_sent_at
                    ? formatDatabaseTimestamp(conversion.meta_sent_at, {
                        withSeconds: true,
                      })
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Produto ou contexto</p>
                <p className="text-gray-900 font-medium">
                  {conversion.product_name || (isAutomaticLead ? 'Lead automático do WhatsApp' : '—')}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Source ref</p>
                <p className="break-all font-mono text-xs text-gray-700">
                  {conversion.source_ref || '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Cliente e atribuição</h2>
            </div>
            <div className="px-5 py-4 grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Nome</p>
                <p className="text-gray-900 font-medium">{conversion.customer_name || '—'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Telefone</p>
                <p className="text-gray-900 font-medium">
                  {conversion.customer_phone ? formatBrazilPhone(conversion.customer_phone) : '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Email</p>
                <p className="text-gray-900 font-medium">{conversion.customer_email || '—'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Conversa WhatsApp</p>
                <p className="break-all font-mono text-xs text-gray-700">
                  {conversion.whatsapp_conversation_id || '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Event ID (dedup)</p>
                <p className="text-gray-600 font-mono text-xs">{conversion.event_id}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Dataset ID</p>
                <p className="text-gray-600 font-mono text-xs">{conversion.dataset_id || '—'}</p>
              </div>
              <div className="xl:col-span-2">
                <p className="text-gray-400 text-xs mb-0.5">CTWA CLID</p>
                <p className="text-gray-600 font-mono text-xs break-all">
                  {conversion.ctwa_clid || '—'}
                </p>
              </div>
            </div>
            {conversion.notes && (
              <div className="border-t border-gray-100 px-5 py-4 text-sm">
                <p className="text-gray-400 text-xs mb-0.5">Observações</p>
                <p className="text-gray-700">{conversion.notes}</p>
              </div>
            )}
          </div>

          {conversion.meta_event_payload && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                <h2 className="text-sm font-semibold text-gray-700">Payload enviado ao Meta</h2>
              </div>
              <div className="px-5 py-4">
                <pre className="text-xs bg-gray-50 rounded-lg p-4 overflow-auto text-gray-700 font-mono">
                  {JSON.stringify(conversion.meta_event_payload, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {conversion.meta_response && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                <h2 className="text-sm font-semibold text-gray-700">Resposta da API do Meta</h2>
              </div>
              <div className="px-5 py-4">
                <pre className="text-xs bg-gray-50 rounded-lg p-4 overflow-auto text-gray-700 font-mono">
                  {JSON.stringify(conversion.meta_response, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
