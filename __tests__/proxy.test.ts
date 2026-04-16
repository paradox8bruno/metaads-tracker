import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { config, proxy } from '@/proxy'

function makeRequest(url: string, cookies: Record<string, string> = {}): NextRequest {
  const req = new NextRequest(new URL(url, 'http://localhost'))
  for (const [key, value] of Object.entries(cookies)) {
    req.cookies.set(key, value)
  }
  return req
}

const APP_SECRET = 'test-secret-abc'

describe('proxy config matcher', () => {
  it('aplica o proxy em rotas normais', () => {
    expect(unstable_doesMiddlewareMatch({ config, url: '/conversions' })).toBe(true)
    expect(unstable_doesMiddlewareMatch({ config, url: '/webhooks' })).toBe(true)
    expect(unstable_doesMiddlewareMatch({ config, url: '/conversions/new' })).toBe(true)
  })

  it('aplica o proxy em rotas de API', () => {
    expect(unstable_doesMiddlewareMatch({ config, url: '/api/conversions' })).toBe(true)
    expect(unstable_doesMiddlewareMatch({ config, url: '/api/whatsapp/conversations' })).toBe(true)
  })

  it('não aplica o proxy em arquivos estáticos do Next.js', () => {
    expect(unstable_doesMiddlewareMatch({ config, url: '/_next/static/chunk.js' })).toBe(false)
    expect(unstable_doesMiddlewareMatch({ config, url: '/_next/image' })).toBe(false)
    expect(unstable_doesMiddlewareMatch({ config, url: '/favicon.ico' })).toBe(false)
  })
})

describe('proxy function — rotas públicas', () => {
  beforeEach(() => {
    vi.stubEnv('APP_SECRET', APP_SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('/login é acessível sem sessão', () => {
    const req = makeRequest('http://localhost/login')
    const res = proxy(req)
    expect(res.status).not.toBe(302)
    expect(res.status).not.toBe(307)
    expect(res.status).not.toBe(401)
  })

  it('/api/auth é acessível sem sessão', () => {
    const req = makeRequest('http://localhost/api/auth')
    const res = proxy(req)
    expect(res.status).not.toBe(302)
    expect(res.status).not.toBe(307)
    expect(res.status).not.toBe(401)
  })

  it('/api/webhooks/whatsapp é acessível sem sessão', () => {
    const req = makeRequest('http://localhost/api/webhooks/whatsapp')
    const res = proxy(req)
    expect(res.status).not.toBe(302)
    expect(res.status).not.toBe(307)
    expect(res.status).not.toBe(401)
  })

  it('/api/webhooks/whatsapp com subpath é acessível', () => {
    const req = makeRequest('http://localhost/api/webhooks/whatsapp/verify')
    const res = proxy(req)
    expect(res.status).not.toBe(401)
  })
})

describe('proxy function — proteção de rotas', () => {
  beforeEach(() => {
    vi.stubEnv('APP_SECRET', APP_SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('redireciona para /login quando sem sessão em página', () => {
    const req = makeRequest('http://localhost/conversions')
    const res = proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('retorna 401 para API sem sessão', () => {
    const req = makeRequest('http://localhost/api/conversions')
    const res = proxy(req)
    expect(res.status).toBe(401)
  })

  it('retorna 401 para /api/whatsapp/conversations sem sessão', () => {
    const req = makeRequest('http://localhost/api/whatsapp/conversations')
    const res = proxy(req)
    expect(res.status).toBe(401)
  })

  it('retorna 401 para /api/init sem sessão', () => {
    const req = makeRequest('http://localhost/api/init')
    const res = proxy(req)
    expect(res.status).toBe(401)
  })

  it('permite acesso com sessão correta em página', () => {
    const req = makeRequest('http://localhost/conversions', { session: APP_SECRET })
    const res = proxy(req)
    expect(res.status).not.toBe(307)
    expect(res.status).not.toBe(401)
  })

  it('permite acesso com sessão correta em API', () => {
    const req = makeRequest('http://localhost/api/conversions', { session: APP_SECRET })
    const res = proxy(req)
    expect(res.status).not.toBe(401)
  })

  it('bloqueia com sessão errada em página', () => {
    const req = makeRequest('http://localhost/conversions', { session: 'wrong-secret' })
    const res = proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('bloqueia com sessão errada em API', () => {
    const req = makeRequest('http://localhost/api/conversions', { session: 'wrong-secret' })
    const res = proxy(req)
    expect(res.status).toBe(401)
  })
})

describe('proxy function — sem APP_SECRET configurada', () => {
  beforeEach(() => {
    vi.stubEnv('APP_SECRET', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('retorna 500 em rota protegida quando APP_SECRET não está configurada', () => {
    const req = makeRequest('http://localhost/conversions')
    const res = proxy(req)
    expect(res.status).toBe(500)
  })

  it('retorna 500 em API quando APP_SECRET não está configurada', () => {
    const req = makeRequest('http://localhost/api/conversions')
    const res = proxy(req)
    expect(res.status).toBe(500)
  })
})
