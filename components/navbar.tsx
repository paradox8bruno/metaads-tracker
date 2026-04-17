'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const items = [
  { href: '/conversions', label: 'Conversões', eyebrow: 'Revenue' },
  { href: '/conversions/new', label: 'Nova venda', eyebrow: 'Capture' },
  { href: '/webhooks', label: 'Webhook', eyebrow: 'Debug' },
  { href: '/settings', label: 'Configurações', eyebrow: 'Setup' },
]

function isActive(pathname: string, href: string) {
  if (href === '/conversions') {
    return pathname === '/conversions' || pathname.startsWith('/conversions/')
  }

  return pathname === href || pathname.startsWith(href + '/')
}

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-20 border-b border-[rgba(52,39,24,0.08)] bg-[rgba(251,248,242,0.82)] backdrop-blur-xl">
      <div className="page-wrap">
        <nav className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between gap-4">
            <Link href="/conversions" className="group flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(183,100,43,0.18)] bg-[linear-gradient(145deg,#132033,#2c4665)] text-white shadow-[0_16px_30px_rgba(19,32,51,0.22)]">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M4 19h16M6 16l3.8-4.2 3.2 2.7L18 8"
                  />
                </svg>
              </div>
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[var(--foreground-muted)]">
                  Meta Ads Tracker
                </p>
                <p className="text-base font-extrabold tracking-[-0.03em] text-[#162233]">
                  Control Room
                </p>
              </div>
            </Link>

            <button
              onClick={handleLogout}
              className="cta-secondary px-4 py-2 text-sm lg:hidden"
            >
              Sair
            </button>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-wrap gap-2">
              {items.map(item => {
                const active = isActive(pathname, item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-2xl border px-4 py-3 ${
                      active
                        ? 'border-[rgba(183,100,43,0.24)] bg-[rgba(255,253,249,0.96)] shadow-[0_10px_24px_rgba(43,31,16,0.08)]'
                        : 'border-transparent bg-transparent hover:border-[rgba(52,39,24,0.08)] hover:bg-[rgba(255,253,249,0.68)]'
                    }`}
                  >
                    <span className="block text-[0.63rem] font-bold uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                      {item.eyebrow}
                    </span>
                    <span className="mt-0.5 block text-sm font-bold text-[#1e2b3b]">
                      {item.label}
                    </span>
                  </Link>
                )
              })}
            </div>

            <button
              onClick={handleLogout}
              className="cta-secondary hidden px-4 py-2 text-sm lg:inline-flex"
            >
              Sair
            </button>
          </div>
        </nav>
      </div>
    </header>
  )
}
