import type { Metadata } from 'next'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Listing } from '@/components/Listing'
import { buttonClass, inputClass } from '@/components/ui'
import { childrenOf, getCategories, searchCatalogue } from '@/lib/data/catalogue'
import { buildListingQuery, parseListingParams, toSearchParams, type RawSearchParams } from '@/lib/search/params'
import { SearchTracker } from '@/components/SearchTracker'

type Props = { searchParams: Promise<RawSearchParams> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = parseListingParams(await searchParams)
  return {
    title: q ? `Search results for "${q}"` : 'Search products',
    // Search result pages are not indexed; category pages are the crawlable entry points.
    robots: { index: false, follow: true },
  }
}

export default async function SearchPage({ searchParams }: Props) {
  const parsed = parseListingParams(await searchParams)
  const all = await getCategories()
  const current = parsed.category ? all.find((c) => c.path === parsed.category) : undefined
  const result = await searchCatalogue(toSearchParams(parsed, current?.id))

  // Offer the children of the current category, or the top level, as narrowing links with counts.
  const counts = new Map(result.categoryCounts.map((c) => [c.id, c.count]))
  const candidates = childrenOf(all, current?.id ?? null)
  const narrowLinks = candidates
    .map((c) => ({
      name: c.name,
      href: `/search${buildListingQuery({ q: parsed.q, category: c.path, sort: parsed.sort })}`,
      count: counts.get(c.id) ?? 0,
    }))
    .filter((l) => l.count > 0)

  return (
    <>
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Search' }]} />
      <h1 className="mt-4 text-3xl font-bold">{parsed.q ? `Search results for “${parsed.q}”` : 'Search products'}</h1>
      {current && <p className="mt-1">Within category: {current.name}</p>}
      <form action="/search" method="get" role="search" className="mt-6 flex max-w-2xl flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="search-page-q" className="block font-semibold">
            Keyword or SKU
          </label>
          <input id="search-page-q" name="q" type="search" defaultValue={parsed.q} maxLength={200} autoComplete="off" className={`${inputClass} mt-1`} />
        </div>
        {current && <input type="hidden" name="category" value={current.path} />}
        <button type="submit" className={buttonClass('primary')}>
          Search
        </button>
      </form>
      <div className="mt-8">
        <Listing
          result={result}
          parsed={parsed}
          basePath="/search"
          keep={{ category: current?.path ?? '' }}
          narrowLinks={narrowLinks}
          narrowHeading={current ? 'Subcategories' : 'Narrow by category'}
        />
      </div>
      {parsed.q && parsed.page === 1 && <SearchTracker total={result.total} />}
    </>
  )
}
