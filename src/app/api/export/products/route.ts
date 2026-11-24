import { json, requireStaff } from '@/lib/http'
import { exportProductsCsv } from '@/lib/csv/import-export'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: Request) {
  const { payload, user, ok } = await requireStaff(request, 'catalogue')
  if (!user) return json({ error: 'Authentication required' }, 401)
  if (!ok) return json({ error: 'Forbidden' }, 403)
  const csv = await exportProductsCsv(payload)
  const stamp = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="products-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
