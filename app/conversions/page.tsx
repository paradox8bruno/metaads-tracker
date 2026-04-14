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
    sent: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
  }[status] || 'bg-gray-100 text-gray-700'

  const labels = {
    sent: 'Enviado',
    error: 'Erro',
    pending: 'Pendente',
  }[status] || status

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles}`}>
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
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}>
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
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {source}
    </span>
  )
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
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Conversões</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Leads automáticos do webhook e eventos enviados ao Meta via Business Messaging CAPI
            </p>
          </div>
          <Link
            href="/conversions/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Registrar evento
          </Link>
        </div>

        {dbError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <p className="text-yellow-800 font-medium text-sm">Banco de dados não inicializado</p>
            <p className="text-yellow-500 text-xs mt-1">{dbError}</p>
          </div>
        )}

        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-900">Como ler esta tela</p>
          <p className="mt-1 text-sm text-blue-800">
            <code className="rounded bg-blue-100 px-1 py-0.5">LeadSubmitted</code> é criado
            automaticamente quando uma conversa do WhatsApp chega com atribuição CTWA.{' '}
            <code className="rounded bg-blue-100 px-1 py-0.5">Purchase</code> pode ser enviado
            depois, quando a venda for confirmada.
          </p>
        </div>

        <div className="grid gap-4 mb-6 sm:grid-cols-2 xl:grid-cols-3">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
              Total de registros
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalConversions}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
              Leads automáticos
            </p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{totalLeadConversions}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
              Purchases
            </p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{totalPurchaseConversions}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
              Enviadas ao Meta
            </p>
            <p className="text-2xl font-bold text-green-600 mt-1">{sentCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
              Pendentes
            </p>
            <p className="text-2xl font-bold text-yellow-700 mt-1">{pendingCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
              Com erro
            </p>
            <p className="text-2xl font-bold text-red-600 mt-1">{errorCount}</p>
          </div>
        </div>

        {conversions.length === 0 && !dbError ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-gray-900 font-semibold">Nenhuma conversão registrada</h3>
            <p className="text-gray-500 text-sm mt-1">
              Os leads aparecem automaticamente pelo webhook e compras podem ser registradas
              manualmente depois.
            </p>
            <Link href="/conversions/new" className="inline-block mt-4 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
              Registrar primeiro evento
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Data</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Tipo</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Cliente</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Contexto</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Valor</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Status Meta</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {conversions.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-4 text-gray-500 whitespace-nowrap">
                      {formatDatabaseTimestamp(c.created_at, { withSeconds: true })}
                    </td>
                    <td className="px-5 py-4">
                      <EventBadge eventName={c.event_name} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-900">{c.customer_name || '—'}</div>
                      <div className="text-gray-400 text-xs">
                        {c.customer_phone ? formatBrazilPhone(c.customer_phone) : c.customer_email || ''}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      <div>{c.product_name || (c.event_name === 'LeadSubmitted' ? 'Lead automático do WhatsApp' : '—')}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <SourceBadge source={c.source} />
                      </div>
                      {c.source_ref && (
                        <div className="mt-1 font-mono text-[11px] text-gray-400">{c.source_ref}</div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-gray-900">
                      {formatConversionValue(c)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <StatusBadge status={c.meta_status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/conversions/${c.id}`} className="text-blue-600 hover:text-blue-800 font-medium text-xs">
                        Detalhes →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {errorCount > 0 && (
              <div className="border-t border-gray-100 px-5 py-3 bg-red-50">
                <p className="text-red-600 text-xs">
                  {errorCount} conversão(ões) com erro no envio ao Meta. Verifique os detalhes.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
