import { revalidateTag } from 'next/cache'
import { CATALOGUE_CACHE_TAG } from '@/lib/constants'

/**
 * Invalidate cached catalogue pages and data. Safe to call from hooks that may also run
 * outside a Next.js request (seed and import scripts), where it is a no-op.
 */
export function revalidateCatalogue(): void {
  try {
    revalidateTag(CATALOGUE_CACHE_TAG, { expire: 0 })
  } catch {
    // Not running inside Next.js (CLI scripts, tests).
  }
}
