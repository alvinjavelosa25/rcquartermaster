import { describe, expect, it } from 'vitest'
import { bucketId, retryAfter } from '@/lib/security/rate-limit'
import { clientIp, hashIp, isSameOrigin } from '@/lib/security/request'
import { verifyTurnstile } from '@/lib/security/turnstile'
import { canDownload } from '@/lib/security/scanner'
import { buildCsp, buildSecurityHeaders } from '@/lib/security/headers.mjs'
import { LocalStorage, signLocalUrl, verifyLocalSignature } from '@/lib/storage/local'
import { isValidStorageKey } from '@/lib/storage/types'

const rule = { key: 'rfq:ip:abc', limit: 5, windowSeconds: 3600 }

describe('[UT-031] rate limit buckets', () => {
  it('uses one bucket per window and a new one after rollover', () => {
    const t = Date.UTC(2026, 10, 20, 10, 15)
    expect(bucketId(rule, t)).toBe(bucketId(rule, t + 60_000))
    expect(bucketId(rule, t)).not.toBe(bucketId(rule, t + 3600_000))
    expect(bucketId({ ...rule, key: 'other' }, t)).not.toBe(bucketId(rule, t))
  })
  it('reports time until the window resets', () => {
    const t = Date.UTC(2026, 10, 20, 10, 59, 30)
    expect(retryAfter(rule, t)).toBe(30)
    expect(retryAfter(rule, Date.UTC(2026, 10, 20, 11, 0, 0))).toBe(3600)
  })
})

describe('[UT-032] request helpers', () => {
  it('prefers the platform header and falls back safely', () => {
    expect(
      clientIp(new Headers({ 'x-vercel-forwarded-for': '1.1.1.1', 'x-forwarded-for': '9.9.9.9' })),
    ).toBe('1.1.1.1')
    expect(clientIp(new Headers({ 'x-forwarded-for': '2.2.2.2, 3.3.3.3' }))).toBe('2.2.2.2')
    expect(clientIp(new Headers())).toBe('unknown')
  })
  it('hashes IPs deterministically per salt and never returns the raw address', () => {
    const a = hashIp('1.2.3.4', 'salt-one-salt-one-1')
    expect(a).toBe(hashIp('1.2.3.4', 'salt-one-salt-one-1'))
    expect(a).not.toBe(hashIp('1.2.3.4', 'salt-two-salt-two-2'))
    expect(a).not.toContain('1.2.3.4')
  })
  it('[SEC-08] accepts only same-origin POSTs', () => {
    const site = 'https://www.example.com'
    expect(
      isSameOrigin(
        new Headers({ origin: 'https://www.example.com', host: 'www.example.com' }),
        site,
      ),
    ).toBe(true)
    expect(
      isSameOrigin(new Headers({ origin: 'https://evil.example', host: 'www.example.com' }), site),
    ).toBe(false)
    expect(isSameOrigin(new Headers({ host: 'www.example.com' }), site)).toBe(false)
    expect(isSameOrigin(new Headers({ origin: 'null', host: 'www.example.com' }), site)).toBe(false)
  })
})

