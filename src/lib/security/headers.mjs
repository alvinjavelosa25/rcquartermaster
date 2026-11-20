/**
 * Security header and CSP builder. Plain .mjs so next.config.mjs and tests can both import it.
 *
 * Known gap (docs/ARCHITECTURE.md 7.2, task F-11/H-04): script-src still allows 'unsafe-inline'
 * because a nonce-based policy forces every page to render dynamically, which conflicts with ISR.
 * Revisit before launch with CWV measurements.
 */

/** @param {string | undefined} value */
function originOf(value) {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

/**
 * @param {{ isDev?: boolean, s3Endpoint?: string, plausible?: boolean, ga4?: boolean }} opts
 */
export function buildCsp({ isDev = false, s3Endpoint, plausible = false, ga4 = false } = {}) {
  const script = ["'self'", "'unsafe-inline'", 'https://challenges.cloudflare.com']
  const connect = ["'self'", 'https://challenges.cloudflare.com']
  const img = ["'self'", 'data:', 'blob:']
  if (isDev) script.push("'unsafe-eval'")
  if (plausible) {
    script.push('https://plausible.io')
    connect.push('https://plausible.io')
  }
  if (ga4) {
    script.push('https://www.googletagmanager.com')
    connect.push(
      'https://www.google-analytics.com',
      'https://*.analytics.google.com',
      'https://*.googletagmanager.com',
    )
    img.push('https://www.google-analytics.com')
  }
  const s3 = originOf(s3Endpoint)
  if (s3) connect.push(s3)

  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${img.join(' ')}`,
    "font-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    'frame-src https://challenges.cloudflare.com',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ')
}

/**
 * @param {{ isDev?: boolean, s3Endpoint?: string, plausible?: boolean, ga4?: boolean, indexable?: boolean }} opts
 */
export function buildSecurityHeaders(opts = {}) {
  const headers = [
    { key: 'Content-Security-Policy', value: buildCsp(opts) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
    { key: 'X-Frame-Options', value: 'DENY' },
  ]
  if (!opts.isDev) {
    headers.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' })
  }
  if (opts.indexable === false) {
    headers.push({ key: 'X-Robots-Tag', value: 'noindex, nofollow' })
  }
  return headers
}
