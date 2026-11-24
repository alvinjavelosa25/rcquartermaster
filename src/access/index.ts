import type { Access, FieldAccess, PayloadRequest, Where } from 'payload'
import type { Role } from '@/lib/constants'

type UserLike = { id?: number | string; role?: Role | null } | null | undefined

export const roleOf = (user: unknown): Role | undefined => (user as UserLike)?.role ?? undefined

const hasRole =
  (...roles: Role[]) =>
  (user: unknown) => {
    const r = roleOf(user)
    return r !== undefined && roles.includes(r)
  }

export const userIsAdmin = hasRole('admin')
export const userCanManageCatalogue = hasRole('admin', 'catalogue_manager')
export const userCanHandleRfqs = hasRole('admin', 'sales')
export const userIsStaff = hasRole('admin', 'catalogue_manager', 'sales')

export const adminOnly: Access = ({ req }) => userIsAdmin(req.user)
export const catalogueStaff: Access = ({ req }) => userCanManageCatalogue(req.user)
export const rfqStaff: Access = ({ req }) => userCanHandleRfqs(req.user)
export const anyStaff: Access = ({ req }) => userIsStaff(req.user)
export const nobody: Access = () => false
export const everyone: Access = () => true

export const adminOnlyField: FieldAccess = ({ req }) => userIsAdmin(req.user)
export const rfqStaffField: FieldAccess = ({ req }) => userCanHandleRfqs(req.user)
export const nobodyField: FieldAccess = () => false

/**
 * Read access for versioned content: staff see everything (including drafts),
 * the public only ever sees published documents.
 */
export const publishedOrStaff: Access = ({ req }) => {
  if (userIsStaff(req.user)) return true
  return { _status: { equals: 'published' } } satisfies Where
}

/** Same idea for collections using a plain `status` select (documents). */
export const statusPublishedOrStaff: Access = ({ req }) => {
  if (userIsStaff(req.user)) return true
  return { status: { equals: 'published' } } satisfies Where
}

export const selfOrAdmin = ({ req }: { req: PayloadRequest }): boolean | Where => {
  if (userIsAdmin(req.user)) return true
  const id = (req.user as UserLike)?.id
  if (id === undefined || id === null) return false
  return { id: { equals: id } }
}
