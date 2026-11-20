import Image from 'next/image'
import Link from 'next/link'
import { ProductCard } from '@/components/ProductCard'
import { buttonClass, inputClass } from '@/components/ui'
import { childrenOf, getCategories, getFeaturedProducts } from '@/lib/data/catalogue'
import { getPublicSettings } from '@/lib/data/settings'

export default async function HomePage() {
  const [settings, categories, featured] = await Promise.all([
    getPublicSettings(),
    getCategories(),
    getFeaturedProducts(),
  ])
  const top = childrenOf(categories, null)

  return (
    <>
      <section
        aria-labelledby="home-heading"
        className="rounded-xl bg-brand-50 px-6 py-10 md:px-10 md:py-14"
      >
        <h1
          id="home-heading"
          className="max-w-3xl text-3xl font-bold leading-tight text-brand-900 md:text-5xl"
        >
          {settings.homeHeadline}
        </h1>
        <p className="mt-4 max-w-2xl text-lg">{settings.homeSubheadline}</p>
        <form
          action="/search"
          method="get"
          role="search"
          aria-label="Find products"
          className="mt-6 flex max-w-2xl flex-wrap gap-3"
        >
          <div className="min-w-0 flex-1">
            <label htmlFor="home-search" className="block font-semibold">
              Search by keyword or SKU
            </label>
            <input
              id="home-search"
              name="q"
              type="search"
              autoComplete="off"
              maxLength={200}
              className={`${inputClass} mt-1`}
            />
          </div>
          <button type="submit" className={`${buttonClass('primary')} self-end`}>
            Search products
          </button>
        </form>
        <p className="mt-4">
          <Link href="/rfq" className={buttonClass('secondary')}>
            Start a request for quote
          </Link>
        </p>
      </section>

      {top.length > 0 && (
        <section aria-labelledby="cats-heading" className="mt-12">
          <h2 id="cats-heading" className="text-2xl font-bold">
            Browse by category
          </h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {top.map((c) => (
              <li key={c.id} className="rounded-lg border border-line bg-white">
                {c.image && (
                  <Image
                    src={c.image.url}
                    alt=""
                    width={640}
                    height={360}
                    className="aspect-video w-full rounded-t-lg object-cover"
                  />
                )}
                <div className="p-4">
                  <h3 className="text-lg font-bold">
                    <Link href={`/categories/${c.path}`}>{c.name}</Link>
                  </h3>
                  {c.description && <p className="mt-1 text-sm">{c.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {featured.length > 0 && (
        <section aria-labelledby="featured-heading" className="mt-12">
          <h2 id="featured-heading" className="text-2xl font-bold">
            Featured products
          </h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((hit) => (
              <li key={hit.productId}>
                <ProductCard hit={hit} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="how-heading" className="mt-12">
        <h2 id="how-heading" className="text-2xl font-bold">
          How requesting a quote works
        </h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-3">
          {[
            [
              'Find products',
              'Search or browse approved products and review specifications and documents.',
            ],
            [
              'Build your request',
              'Add products and quantities, or describe what you need. Attach specifications if you have them.',
            ],
            [
              'Receive your quote',
              settings.responseTime ||
                'Our team reviews your request and replies with a quotation.',
            ],
          ].map(([title, text], i) => (
            <li key={title} className="rounded-lg border border-line bg-white p-5">
              <p className="text-sm font-semibold text-muted">Step {i + 1}</p>
              <h3 className="mt-1 text-lg font-bold">{title}</h3>
              <p className="mt-1">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {(settings.identifiers.length > 0 || settings.certifications.length > 0) && (
        <section aria-labelledby="creds-heading" className="mt-12 rounded-lg bg-surface-alt p-6">
          <h2 id="creds-heading" className="text-xl font-bold">
            Business credentials
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
            {settings.identifiers.map((i) => (
              <li key={i.label}>
                <span className="font-semibold">{i.label}:</span> {i.value}
              </li>
            ))}
            {settings.certifications.map((c) => (
              <li key={c.label}>{c.label}</li>
            ))}
          </ul>
          <p className="mt-3">
            <Link href="/about">Capability statement and company information</Link>
          </p>
        </section>
      )}
    </>
  )
}
