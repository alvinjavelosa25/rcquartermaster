import type { Payload } from 'payload'
import { COLLECTIONS } from '@/lib/constants'
import type { Mailer } from '@/lib/mail/mailer'
import { purgeRateLimits } from '@/lib/security/rate-limit'
import type { AttachmentScanner } from '@/lib/security/scanner'
import type { PrivateStorage } from '@/lib/storage/types'
import { deliverNotifications, scanAttachments } from '@/lib/rfq/service'

const MAX_ATTEMPTS = 5

/** Retry failed or stuck notifications and attachments scans. Runs every few minutes. */
export async function runEmailRetry(
  payload: Payload,
  deps: { mailer: Mailer; storage: PrivateStorage; scanner: AttachmentScanner },
  now = Date.now(),
): Promise<{ retried: number }> {
  const res = await payload.find({
    collection: COLLECTIONS.rfqs,
    where: {
      and: [
        {
          or: [
            { 'notifications.salesEmailStatus': { not_equals: 'sent' } },
            { 'notifications.buyerEmailStatus': { not_equals: 'sent' } },
          ],
        },
        { 'notifications.attempts': { less_than: MAX_ATTEMPTS } },
        { createdAt: { less_than: new Date(now - 2 * 60_000).toISOString() } },
      ],
    },
    limit: 50,
    depth: 0,
    overrideAccess: true,
    select: { notifications: true },
  })
  let retried = 0
  for (const rfq of res.docs) {
    const last = rfq.notifications?.lastAttemptAt ? Date.parse(rfq.notifications.lastAttemptAt) : 0
    if (now - last < 5 * 60_000) continue
    await scanAttachments(payload, deps.storage, deps.scanner, rfq.id)
    await deliverNotifications(payload, deps.mailer, rfq.id)
    retried += 1
  }
  return { retried }
}

/** Delete RFQs (and their attachments) past their retention date. Logs references only, never personal data. */
export async function runRetentionPurge(
  payload: Payload,
  storage: PrivateStorage,
  now = Date.now(),
): Promise<{ rfqsDeleted: number; filesDeleted: number }> {
  const expired = await payload.find({
    collection: COLLECTIONS.rfqs,
    where: { retentionExpiresAt: { less_than: new Date(now).toISOString() } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
    select: { reference: true },
  })
  let filesDeleted = 0
  for (const rfq of expired.docs) {
    const atts = await payload.find({
      collection: COLLECTIONS.rfqAttachments,
      where: { rfq: { equals: rfq.id } },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    for (const a of atts.docs) {
      await storage
        .delete(a.storageKey)
        .catch((e) => console.error('[retention] file delete failed', String(e)))
      await payload.delete({
        collection: COLLECTIONS.rfqAttachments,
        id: a.id,
        overrideAccess: true,
      })
      filesDeleted += 1
    }
    await payload.delete({ collection: COLLECTIONS.rfqs, id: rfq.id, overrideAccess: true })
    console.info('[retention] purged RFQ', { reference: rfq.reference })
  }
  return { rfqsDeleted: expired.docs.length, filesDeleted }
}

/** Remove stale rate-limit counters and abandoned quarantine uploads (older than 24 hours). */
export async function runCleanup(
  payload: Payload,
  storage: PrivateStorage,
  now = Date.now(),
): Promise<{ rateLimitRows: number; quarantineFiles: number }> {
  const rateLimitRows = await purgeRateLimits(payload)
  const quarantineFiles = await storage.deleteOlderThan(
    'quarantine/',
    new Date(now - 24 * 3600_000),
  )
  return { rateLimitRows, quarantineFiles }
}
