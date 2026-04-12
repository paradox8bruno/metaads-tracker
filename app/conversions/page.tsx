import Link from 'next/link'
import { listConversions, type Conversion } from '@/lib/db'
import { Navbar } from '@/components/navbar'

function StatusBadge({ status }: { status: string }) {
  const styles = {
    sent: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
  }[status] || 'bg-gray-100 text-gray-700'

  const labels = {
    sent: '✓ Enviado',
    error: '✗ Erro',
    pending: '⏳ Pendente',
  }[status] || status

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles}`}>
      {labels}
    </span>
  )
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(value)
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

export default async function ConversionsPage() {
  let conversions: Conversion[] = []
  let dbError: string | null = null

  try {
    conversions = await listConversions()
  } catch (err) {
    dbError = String(err)
  }

  const totalValue = conversions.reduce((acc, c) => acc + Number(c.value), 0)
  const sentCount = conversions.filter(c => c.meta_status === 'sent').length
  const errorCount = conversions.filter(c => c.meta_status === 'error').length

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Conversões</h1>
            <p className="text-gray-500 text-sm mt-0.5">Vendas enviadas para o Meta Ads</p>
          </div>
          <Link
            href="/conversions/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Registrar Venda
          </Link>
        </div>

        {/* DB Error */}
        {dbError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <p className="text-yellow-800 font-medium text-sm">⚠️ Banco de dados não inicializado</p>
            <p className="text-yellow-600 text-sm mt-1">
              Acesse <code className="bg-yellow-100 px-1 rounded">/api/init</code> para criar a tabela.
            </p>
            <p className="text-yellow-500 text-xs mt-1">{dbError}</p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total de Vendas</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{conversions.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Enviadas ao Meta</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{sentCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Receita Total</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(totalValue, 'BRL')}
            </p>
          </div>
        </div>

        {/* Table */}
        {conversions.length === 0 && !dbError ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-gray-900 font-semibold">Nenhuma venda registrada</h3>
            <p className="text-gray-500 text-sm mt-1">Registre sua primeira venda para começar a enviar conversões ao Meta.</p>
            <Link href="/conversions/new" className="inline-block mt-4 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
              Registrar primeira venda
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Data</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Cliente</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Produto</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Valor</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wide px-5 py-3">Status Meta</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {conversions.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-4 text-gray-500 whitespace-nowrap">
                      {formatDate(c.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-900">{c.customer_name || '—'}</div>
                      <div className="text-gray-400 text-xs">{c.customer_phone || c.customer_email || ''}</div>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{c.product_name || '—'}</td>
                    <td className="px-5 py-4 text-right font-semibold text-gray-900">
                      {formatCurrency(Number(c.value), c.currency)}
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
                  ⚠️ {errorCount} conversão(ões) com erro no envio ao Meta. Verifique os detalhes.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
