const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export interface TurnstileResult {
  success: boolean
  /** True when the failure was an infrastructure problem rather than a rejected token. */
  unavailable?: boolean
  errorCodes?: string[]
}

/**
 * Verify a Turnstile token server side. Fails closed: any network or parsing problem is treated as failure,
 * but reported as `unavailable` so the UI can suggest the phone/email fallback.
 */
export async function verifyTurnstile(
  token: string,
  opts: { secret: string | undefined; ip?: string; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<TurnstileResult> {
  if (!opts.secret || !token) return { success: false }
  const body = new URLSearchParams({ secret: opts.secret, response: token })
  if (opts.ip && opts.ip !== 'unknown') body.set('remoteip', opts.ip)
  try {
    const res = await (opts.fetchImpl ?? fetch)(VERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 5000),
    })
    if (!res.ok) return { success: false, unavailable: true }
    const json = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
    return { success: json.success === true, errorCodes: json['error-codes'] }
  } catch {
    return { success: false, unavailable: true }
  }
}
