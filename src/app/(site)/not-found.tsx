import Link from 'next/link'
import { buttonClass, inputClass } from '@/components/ui'
import { childrenOf, getCategories } from '@/lib/data/catalogue'

export default async function NotFound() {
  const top = childrenOf(await getCategories(), null)
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-3 text-lg">
        The page you asked for does not exist or is no longer available.
      </p>
      <form
        action="/search"
        method="get"
        role="search"
        aria-label="Find products"
        className="mt-6 flex flex-wrap items-end gap-3"
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="nf-search" className="block font-semibold">
            Search products by keyword or SKU
          </label>
          <input
            id="nf-search"
            name="q"
            type="search"
            maxLength={200}
            autoComplete="off"
            className={`${inputClass} mt-1`}
          />
        </div>
        <button type="submit" className={buttonClass('primary')}>
          Search
        </button>
      </form>
      {top.length > 0 && (
        <>
          <h2 className="mt-8 text-xl font-bold">Browse categories</h2>
          <ul className="mt-2 space-y-1">
            {top.map((c) => (
              <li key={c.id}>
                <Link href={`/categories/${c.path}`}>{c.name}</Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-8">
        Cannot find what you need? <Link href="/rfq">Submit a request for quote</Link> or{' '}
        <Link href="/contact">contact us</Link>.
      </p>
    </div>
  )
}
