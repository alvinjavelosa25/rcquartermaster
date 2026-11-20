import { z } from 'zod'
import { MAX_QUANTITY, MAX_RFQ_ITEMS } from '@/lib/constants'

/** Hard ceilings for schema validation. Runtime limits (env) are enforced separately and are never higher. */
export const MAX_ATTACHMENTS_CEILING = 10

const trimmed = (max: number) => z.string().trim().max(max)
const required = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`)

export const rfqItemSchema = z.object({
  /** Catalogue SKU. Empty or missing means a free-text line. */
  sku: z.string().trim().max(64).optional().default(''),
  name: required('Item description', 300),
  quantity: z
    .number({ error: 'Quantity must be a whole number' })
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(MAX_QUANTITY, `Quantity must be ${MAX_QUANTITY.toLocaleString('en-US')} or fewer`),
  unitOfMeasure: trimmed(16).optional().default(''),
})

export const rfqAttachmentRefSchema = z.object({
  key: z.string().regex(/^quarantine\/[0-9a-f-]{36}$/i, 'Invalid attachment reference'),
  name: required('File name', 200),
  size: z.number().int().min(1).max(500 * 1024 * 1024),
  contentType: z.string().trim().max(150),
})

const phoneRegex = /^[0-9+().\-\s#xX]{7,30}$/

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date as YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Enter a valid date')

export const rfqSubmissionSchema = z
  .object({
    buyerName: required('Name', 120),
    organisation: required('Organisation', 200),
    facility: trimmed(200).optional().default(''),
    buyerRole: trimmed(120).optional().default(''),
    email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address')),
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, 'Enter a valid phone number, for example 301-555-0100'),
    neededBy: z
      .union([isoDate, z.literal('')])
      .optional()
      .default('')
      .refine((v) => {
        if (!v) return true
        // Allow "today" in any US timezone by comparing against yesterday (UTC).
        const earliest = Date.now() - 24 * 60 * 60 * 1000
        return Date.parse(`${v}T23:59:59Z`) >= earliest
      }, 'Needed-by date cannot be in the past'),
    deliveryDetails: trimmed(2000).optional().default(''),
    specialInstructions: trimmed(4000).optional().default(''),
    solicitationNumber: trimmed(100).optional().default(''),
    generalDescription: trimmed(4000).optional().default(''),
    items: z.array(rfqItemSchema).max(MAX_RFQ_ITEMS, `A request can contain at most ${MAX_RFQ_ITEMS} lines`).default([]),
    attachments: z.array(rfqAttachmentRefSchema).max(MAX_ATTACHMENTS_CEILING).default([]),
    privacyAcknowledged: z.literal(true, { error: 'You must acknowledge the privacy notice' }),
    turnstileToken: z.string().min(1, 'Complete the verification check').max(4096),
    idempotencyKey: z.uuid(),
    /** Honeypot. Humans never see or fill this field. */
    website: z.string().max(0).optional().default(''),
  })
  .superRefine((v, ctx) => {
    if (v.items.length === 0 && v.generalDescription.trim().length < 10) {
      ctx.addIssue({
        code: 'custom',
        path: ['generalDescription'],
        message: 'Describe what you need (at least 10 characters), or add items from the catalogue',
      })
    }
  })

export type RfqSubmissionInput = z.input<typeof rfqSubmissionSchema>
export type RfqSubmission = z.output<typeof rfqSubmissionSchema>
export type RfqItemInput = z.input<typeof rfqItemSchema>

export const uploadRequestSchema = z.object({
  filename: required('File name', 200),
  size: z.number().int().min(1),
  contentType: z.string().trim().max(150).default(''),
})
export type UploadRequest = z.infer<typeof uploadRequestSchema>

/** Flatten zod issues to { "path.to.field": "message" } (first message wins). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form'
    if (!(key in out)) out[key] = issue.message
  }
  return out
}
