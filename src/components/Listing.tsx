import Link from 'next/link'
import { Pagination } from '@/components/Pagination'
import { ProductCard } from '@/components/ProductCard'
import { buttonClass, inputClass } from '@/components/ui'
import { buildListingQuery, type ParsedListing } from '@/lib/search/params'
import type { SearchResult } from '@/lib/search'

export interface NarrowLink {
  name: string
  href: string
  count: number
}

interface Props {
  result: SearchResult
  parsed: ParsedListing
  /** Path the filter form submits to, for example `/search` or `/categories/gloves`. */
  basePath: string
  /** Extra values to keep in the URL when filtering (for example the category on the search page). */
  keep?: Partial<ParsedListing>
  narrowLinks?: NarrowLink[]
  narrowHeading?: string
}

/** Filters + results grid shared by category and search pages. Works without JavaScript. */
export function Listing({ result, parsed, basePath, keep = {}, narrowLinks = [], narrowHeading = 'Narrow by category' }: Props) {
  const base = { q: parsed.q, category: keep.category ?? '', sort: parsed.sort, attributes: parsed.attributes }
  const hrefFor = (page: number) => `${basePath}${buildListingQuery({ ...base, page })}`
  const hasFilters = Object.keys(parsed.attributes).length > 0
  const sortValue = parsed.sort ?? (parsed.q ? 'relevance' : 'name')

  return (
    <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
      <aside aria-label="Filters" className="space-y-6">
        {narrowLinks.length > 0 && (
          <nav aria-label={narrowHeading}>
            <h2 className="text-base font-bold">{narrowHeading}</h2>
            <ul className="mt-2 space-y-1">
              {narrowLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.name}</Link> <span className="text-muted">({l.count})</span>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <form action={basePath} method="get" className="space-y-5">
          {parsed.q && <input type="hidden" name="q" value={parsed.q} />}
          {keep.category && <input type="hidden" name="category" value={keep.category} />}
          <div>
            <label htmlFor="sort" className="block text-base font-bold">
              Sort by
            </label>
            <select id="sort" name="sort" defaultValue={sortValue} className={`${inputClass} mt-1`}>
              {parsed.q && <option value="relevance">Relevance</option>}
              <option value="name">Name</option>
              <option value="sku">SKU</option>
            </select>
          </div>
          {result.attributeFacets.map((facet) => (
            <fieldset key={facet.key}>
              <legend className="text-base font-bold">
                {facet.label}
                {facet.unit ? ` (${facet.unit})` : ''}
              </legend>
              <ul className="mt-2 space-y-1">
                {facet.values.map((v) => {
                  const id = `attr-${facet.key}-${v.value}`.replace(/[^a-zA-Z0-9_-]/g, '_')
                  return (
                    <li key={v.value} className="flex items-center gap-2">
                      <input id={id} type="checkbox" name={`attr.${facet.key}`} value={v.value} defaultChecked={v.selected} className="h-5 w-5" />
                      <label htmlFor={id}>
                        {v.label} <span className="text-muted">({v.count})</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </fieldset>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={buttonClass('primary')}>
              Apply filters
            </button>
            {hasFilters && (
              <Link href={`${basePath}${buildListingQuery({ q: parsed.q, category: keep.category })}`} className="font-semibold">
                Clear all filters
              </Link>
            )}
          </div>
        </form>
      </aside>

      <section aria-label="Results">
        <p role="status" aria-live="polite" className="mb-4 text-muted" data-testid="result-count">
          {result.total === 0 ? 'No products found.' : `${result.total} ${result.total === 1 ? 'product' : 'products'} found.`}
          {result.totalPages > 1 && ` Page ${result.page} of ${result.totalPages}.`}
        </p>

        {result.hits.length > 0 ? (
          <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {result.hits.map((hit) => (
              <li key={hit.productId}>
                <ProductCard hit={hit} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-line bg-surface-alt p-6">
            <h2 className="text-lg font-bold">Nothing matched</h2>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              {hasFilters && <li>Remove some filters to widen the results.</li>}
              <li>Check the spelling, or try a shorter keyword or part of the SKU.</li>
              <li>
                <Link href="/categories">Browse all product categories</Link>.
              </li>
              <li>
                Cannot find it? <Link href="/rfq">Submit a general request for quote</Link> and we will source it.
              </li>
            </ul>
          </div>
        )}

        <Pagination page={result.page} totalPages={result.totalPages} hrefFor={hrefFor} />
      </section>
    </div>
  )
}
