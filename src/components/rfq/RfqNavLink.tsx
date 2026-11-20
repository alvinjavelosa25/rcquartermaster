'use client'

import Link from 'next/link'
import { useRfqList } from '@/components/rfq/use-rfq-list'

/** Header link with the number of lines in the buyer's RFQ list. */
export function RfqNavLink() {
  const { items } = useRfqList()
  const count = items.length
  return (
    <Link
      href="/rfq"
      className="target inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 font-semibold text-brand-900 no-underline hover:bg-brand-100"
    >
      RFQ list
      {count > 0 && (
        <span className="rounded-full bg-brand-800 px-2 text-sm text-white">
          {count}
          <span className="sr-only"> {count === 1 ? 'item' : 'items'}</span>
        </span>
      )}
    </Link>
  )
}
