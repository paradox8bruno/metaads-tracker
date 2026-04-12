'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar'

export default function NewConversionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ id: string; metaStatus: string; eventsReceived?: number } | null>(null)

  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    value: '',
    currency: 'BRL',
    productName: '',
    notes: '',
    eventName: 'Purchase',
    fbclid: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(null)

    try {
      const res = await fetch('/api/conversions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          value: parseFloat(form.value.replace(',', '.')),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao registrar conversão')
        setLoading(false)
        return
      }

      setSuccess(data)
      setLoading(false)

      // Redireciona para lista após 2 segundos
      setTimeout(() => router.push('/conversions'), 2000)
    } catch {
      setError('Erro de conexão. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Registrar Nova Venda</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Preencha os dados da venda fechada no WhatsApp para enviar ao Meta Ads
          </p>
        </div>

        {/* Sucesso */}
        {success && (
          <div className={`rounded-xl p-5 mb-6 ${success.metaStatus === 'sent' ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${success.metaStatus === 'sent' ? 'bg-green-100' : 'bg-yellow-100'}`}>
                {success.metaStatus === 'sent'
                  ? <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  : <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" /></svg>
                }
              </div>
              <div>
                <p className={`font-semibold ${success.metaStatus === 'sent' ? 'text-green-800' : 'text-yellow-800'}`}>
                  {success.metaStatus === 'sent' ? '✓ Conversão enviada ao Meta!' : '⚠️ Salvo, mas houve erro no Meta'}
                </p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Seção: Cliente */}
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
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
                    WhatsApp / Telefone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="customerPhone"
                    value={form.customerPhone}
                    onChange={handleChange}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-400 mt-1">Principal para matching no Meta</p>
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

          {/* Seção: Venda */}
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              Dados da Venda
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor da venda <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">R$</span>
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

          {/* Seção: Avançado */}
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center text-xs font-bold">3</span>
              Avançado (opcional)
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Facebook Click ID (fbclid)
              </label>
              <input
                type="text"
                name="fbclid"
                value={form.fbclid}
                onChange={handleChange}
                placeholder="Cole o fbclid da URL do anúncio se disponível"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">
                Melhora a atribuição. Encontrado na URL: ?fbclid=XXXXX
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-6 py-4 bg-red-50 border-b border-red-100">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="px-6 py-5 flex items-center gap-3 bg-gray-50">
            <button
              type="submit"
              disabled={loading || !!success}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Enviando ao Meta...
                </span>
              ) : success ? '✓ Enviado!' : 'Registrar e Enviar ao Meta'}
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

        {/* Dica */}
        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-blue-700 text-xs font-medium">💡 Dica de atribuição</p>
          <p className="text-blue-600 text-xs mt-1">
            O <strong>telefone</strong> é o dado mais importante para o Meta identificar o cliente e atribuir à campanha certa.
            Use o mesmo número que está no WhatsApp, com DDD.
          </p>
        </div>
      </main>
    </div>
  )
}
