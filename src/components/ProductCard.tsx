import Image from 'next/image'
import Link from 'next/link'
import { AddToRfqButton } from '@/components/rfq/AddToRfqButton'
import { AVAILABILITY_LABELS, type Availability } from '@/lib/constants'
import type { SearchHit } from '@/lib/search'

/** Product card used in category listings, search results and the home page. */
export function ProductCard({ hit, headingLevel = 3 }: { hit: SearchHit; headingLevel?: 2 | 3 }) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3'
  const discontinued = hit.availability === 'discontinued'
  return (
    <article
      className="flex h-full flex-col rounded-lg border border-line bg-white"
      data-testid="product-card"
    >
      <div className="aspect-[4/3] overflow-hidden rounded-t-lg bg-surface-alt">
        {hit.image ? (
          <Image
            src={hit.image.url}
            alt={hit.image.alt}
            width={hit.image.width ?? 640}
            height={hit.image.height ?? 480}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center text-muted"
            role="img"
            aria-label="No image available"
          >
            No image
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-sm text-muted">
          SKU <span className="font-mono">{hit.sku}</span>
        </p>
        <Heading className="text-lg font-bold leading-snug">
          <Link href={`/products/${hit.slug}`}>{hit.name}</Link>
        </Heading>
        {hit.summary && <p className="text-sm">{hit.summary}</p>}
        {hit.availability !== 'available' && (
          <p className="text-sm font-semibold text-accent">
            {AVAILABILITY_LABELS[hit.availability as Availability] ?? hit.availability}
          </p>
        )}
        <div className="mt-auto pt-2">
          {discontinued ? (
            <Link href={`/rfq?alt=${encodeURIComponent(hit.sku)}`} className="font-semibold">
              Request an alternative<span className="sr-only"> for {hit.name}</span>
            </Link>
          ) : (
            <AddToRfqButton
              product={{ sku: hit.sku, name: hit.name, slug: hit.slug }}
              variant="secondary"
            />
          )}
        </div>
      </div>
    </article>
  )
}
