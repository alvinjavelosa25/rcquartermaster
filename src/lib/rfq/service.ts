import { createHash, randomUUID } from 'node:crypto'
import { commitTransaction, createLocalReq, initTransaction, killTransaction } from 'payload'
import type { Payload } from 'payload'
import { getEnv, siteUrl } from '@/env'
import { COLLECTIONS } from '@/lib/constants'
import { getPrivateSettings } from '@/lib/data/settings'
import type { Mailer } from '@/lib/mail/mailer'
import {
  renderBuyerEmail,
  renderSalesEmail,
  resolveRecipients,
  type RfqEmailData,
} from '@/lib/mail/templates'
import type { AttachmentScanner } from '@/lib/security/scanner'
import type { PrivateStorage } from '@/lib/storage/types'
import { normalizeSku } from '@/lib/slug'
import {
  ALLOWED_ATTACHMENTS,
  MAGIC_SAMPLE_BYTES,
  extensionOf,
  sanitizeFilename,
  validateBatch,
  validateDeclaredFile,
  verifyMagic,
  type AttachmentLimits,
} from './attachments'
import { generateReference } from './reference'
import type { RfqSubmission } from './schema'

/** A validation failure the API turns into a 400 with per-field messages. */
export class RfqError extends Error {
  constructor(
    message: string,
    readonly fields: Record<string, string> = {},
    readonly status = 400,
  ) {
    super(message)
  }
}

export function getAttachmentLimits(): AttachmentLimits {
  const env = getEnv()
  return {
    maxFiles: env.RFQ_MAX_FILES,
    maxFileBytes: env.RFQ_MAX_FILE_MB * 1024 * 1024,
    maxTotalBytes: env.RFQ_MAX_TOTAL_MB * 1024 * 1024,
  }
}

export interface SubmitContext {
  payload: Payload
  storage: PrivateStorage
  scanner: AttachmentScanner
  mailer: Mailer
  ipHash: string
  userAgent: string
  /** Run work after the response has been sent (Next.js `after`). Tests can run it inline. */
  defer: (task: () => Promise<void>) => void
}

export interface SubmitResult {
  reference: string
  duplicate: boolean
}

interface VerifiedAttachment {
  key: string
  finalKey: string
  originalName: string
  ext: string
  size: number
  declaredMime: string
  kind: string
  sha256: string
}

