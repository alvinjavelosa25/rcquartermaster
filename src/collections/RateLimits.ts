import type { CollectionConfig } from 'payload'
import { nobody } from '@/access'

/** Fixed-window counters for rate limiting. Written by raw SQL in src/lib/security/rate-limit.ts. */
export const RateLimits: CollectionConfig = {
  slug: 'rate-limits',
  admin: { hidden: true },
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  timestamps: true,
  fields: [
    { name: 'bucket', type: 'text', required: true, unique: true, index: true },
    { name: 'count', type: 'number', required: true, defaultValue: 0 },
  ],
}
