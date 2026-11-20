import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { userCanHandleRfqs, userCanManageCatalogue, userIsAdmin, roleOf } from '@/access'
import type { Role } from '@/lib/constants'

export const noStore = { 'Cache-Control': 'no-store' }

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...noStore, ...headers } })
}

/** Constant-time comparison of two secrets. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export function hasBearer(request: Request, secret: string | undefined): boolean {
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') && safeEqual(header.slice(7), secret)
}

type Check = 'admin' | 'catalogue' | 'rfq'

/** Authenticate a staff request from the Payload session cookie and check the role. */
export async function requireStaff(request: Request, check: Check) {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: request.headers })
  const ok =
    check === 'admin'
      ? userIsAdmin(user)
      : check === 'catalogue'
        ? userCanManageCatalogue(user)
        : userCanHandleRfqs(user)
  return { payload, user, role: roleOf(user) as Role | undefined, ok }
}
