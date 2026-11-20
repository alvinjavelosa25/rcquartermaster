import { stringify } from 'csv-stringify/sync'
import type { Where } from 'payload'
import { json, requireStaff } from '@/lib/http'
import { COLLECTIONS, RFQ_STATUSES } from '@/lib/constants'
import { sanitizeCsvCell } from '@/lib/csv/products'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_ROWS = 10_000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: Request) {
  const { payload, user, ok } = await requireStaff(request, 'rfq')
  if (!user) return json({ error: 'Authentication required' }, 401)
  if (!ok) return json({ error: 'Forbidden' }, 403)

  const sp = new URL(request.url).searchParams
  const and: Where[] = []
  const status = sp.get('status')
  if (status) {
    if (!(RFQ_STATUSES as readonly string[]).includes(status)) return json({ error: 'Invalid status' }, 400)
    and.push({ status: { equals: status } })
  }
  const from = sp.get('from')
  const to = sp.get('to')
  if (from) {
    if (!DATE_RE.test(from)) return json({ error: 'Invalid from date' }, 400)
    and.push({ createdAt: { greater_than_equal: `${from}T00:00:00.000Z` } })
  }
  if (to) {
    if (!DATE_RE.test(to)) return json({ error: 'Invalid to date' }, 400)
    and.push({ createdAt: { less_than_equal: `${to}T23:59:59.999Z` } })
  }
  const q = sp.get('q')?.trim().slice(0, 100)
  if (q) {
    and.push({
      or: ['reference', 'buyerName', 'organisation', 'email', 'itemSkus'].map((field) => ({
        [field]: { contains: q },
      })),
    })
  }

  const headers = [
    'reference', 'status', 'submitted_at', 'buyer_name', 'organisation', 'facility', 'role', 'email', 'phone',
    'needed_by', 'solicitation_number', 'delivery_details', 'special_instructions', 'general_description',
    'items', 'sales_email_status', 'buyer_email_status',
  ]
  const lines: string[][] = [headers]
  let page = 1
  let count = 0
  for (;;) {
    const res = await payload.find({
      collection: COLLECTIONS.rfqs,
      where: and.length ? { and } : undefined,
      sort: '-createdAt',
      limit: 200,
      page,
      depth: 0,
      overrideAccess: true,
    })
    for (const r of res.docs) {
      if (count++ >= MAX_ROWS) break
      lines.push(
        [
          r.reference, r.status, r.createdAt, r.buyerName, r.organisation, r.facility, r.buyerRole, r.email, r.phone,
          r.neededBy?.slice(0, 10), r.solicitationNumber, r.deliveryDetails, r.specialInstructions, r.generalDescription,
          (r.items ?? []).map((i) => `${i.sku || 'free text'} x ${i.quantity}${i.unitOfMeasure ? ` ${i.unitOfMeasure}` : ''} (${i.name})`).join(' | '),
          r.notifications?.salesEmailStatus, r.notifications?.buyerEmailStatus,
        ].map(sanitizeCsvCell),
      )
    }
    if (!res.hasNextPage || count >= MAX_ROWS) break
    page += 1
  }
  console.info('[export] rfqs', { by: user.id, rows: lines.length - 1 })
  return new Response(`\uFEFF${stringify(lines)}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rfqs-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
