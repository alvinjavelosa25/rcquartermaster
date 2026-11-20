import { NextResponse } from 'next/server'
import { getEnv } from '@/env'
import { json, requireStaff } from '@/lib/http'
import { COLLECTIONS } from '@/lib/constants'
import { canDownload } from '@/lib/security/scanner'
import { getPrivateStorage } from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Authorised download of an RFQ attachment. Only Admin and Sales may download, and only when the
 * scan status allows it. The response is a redirect to a short-lived signed URL.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const { payload, user, ok } = await requireStaff(request, 'rfq')
  if (!user) return json({ error: 'Authentication required' }, 401)
  if (!ok) return json({ error: 'Forbidden' }, 403)

  const numericId = Number(id)
  if (!Number.isInteger(numericId)) return json({ error: 'Not found' }, 404)
  const att = await payload
    .findByID({ collection: COLLECTIONS.rfqAttachments, id: numericId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!att) return json({ error: 'Not found' }, 404)

  if (!canDownload(att.scanStatus, getEnv().ALLOW_UNSCANNED_DOWNLOADS)) {
    return json({ error: `This file cannot be downloaded (scan status: ${att.scanStatus}).` }, 403)
  }

  const url = await getPrivateStorage().createDownloadUrl(att.storageKey, {
    filename: att.originalName,
    expiresInSeconds: 300,
  })
  console.info('[rfq] attachment download', { attachment: att.id, by: user.id })
  return NextResponse.redirect(new URL(url, request.url), { headers: { 'Cache-Control': 'no-store' } })
}
