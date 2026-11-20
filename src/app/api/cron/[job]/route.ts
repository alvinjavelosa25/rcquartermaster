import { getEnv } from '@/env'
import { hasBearer, json } from '@/lib/http'
import { runCleanup, runEmailRetry, runRetentionPurge } from '@/lib/jobs'
import { PayloadMailer } from '@/lib/mail/mailer'
import { getPayloadClient } from '@/lib/payload'
import { getScanner } from '@/lib/security/scanner'
import { getPrivateStorage } from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Scheduled jobs. Protected by `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends it automatically). */
export async function GET(request: Request, ctx: { params: Promise<{ job: string }> }) {
  if (!hasBearer(request, getEnv().CRON_SECRET)) return json({ error: 'Unauthorized' }, 401)
  const { job } = await ctx.params
  const payload = await getPayloadClient()
  const storage = getPrivateStorage()

  switch (job) {
    case 'email-retry':
      return json(await runEmailRetry(payload, { mailer: new PayloadMailer(payload), storage, scanner: getScanner() }))
    case 'retention':
      return json(await runRetentionPurge(payload, storage))
    case 'cleanup':
      return json(await runCleanup(payload, storage))
    default:
      return json({ error: 'Unknown job' }, 404)
  }
}
