'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        router.push('/conversions')
        router.refresh()
        return
      }

      const data = await res.json().catch(() => null)
      setError(data?.error || 'Não foi possível entrar. Tente novamente.')
    } catch {
      setError('Erro de conexão ao tentar entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.24),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.14),transparent_32%),linear-gradient(145deg,#0b1220_0%,#09111d_52%,#060d18_100%)]" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[rgba(148,163,184,0.14)] bg-[rgba(9,17,31,0.84)] shadow-[0_32px_100px_rgba(2,6,23,0.55)] backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
        <section className="border-b border-[rgba(148,163,184,0.12)] px-6 py-8 sm:px-8 lg:border-b-0 lg:border-r">
          <div className="page-kicker">Business Messaging</div>
          <div className="mt-6 max-w-xl">
            <h1 className="page-title">Painel de captura, auditoria e conversão para Meta Ads.</h1>
            <p className="page-subtitle mt-4">
              Controle os leads vindos de Click to WhatsApp, confira o que o webhook realmente
              recebeu e envie conversões para o dataset sem depender de telas confusas da Meta.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="metric-card p-5">
              <p className="metric-label">Webhook</p>
              <p className="metric-value">Raw + parse</p>
              <p className="metric-note">Tudo que a Meta entrega fica auditável.</p>
            </div>
            <div className="metric-card p-5">
              <p className="metric-label">CTWA</p>
              <p className="metric-value">Lead real</p>
              <p className="metric-note">Atribuição salva por conversa e por evento.</p>
            </div>
            <div className="metric-card p-5">
              <p className="metric-label">CAPI</p>
              <p className="metric-value">Business</p>
              <p className="metric-note">Conversões saem pelo dataset certo do WABA.</p>
            </div>
          </div>
        </section>

        <section className="px-6 py-8 sm:px-8">
          <div className="surface section-card p-6 sm:p-7">
            <div className="mb-6">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                Acesso privado
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[var(--foreground)]">
                Entrar no painel
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--foreground-soft)]">
                Use a senha configurada no projeto para abrir o ambiente operacional.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--foreground-soft)]">
                  Senha de acesso
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="field-input"
                  required
                  autoFocus
                />
              </div>

              {error && (
                <div className="rounded-2xl border border-[rgba(180,35,24,0.14)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="cta-primary w-full px-5 py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-[rgba(148,163,184,0.12)] bg-[rgba(17,29,48,0.72)] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
                O que você encontra lá dentro
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--foreground-soft)]">
                Lista de conversões, detalhe completo do payload enviado à Meta, novo registro de
                venda e auditoria operacional do webhook com mensagens, echoes e eventos extras.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
