import { describe, expect, it } from 'vitest'
import { fieldErrors, rfqSubmissionSchema } from '@/lib/rfq/schema'

const valid = {
  buyerName: 'Pat Buyer',
  organisation: 'VA Medical Center',
  email: ' Pat@Example.GOV ',
  phone: '301-555-0100',
  items: [{ sku: 'PPE-GLV-3001', name: 'Nitrile gloves', quantity: 5 }],
  privacyAcknowledged: true as const,
  turnstileToken: 'token',
  idempotencyKey: '2f1c9d0e-8b8a-4a3a-9b1e-0d6a4b3c2f10',
}

const parse = (over: Record<string, unknown> = {}) =>
  rfqSubmissionSchema.safeParse({ ...valid, ...over })

describe('[FR-034][FR-035] RFQ submission schema', () => {
  it('accepts a valid request and normalises the email', () => {
    const r = parse()
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('pat@example.gov')
  })

  it('reports field paths and messages for missing required fields', () => {
    const r = rfqSubmissionSchema.safeParse({
      ...valid,
      buyerName: '',
      organisation: '',
      email: 'nope',
      phone: 'abc',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      const errs = fieldErrors(r.error)
      expect(errs.buyerName).toMatch(/required/)
      expect(errs.organisation).toMatch(/required/)
      expect(errs.email).toMatch(/valid email/)
      expect(errs.phone).toMatch(/valid phone/)
    }
  })

  it('[FR-032] requires a description when there are no items', () => {
    expect(parse({ items: [] }).success).toBe(false)
    expect(
      parse({ items: [], generalDescription: 'Need 200 cases of floor cleaner' }).success,
    ).toBe(true)
    expect(parse({ items: [], generalDescription: 'short' }).success).toBe(false)
  })

  it.each([0, -1, 1.5, 1e9, Number.NaN])('rejects invalid quantity %s', (q) => {
    expect(parse({ items: [{ sku: 'A', name: 'x', quantity: q }] }).success).toBe(false)
  })

  it('rejects past needed-by dates and accepts today and the future', () => {
    expect(parse({ neededBy: '2001-01-01' }).success).toBe(false)
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
    expect(parse({ neededBy: future }).success).toBe(true)
    expect(parse({ neededBy: '' }).success).toBe(true)
    expect(parse({ neededBy: '31/12/2030' }).success).toBe(false)
  })

  it('requires privacy acknowledgement, a Turnstile token and a UUID idempotency key', () => {
    expect(parse({ privacyAcknowledged: false }).success).toBe(false)
    expect(parse({ turnstileToken: '' }).success).toBe(false)
    expect(parse({ idempotencyKey: 'abc' }).success).toBe(false)
  })

  it('limits field lengths and number of lines and attachments', () => {
    expect(parse({ specialInstructions: 'x'.repeat(4001) }).success).toBe(false)
    expect(
      parse({
        items: Array.from({ length: 101 }, (_, i) => ({ sku: `S${i}`, name: 'x', quantity: 1 })),
      }).success,
    ).toBe(false)
    expect(
      parse({
        attachments: Array.from({ length: 11 }, () => ({
          key: 'quarantine/2f1c9d0e-8b8a-4a3a-9b1e-0d6a4b3c2f10',
          name: 'a.pdf',
          size: 10,
          contentType: 'application/pdf',
        })),
      }).success,
    ).toBe(false)
  })

  it('only accepts quarantine keys as attachment references', () => {
    const att = (key: string) =>
      parse({ attachments: [{ key, name: 'a.pdf', size: 10, contentType: 'application/pdf' }] })
        .success
    expect(att('quarantine/2f1c9d0e-8b8a-4a3a-9b1e-0d6a4b3c2f10')).toBe(true)
    expect(att('rfq/2026/2f1c9d0e-8b8a-4a3a-9b1e-0d6a4b3c2f10')).toBe(false)
    expect(att('../etc/passwd')).toBe(false)
  })

  it('keeps the honeypot value so the route can silently drop bot submissions', () => {
    const r = parse({ website: 'http://spam.example' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.website).toBe('http://spam.example')
  })
})
