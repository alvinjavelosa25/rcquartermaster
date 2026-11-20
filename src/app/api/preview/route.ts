import { draftMode } from 'next/headers'
import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Draft preview for authenticated staff. Enables Next.js draft mode and redirects to a site path. */
export async function GET(request: Request) {
  const { user } = await requireStaff(request, 'catalogue')
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  const target = new URL(request.url).searchParams.get('path') ?? '/'
  // Only same-site relative paths are allowed (no open redirect).
  const safe = target.startsWith('/') && !target.startsWith('//') ? target : '/'
  ;(await draftMode()).enable()
  return NextResponse.redirect(new URL(safe, request.url))
}