describe('[UT-030] Turnstile verification fails closed', () => {
  const ok = (body: unknown, status = 200) =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
  it('passes only on explicit success', async () => {
    expect(
      (await verifyTurnstile('t', { secret: 's', fetchImpl: ok({ success: true }) })).success,
    ).toBe(true)
    expect(
      (
        await verifyTurnstile('t', {
          secret: 's',
          fetchImpl: ok({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
        })
      ).success,
    ).toBe(false)
  })
  it('fails on HTTP errors, network errors and malformed responses, flagged as unavailable', async () => {
    expect(await verifyTurnstile('t', { secret: 's', fetchImpl: ok({}, 500) })).toMatchObject({
      success: false,
      unavailable: true,
    })
    const boom = (async () => {
      throw new Error('network')
    }) as unknown as typeof fetch
    expect(await verifyTurnstile('t', { secret: 's', fetchImpl: boom })).toMatchObject({
      success: false,
      unavailable: true,
    })
    const garbage = (async () => new Response('not json')) as unknown as typeof fetch
    expect((await verifyTurnstile('t', { secret: 's', fetchImpl: garbage })).success).toBe(false)
  })
  it('rejects a missing token or secret without calling out', async () => {
    let called = false
    const spy = (async () => {
      called = true
      return new Response('{}')
    }) as unknown as typeof fetch
    expect((await verifyTurnstile('', { secret: 's', fetchImpl: spy })).success).toBe(false)
    expect((await verifyTurnstile('t', { secret: undefined, fetchImpl: spy })).success).toBe(false)
    expect(called).toBe(false)
  })
})

describe('[FR-039] scan status policy', () => {
  it('allows clean, and skipped only when configured', () => {
    expect(canDownload('clean', false)).toBe(true)
    expect(canDownload('skipped', true)).toBe(true)
    expect(canDownload('skipped', false)).toBe(false)
    for (const s of ['pending', 'infected', 'error']) expect(canDownload(s, true)).toBe(false)
  })
})

describe('[SEC-01] security headers and CSP', () => {
  const headers = Object.fromEntries(
    buildSecurityHeaders({ isDev: false, plausible: true }).map((h) => [h.key, h.value]),
  )
  it('sets the expected headers', () => {
    expect(headers['Strict-Transport-Security']).toMatch(/max-age=31536000/)
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['Permissions-Policy']).toContain('camera=()')
  })
  it('CSP allows Turnstile but blocks framing, objects and eval in production', () => {
    const csp = headers['Content-Security-Policy']!
    expect(csp).toContain('https://challenges.cloudflare.com')
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).not.toContain("'unsafe-eval'")
    expect(csp).toContain('https://plausible.io')
    expect(csp).not.toContain('googletagmanager')
  })
  it('adds analytics and storage origins only when configured; dev allows eval', () => {
    const csp = buildCsp({
      isDev: true,
      ga4: true,
      s3Endpoint: 'https://abc.r2.cloudflarestorage.com/bucket',
    })
    expect(csp).toContain('googletagmanager')
    expect(csp).toContain('https://abc.r2.cloudflarestorage.com')
    expect(csp).toContain("'unsafe-eval'")
  })
  it('marks non-production environments noindex', () => {
    expect(buildSecurityHeaders({ indexable: false }).some((h) => h.key === 'X-Robots-Tag')).toBe(
      true,
    )
    expect(buildSecurityHeaders({ indexable: true }).some((h) => h.key === 'X-Robots-Tag')).toBe(
      false,
    )
  })
})

describe('[ATT-11][ATT-12] storage keys and signed URLs', () => {
  it('accepts only server-generated key shapes', () => {
    expect(isValidStorageKey('quarantine/2f1c9d0e-8b8a-4a3a-9b1e-0d6a4b3c2f10')).toBe(true)
    expect(isValidStorageKey('rfq/2026/2f1c9d0e-8b8a-4a3a-9b1e-0d6a4b3c2f10')).toBe(true)
    for (const bad of [
      '../etc/passwd',
      'rfq/../../x',
      'public/a',
      'quarantine//a',
      'quarantine/a b',
      '',
      'rfq/',
    ]) {
      expect(isValidStorageKey(bad), bad).toBe(false)
    }
  })
  it('signatures are bound to action, key, expiry and extra data', () => {
    const secret = 'secret-secret-secret-secret-1234'
    const exp = Math.floor(Date.now() / 1000) + 60
    const sig = signLocalUrl(secret, 'upload', 'quarantine/a', exp, 'application/pdf')
    expect(
      verifyLocalSignature(secret, 'upload', 'quarantine/a', exp, sig, 'application/pdf'),
    ).toBe(true)
    expect(
      verifyLocalSignature(secret, 'download', 'quarantine/a', exp, sig, 'application/pdf'),
    ).toBe(false)
    expect(
      verifyLocalSignature(secret, 'upload', 'quarantine/b', exp, sig, 'application/pdf'),
    ).toBe(false)
    expect(verifyLocalSignature(secret, 'upload', 'quarantine/a', exp, sig, 'text/html')).toBe(
      false,
    )
    expect(
      verifyLocalSignature(
        'other-secret-other-secret-1234',
        'upload',
        'quarantine/a',
        exp,
        sig,
        'application/pdf',
      ),
    ).toBe(false)
    const past = Math.floor(Date.now() / 1000) - 5
    expect(
      verifyLocalSignature(
        secret,
        'upload',
        'quarantine/a',
        past,
        signLocalUrl(secret, 'upload', 'quarantine/a', past, 'x'),
        'x',
      ),
    ).toBe(false)
    expect(
      verifyLocalSignature(secret, 'upload', 'quarantine/a', exp, 'zz', 'application/pdf'),
    ).toBe(false)
  })
  it('creates upload targets that expire', async () => {
    const t = await new LocalStorage('secret-secret-secret-secret-1234').createUploadTarget(
      'quarantine/abc',
      { contentType: 'application/pdf', expiresInSeconds: 300 },
    )
    expect(t.method).toBe('PUT')
    expect(t.url).toContain('/api/dev-storage?')
    expect(t.headers['Content-Type']).toBe('application/pdf')
  })
})
