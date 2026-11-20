import { createHash } from 'node:crypto'
import { after } from 'next/server'
import { getEnv, siteUrl } from '@/env'
import { json } from '@/lib/http'
import { PayloadMailer } from '@/lib/mail/mailer'
import { getPayloadClient } from '@/lib/payload'
import { fieldErrors, rfqSubmissionSchema } from '@/lib/rfq/schema'
import { RfqError, submitRfq } from '@/lib/rfq/service'
import { COLLECTIONS } from '@/lib/constants'
import { checkRateLimits } from '@/lib/security/rate-limit'
import { clientIp, hashIp, isSameOrigin } from '@/lib/security/request'
import { getScanner } from '@/lib/security/scanner'
import { verifyTurnstile } from '@/lib/security/turnstile'
import { getPrivateStorage } from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 200_000
const FALLBACK = 'If this keeps happening, please call or email us and quote your request details.'

export async function POST(request: Request) {
  const env = getEnv()
  if (!isSameOrigin(request.headers, siteUrl())) return json({ error: 'Forbidden' }, 403)

  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) return json({ error: 'The request is too large.' }, 413)

  const payload = await getPayloadClient()
  const ip = clientIp(request.headers)
  const ipHash = hashIp(ip)

  // Rate limit first: it protects Turnstile verification and the database.
  const limited = await checkRateLimits(payload, [
    { key: `rfq:ip:${ipHash}`, limit: env.RFQ_RATE_LIMIT_PER_HOUR, windowSeconds: 3600 },
    { key: `rfq:ip:${ipHash}`, limit: env.RFQ_RATE_LIMIT_PER_DAY, windowSeconds: 86_400 },
  ])
  if (!limited.allowed) {
    return json(
      { error: `Too many requests from your network. Please try again later. ${FALLBACK}`, retryAfter: limited.retryAfterSeconds },
      429,
      { 'Retry-After': String(limited.retryAfterSeconds) },
    )
  }

  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) return json({ error: 'The request is too large.' }, 413)
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return json({ error: 'Invalid request.' }, 400)
  }

  const parsed = rfqSubmissionSchema.safeParse(raw)
  if (!parsed.success) {
    return json({ error: 'Please correct the highlighted fields.', fields: fieldErrors(parsed.error) }, 400)
  }
  const input = parsed.data

  // Honeypot: pretend success so bots learn nothing.
  if (input.website) return json({ reference: 'RCQ-000000-000000', duplicate: false }, 201)

  // A retried request with the same idempotency key returns the original result, even though its
  // single-use Turnstile token is already spent.
  const existing = await payload.find({
    collection: COLLECTIONS.rfqs,
    where: { idempotencyKey: { equals: input.idempotencyKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { reference: true },
  })
  if (existing.docs[0]) return json({ reference: existing.docs[0].reference, duplicate: true }, 200)

  const verification = await verifyTurnstile(input.turnstileToken, { secret: env.TURNSTILE_SECRET_KEY, ip })
  if (!verification.success) {
    return json(
      {
        error: verification.unavailable
          ? `We could not complete the verification check. ${FALLBACK}`
          : 'The verification check failed. Please try again.',
        code: verification.unavailable ? 'turnstile_unavailable' : 'turnstile_failed',
      },
      400,
    )
  }

  const emailHash = createHash('sha256').update(input.email).digest('hex').slice(0, 32)
  const perEmail = await checkRateLimits(payload, [
    { key: `rfq:email:${emailHash}`, limit: env.RFQ_RATE_LIMIT_PER_EMAIL_PER_DAY, windowSeconds: 86_400 },
  ])
  if (!perEmail.allowed) {
    return json(
      { error: `Too many requests have been submitted with this email address today. ${FALLBACK}` },
      429,
      { 'Retry-After': String(perEmail.retryAfterSeconds) },
    )
  }

  try {
    const result = await submitRfq(input, {
      payload,
      storage: getPrivateStorage(),
      scanner: getScanner(),
      mailer: new PayloadMailer(payload),
      ipHash,
      userAgent: request.headers.get('user-agent') ?? '',
      defer: (task) =>
        after(async () => {
          try {
            await task()
          } catch (error) {
            console.error('[rfq] post-submit task failed', String(error))
          }
        }),
    })
    return json({ reference: result.reference, duplicate: result.duplicate }, result.duplicate ? 200 : 201)
  } catch (error) {
    if (error instanceof RfqError) {
      return json({ error: error.message, fields: error.fields }, error.status)
    }
    console.error('[rfq] submit failed', String(error))
    return json({ error: `We could not save your request. ${FALLBACK}` }, 503)
  }
}
