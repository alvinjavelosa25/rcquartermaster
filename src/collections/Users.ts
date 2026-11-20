import { ValidationError } from 'payload'
import type { CollectionConfig } from 'payload'
import { adminOnly, adminOnlyField, selfOrAdmin } from '@/access'
import { ROLES } from '@/lib/constants'

export const MIN_PASSWORD_LENGTH = 12

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'User', plural: 'Users' },
  auth: {
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    tokenExpiration: 8 * 60 * 60,
    cookies: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
    },
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'role'],
    group: 'Administration',
  },
  access: {
    admin: ({ req }) => Boolean(req.user),
    create: adminOnly,
    read: selfOrAdmin,
    update: selfOrAdmin,
    delete: adminOnly,
    unlock: adminOnly,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (typeof data?.password === 'string' && data.password.length < MIN_PASSWORD_LENGTH) {
          throw new ValidationError({
            errors: [{ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, path: 'password' }],
          })
        }
        return data
      },
    ],
    beforeChange: [
      // The very first user created through the admin "create first user" screen becomes Admin.
      async ({ data, operation, req }) => {
        if (operation === 'create') {
          const existing = await req.payload.count({ collection: 'users', overrideAccess: true, req })
          if (existing.totalDocs === 0) data.role = 'admin'
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'sales',
      saveToJWT: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Catalogue Manager', value: 'catalogue_manager' },
        { label: 'Sales / RFQ Viewer', value: 'sales' },
      ].filter((o) => (ROLES as readonly string[]).includes(o.value)),
      access: {
        // Only admins may change roles. New users default to the least-privileged business role.
        create: adminOnlyField,
        update: adminOnlyField,
      },
      admin: { description: 'Controls what this user can see and change. See the admin guide.' },
    },
  ],
}
