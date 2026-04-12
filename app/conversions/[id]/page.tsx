import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getConversion } from '@/lib/db'
import { Navbar } from '@/components/navbar'

function StatusBadge({ status }: { status: string }) {
  const styles = {
    sent: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
  }[status] || 'bg-gray-100 text-gray-700'

  const labels = { sent: '✓ Enviado com sucesso', error: '✗ Erro no envio', pending: '⏳ Pendente' }[status] || status

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${styles}`}>
      {labels}
    </span>
  )
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(value)
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(dateStr))
}

export default async function ConversionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const conversion = await getConversion(id)

  if (!conversion) notFound()

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Back */}
        <Link href="/conversions" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar para conversões
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {formatCurrency(Number(conversion.value), conversion.currency)}
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {conversion.event_name} • {formatDate(conversion.created_at)}
            </p>
          </div>
          <StatusBadge status={conversion.meta_status} />
        </div>

        <div className="space-y-4">
          {/* Dados do Cliente */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Dados do Cliente</h2>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Nome</p>
                <p className="text-gray-900 font-medium">{conversion.customer_name || '—'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Telefone</p>
                <p className="text-gray-900 font-medium">{conversion.customer_phone || '—'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Email</p>
                <p className="text-gray-900 font-medium">{conversion.customer_email || '—'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Produto</p>
                <p className="text-gray-900 font-medium">{conversion.product_name || '—'}</p>
              </div>
            </div>
            {conversion.notes && (
              <div className="px-5 pb-4 text-sm">
                <p className="text-gray-400 text-xs mb-0.5">Observações</p>
                <p className="text-gray-700">{conversion.notes}</p>
              </div>
            )}
          </div>

          {/* Dados Meta CAPI */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Envio para Meta Ads</h2>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Evento</p>
                <p className="text-gray-900 font-medium">{conversion.event_name}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Status</p>
                <StatusBadge status={conversion.meta_status} />
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Enviado em</p>
                <p className="text-gray-900 font-medium">
                  {conversion.meta_sent_at ? formatDate(conversion.meta_sent_at) : '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Event ID (dedup)</p>
                <p className="text-gray-600 font-mono text-xs">{conversion.event_id}</p>
              </div>
            </div>
          </div>

          {/* Resposta do Meta */}
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
