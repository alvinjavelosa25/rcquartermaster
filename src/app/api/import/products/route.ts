import { json, requireStaff } from '@/lib/http'
import { importProductsCsv, productTemplateCsv } from '@/lib/csv/import-export'
import { MAX_ADMIN_IMPORT_ROWS } from '@/lib/csv/products'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_FILE_BYTES = 5 * 1024 * 1024

export async function GET(request: Request) {
  const { user, ok } = await requireStaff(request, 'catalogue')
  if (!user) return json({ error: 'Authentication required' }, 401)
  if (!ok) return json({ error: 'Forbidden' }, 403)
  return new Response(productTemplateCsv(), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="products-import-template.csv"',
      'Cache-Control': 'no-store',
    },
  })
}

export async function POST(request: Request) {
  const { payload, user, ok } = await requireStaff(request, 'catalogue')
  if (!user) return json({ error: 'Authentication required' }, 401)
  if (!ok) return json({ error: 'Forbidden' }, 403)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json({ error: 'Invalid upload.' }, 400)
  }
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return json({ error: 'Choose a CSV file.' }, 400)
  if (file.size > MAX_FILE_BYTES) return json({ error: 'The file is larger than 5 MB.' }, 413)
  if (!/\.csv$/i.test(file.name)) return json({ error: 'Only .csv files are accepted.' }, 400)

  const dryRun = form.get('dryRun') === 'true'
  const publish = form.get('publish') === 'true'
  const report = await importProductsCsv(payload, await file.text(), {
    dryRun,
    publish,
    maxRows: MAX_ADMIN_IMPORT_ROWS,
  })
  console.info('[import] products', { by: user.id, dryRun, total: report.total, failed: report.failed })
  return json(report)
}