export async function submitRfq(input: RfqSubmission, ctx: SubmitContext): Promise<SubmitResult> {
  const { payload } = ctx

  // 1. Idempotency: a retried or double-submitted request returns the original reference.
  const existing = await payload.find({
    collection: COLLECTIONS.rfqs,
    where: { idempotencyKey: { equals: input.idempotencyKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs[0]) return { reference: existing.docs[0].reference, duplicate: true }

  // 2. Resolve catalogue lines against published products (snapshot SKU and name).
  const skus = [...new Set(input.items.map((i) => normalizeSku(i.sku ?? '')).filter(Boolean))]
  const products = skus.length
    ? await payload.find({
        collection: COLLECTIONS.products,
        where: { and: [{ sku: { in: skus } }, { _status: { equals: 'published' } }] },
        limit: skus.length,
        depth: 0,
        draft: false,
        overrideAccess: true,
        select: { sku: true, name: true, unitOfMeasure: true },
      })
    : { docs: [] }
  const bySku = new Map(products.docs.map((p) => [p.sku, p]))
  const items = input.items.map((i) => {
    const sku = normalizeSku(i.sku ?? '')
    const product = sku ? bySku.get(sku) : undefined
    return {
      sku: sku || null,
      name: product?.name ?? i.name,
      quantity: i.quantity,
      unitOfMeasure: i.unitOfMeasure || product?.unitOfMeasure || null,
      product: product?.id ?? null,
    }
  })

  // 3. Verify attachments in quarantine (existence, size, magic bytes).
  const attachments = await verifyAttachments(input.attachments, ctx.storage)

  // 4. Settings (retention).
  const settings = await getPrivateSettings(payload)
  const retentionDays = settings.retentionDays ?? 730
  const now = new Date()
  const retentionExpiresAt = new Date(now.getTime() + retentionDays * 86_400_000).toISOString()

  // 5. Persist atomically.
  const req = await createLocalReq({}, payload)
  const shouldCommit = await initTransaction(req)
  let rfqId: number
  let reference = ''
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      reference = generateReference(now)
      const clash = await payload.count({
        collection: COLLECTIONS.rfqs,
        where: { reference: { equals: reference } },
        overrideAccess: true,
        req,
      })
      if (clash.totalDocs === 0) break
      if (attempt === 4) throw new Error('Could not allocate a unique RFQ reference')
    }
    const created = await payload.create({
      collection: COLLECTIONS.rfqs,
      overrideAccess: true,
      req,
      data: {
        reference,
        status: 'new',
        buyerName: input.buyerName,
        organisation: input.organisation,
        facility: input.facility || undefined,
        buyerRole: input.buyerRole || undefined,
        email: input.email,
        phone: input.phone,
        neededBy: input.neededBy ? `${input.neededBy}T12:00:00.000Z` : undefined,
        solicitationNumber: input.solicitationNumber || undefined,
        deliveryDetails: input.deliveryDetails || undefined,
        specialInstructions: input.specialInstructions || undefined,
        generalDescription: input.generalDescription || undefined,
        items,
        privacyAcknowledgedAt: now.toISOString(),
        retentionExpiresAt,
        idempotencyKey: input.idempotencyKey,
        notifications: { salesEmailStatus: 'pending', buyerEmailStatus: 'pending', attempts: 0 },
        clientMeta: { ipHash: ctx.ipHash, userAgent: ctx.userAgent.slice(0, 300), turnstileVerified: true },
      },
    })
    rfqId = created.id
    for (const a of attachments) {
      await payload.create({
        collection: COLLECTIONS.rfqAttachments,
        overrideAccess: true,
        req,
        data: {
          rfq: rfqId,
          originalName: a.originalName,
          storageKey: a.finalKey,
          declaredMime: a.declaredMime,
          detectedKind: a.kind,
          sizeBytes: a.size,
          sha256: a.sha256,
          scanStatus: 'pending',
        },
      })
    }
    if (shouldCommit) await commitTransaction(req)
  } catch (error) {
    if (shouldCommit) await killTransaction(req)
    throw error
  }

  // 6. Promote files from quarantine to the final private location.
  for (const a of attachments) {
    try {
      await ctx.storage.move(a.key, a.finalKey)
    } catch (error) {
      console.error('[rfq] attachment promotion failed', { reference, error: String(error) })
      await markAttachment(payload, a.finalKey, 'error', 'File could not be moved to permanent storage')
    }
  }

  // 7. Scan and notify after the response is sent.
  ctx.defer(async () => {
    await scanAttachments(payload, ctx.storage, ctx.scanner, rfqId)
    await deliverNotifications(payload, ctx.mailer, rfqId)
  })

  return { reference, duplicate: false }
}

async function verifyAttachments(
  refs: RfqSubmission['attachments'],
  storage: PrivateStorage,
): Promise<VerifiedAttachment[]> {
  if (refs.length === 0) return []
  const limits = getAttachmentLimits()
  if (new Set(refs.map((r) => r.key)).size !== refs.length) {
    throw new RfqError('Attachments contain duplicates.', { attachments: 'The same file was attached twice.' })
  }
  const verified: VerifiedAttachment[] = []
  const sizes: number[] = []
  const year = new Date().getUTCFullYear()
  for (const ref of refs) {
    const name = sanitizeFilename(ref.name)
    const info = await storage.head(ref.key)
    if (!info) {
      throw new RfqError(`${name}: the upload was not found. Please attach it again.`, {
        attachments: `${name}: the upload was not found. Please attach it again.`,
      })
    }
    const declared = validateDeclaredFile({ filename: name, size: info.size, contentType: ref.contentType }, limits)
    if (!declared.ok) throw new RfqError(declared.error, { attachments: declared.error })
    const ext = extensionOf(name)
    const sample = await storage.readRange(ref.key, 0, Math.min(info.size, MAGIC_SAMPLE_BYTES) - 1)
    const magic = verifyMagic(ext, sample)
    if (!magic.ok) {
      await storage.delete(ref.key).catch(() => undefined)
      throw new RfqError(`${name}: ${magic.error}`, { attachments: `${name}: ${magic.error}` })
    }
    const bytes = await storage.read(ref.key)
    sizes.push(info.size)
    verified.push({
      key: ref.key,
      finalKey: `rfq/${year}/${randomUUID()}`,
      originalName: name,
      ext,
      size: info.size,
      declaredMime: ref.contentType || ALLOWED_ATTACHMENTS[ext]?.uploadType || '',
      kind: magic.kind,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    })
  }
  const batchError = validateBatch(sizes, limits)
  if (batchError) throw new RfqError(batchError, { attachments: batchError })
  return verified
}

async function markAttachment(payload: Payload, storageKey: string, status: 'clean' | 'infected' | 'error' | 'skipped', detail?: string) {
  const found = await payload.find({
    collection: COLLECTIONS.rfqAttachments,
    where: { storageKey: { equals: storageKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = found.docs[0]
  if (!doc) return
  await payload.update({
    collection: COLLECTIONS.rfqAttachments,
    id: doc.id,
    data: { scanStatus: status, scannedAt: new Date().toISOString(), scanDetail: detail },
    overrideAccess: true,
  })
}

/** Run the scanner hook over every pending attachment of an RFQ. */
export async function scanAttachments(
  payload: Payload,
  storage: PrivateStorage,
  scanner: AttachmentScanner,
  rfqId: number,
): Promise<void> {
  const pending = await payload.find({
    collection: COLLECTIONS.rfqAttachments,
    where: { and: [{ rfq: { equals: rfqId } }, { scanStatus: { equals: 'pending' } }] },
    limit: 20,
    depth: 0,
    overrideAccess: true,
  })
  for (const att of pending.docs) {
    let result
    try {
      result = await scanner.scan({ key: att.storageKey, storage, originalName: att.originalName })
    } catch (error) {
      result = { status: 'error' as const, detail: `Scanner failed: ${String(error).slice(0, 200)}` }
    }
    await payload.update({
      collection: COLLECTIONS.rfqAttachments,
      id: att.id,
      data: { scanStatus: result.status, scannedAt: new Date().toISOString(), scanDetail: result.detail },
      overrideAccess: true,
    })
  }
}

/** Send (or retry) the sales and buyer emails for an RFQ and record the outcome. Idempotent per recipient. */
export async function deliverNotifications(payload: Payload, mailer: Mailer, rfqId: number): Promise<void> {
  const rfq = await payload.findByID({ collection: COLLECTIONS.rfqs, id: rfqId, depth: 0, overrideAccess: true })
  const n = rfq.notifications ?? {}
  if (n.salesEmailStatus === 'sent' && n.buyerEmailStatus === 'sent') return

  const settings = await getPrivateSettings(payload)
  const attachments = await payload.find({
    collection: COLLECTIONS.rfqAttachments,
    where: { rfq: { equals: rfqId } },
    limit: 20,
    depth: 0,
    overrideAccess: true,
  })
  const data: RfqEmailData = {
    reference: rfq.reference,
    buyerName: rfq.buyerName,
    organisation: rfq.organisation,
    facility: rfq.facility,
    buyerRole: rfq.buyerRole,
    email: rfq.email,
    phone: rfq.phone,
    neededBy: rfq.neededBy ? rfq.neededBy.slice(0, 10) : null,
    solicitationNumber: rfq.solicitationNumber,
    deliveryDetails: rfq.deliveryDetails,
    specialInstructions: rfq.specialInstructions,
    generalDescription: rfq.generalDescription,
    items: (rfq.items ?? []).map((i) => ({ sku: i.sku, name: i.name, quantity: i.quantity, unitOfMeasure: i.unitOfMeasure })),
    attachments: attachments.docs.map((a) => ({ name: a.originalName, size: a.sizeBytes ?? 0, status: a.scanStatus })),
    createdAt: rfq.createdAt,
  }

  let salesStatus = n.salesEmailStatus ?? 'pending'
  let buyerStatus = n.buyerEmailStatus ?? 'pending'
  const errors: string[] = []

  if (salesStatus !== 'sent') {
    const to = resolveRecipients(settings.rfqRecipients?.map((r) => r.email), getEnv().RFQ_NOTIFY_TO)
    if (to.length === 0) {
      salesStatus = 'failed'
      errors.push('No valid sales recipients configured')
    } else {
      try {
        await mailer.send({ to, ...renderSalesEmail(data, `${siteUrl()}/admin/collections/rfqs/${rfq.id}`) })
        salesStatus = 'sent'
      } catch (error) {
        salesStatus = 'failed'
        errors.push(`Sales email: ${String(error).slice(0, 150)}`)
      }
    }
  }
  if (buyerStatus !== 'sent') {
    try {
      await mailer.send({
        to: [rfq.email],
        ...renderBuyerEmail(data, {
          companyName: settings.companyName || 'RC Quartermaster',
          phone: settings.phone,
          email: settings.email,
          responseTime: settings.responseTime,
        }),
      })
      buyerStatus = 'sent'
    } catch (error) {
      buyerStatus = 'failed'
      errors.push(`Buyer email: ${String(error).slice(0, 150)}`)
    }
  }

  await payload.update({
    collection: COLLECTIONS.rfqs,
    id: rfqId,
    overrideAccess: true,
    data: {
      notifications: {
        salesEmailStatus: salesStatus,
        buyerEmailStatus: buyerStatus,
        attempts: (n.attempts ?? 0) + 1,
        lastAttemptAt: new Date().toISOString(),
        lastError: errors.join(' | ') || null,
      },
    },
  })
  if (errors.length) console.error('[rfq] notification problems', { reference: rfq.reference, errors })
}
