'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics'

/** Fires the `search` analytics event once per result view. Sends only the result count, never the query text. */
export function SearchTracker({ total }: { total: number }) {
  useEffect(() => {
    trackEvent('search', { results: total, empty: total === 0 })
  }, [total])
  return null
}
