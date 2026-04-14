'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/conversions" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="font-bold text-gray-900">MetaADS Tracker</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          <Link
            href="/conversions"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              pathname === '/conversions'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Conversões
          </Link>
          <Link
            href="/conversions/new"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              pathname === '/conversions/new'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            + Nova Venda
          </Link>
          <Link
            href="/webhooks"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              pathname === '/webhooks'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Webhook
          </Link>
          <button
            onClick={handleLogout}
            className="ml-2 px-3 py-2 text-sm text-gray-400 hover:text-gray-600 transition"
          >
            Sair
          </button>
        </div>
      </div>
    </nav>
  )
}
