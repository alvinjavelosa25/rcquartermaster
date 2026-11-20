'use client'

import Link from 'next/link'
import { useState } from 'react'
import { trackEvent } from '@/lib/analytics'
import { buttonClass } from '@/components/ui'
import { useRfqList } from '@/components/rfq/use-rfq-list'

export interface AddToRfqProduct {
  sku: string
  name: string
  slug: string
  unitOfMeasure?: string | null
}

/** "Add to RFQ" action. Announces the result politely; focus never moves. */
export function AddToRfqButton({ product, variant = 'primary' }: { product: AddToRfqProduct; variant?: 'primary' | 'secondary' }) {
  const { items, actions } = useRfqList()
  const [message, setMessage] = useState('')
  const inList = items.find((i) => i.sku === product.sku)

  function add() {
    const result = actions.add({
      sku: product.sku,
      name: product.name,
      slug: product.slug,
      unitOfMeasure: product.unitOfMeasure ?? '',
    })
    if (result.status === 'full') {
      setMessage('Your RFQ list is full. Submit this request first, then start another.')
      return
    }
    trackEvent('add_to_rfq', { sku: product.sku })
    const line = result.items.find((i) => i.sku === product.sku)
    setMessage(
      result.status === 'added'
        ? `${product.name} added to your RFQ list.`
        : `${product.name} was already listed. Quantity is now ${line?.quantity ?? ''}.`,
    )
  }

  return (
    <div>
      <button type="button" onClick={add} className={buttonClass(variant)}>
        <span aria-hidden="true">+</span> Add to RFQ<span className="sr-only">: {product.name}</span>
      </button>
      <p role="status" aria-live="polite" className="mt-2 text-sm">
        {message}
        {message && (
          <>
            {' '}
            <Link href="/rfq">View RFQ list{items.length ? ` (${items.length})` : ''}</Link>
          </>
        )}
        {!message && inList ? (
          <>
            In your RFQ list (quantity {inList.quantity}). <Link href="/rfq">View RFQ list</Link>
          </>
        ) : null}
      </p>
    </div>
  )
}
