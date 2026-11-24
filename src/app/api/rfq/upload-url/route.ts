import { randomUUID } from 'node:crypto'
import { getEnv, siteUrl } from '@/env'
import { json } from '@/lib/http'
import { getPayloadClient } from '@/lib/payload'
import { validateDeclaredFile } from '@/lib/rfq/attachments'
import { fieldErrors, uploadRequestSchema } from '@/lib/rfq/schema'
import { getAttachmentLimits } from '@/lib/rfq/service'
import { checkRateLimits } from '@/lib/security/rate-limit'
import { clientIp, hashIp, isSameOrigin } from '@/lib/security/request'
import { getPrivateStorage } from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Issues a short-lived presigned PUT URL into the quarantine area of the private bucket. */
export async function POST(request: Request) {
  if (!isSameOrigin(request.headers, siteUrl())) return json({ error: 'Forbidden' }, 403)
  if (Number(request.headers.get('content-length') ?? 0) > 5_000)
    return json({ error: 'Invalid request.' }, 413)

  const env = getEnv()
  const payload = await getPayloadClient()
  const ipHash = hashIp(clientIp(request.headers))
  const limited = await checkRateLimits(payload, [
    { key: `upload:ip:${ipHash}`, limit: env.UPLOAD_RATE_LIMIT_PER_HOUR, windowSeconds: 3600 },
  ])
  if (!limited.allowed) {
    return json(
      { error: 'Too many uploads. Please try again later.', retryAfter: limited.retryAfterSeconds },
      429,
      { 'Retry-After': String(limited.retryAfterSeconds) },
    )
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return json({ error: 'Invalid request.' }, 400)
  }
  const parsed = uploadRequestSchema.safeParse(raw)
  if (!parsed.success)
    return json({ error: 'Invalid request.', fields: fieldErrors(parsed.error) }, 400)

  const check = validateDeclaredFile(parsed.data, getAttachmentLimits())
  if (!check.ok) return json({ error: check.error }, 400)

  const key = `quarantine/${randomUUID()}`
  const target = await getPrivateStorage().createUploadTarget(key, {
    contentType: check.uploadType,
    expiresInSeconds: 300,
  })
  return json({ key, target, expiresInSeconds: 300 })
}
