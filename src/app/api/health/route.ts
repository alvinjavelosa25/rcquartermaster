import { json } from '@/lib/http'
import { getPayloadClient } from '@/lib/payload'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const payload = await getPayloadClient()
    await payload.count({ collection: 'users', overrideAccess: true })
    return json({ status: 'ok' })
  } catch {
    return json({ status: 'error' }, 503)
  }
}
