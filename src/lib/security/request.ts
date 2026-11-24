import { createHmac } from 'node:crypto'
import { getEnv } from '@/env'

/**
 * Best-effort client IP. On Vercel `x-forwarded-for` is set by the platform and cannot be spoofed by the client.
 * Behind other proxies, make sure the proxy overwrites this header.
 */
export function clientIp(headers: Headers): string {
  const vercel = headers.get('x-vercel-forwarded-for')
  if (vercel) return vercel.split(',')[0]!.trim()
  const xff = headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Salted HMAC of an IP. The raw address is never stored or logged. */
export function hashIp(ip: string, salt?: string): string {
  const key = salt ?? getEnv().IP_HASH_SALT ?? getEnv().PAYLOAD_SECRET
  return createHmac('sha256', key).update(ip).digest('hex').slice(0, 32)
}

/** Same-origin check for state-changing requests (defence in depth next to SameSite cookies). */
export function isSameOrigin(headers: Headers, siteUrl: string): boolean {
  const origin = headers.get('origin')
  if (!origin) return false
  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    return false
  }
  const allowed = new Set<string>()
  try {
    allowed.add(new URL(siteUrl).host)
  } catch {
    // ignore invalid site url
  }
  const host = headers.get('x-forwarded-host') ?? headers.get('host')
  if (host) allowed.add(host)
  return allowed.has(originHost)
}
