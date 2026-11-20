import Link from 'next/link'
import { RfqNavLink } from '@/components/rfq/RfqNavLink'
import { getPublicSettings } from '@/lib/data/settings'
import { inputClass } from '@/components/ui'

const nav = [
  { href: '/categories', label: 'Products' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
]

export async function SiteHeader() {
  const settings = await getPublicSettings()
  return (
    <header className="bg-brand-900 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4">
        <Link href="/" className="text-xl font-bold text-white no-underline hover:text-white">
          {settings.companyName}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <form action="/search" method="get" role="search" className="flex items-center gap-2">
            <label htmlFor="site-search" className="sr-only">
              Search products by keyword or SKU
            </label>
            <input
              id="site-search"
              name="q"
              type="search"
              placeholder="Search by keyword or SKU"
              autoComplete="off"
              maxLength={200}
              className={`${inputClass} w-56 sm:w-72`}
            />
            <button type="submit" className="target rounded-md bg-white px-4 py-2 font-semibold text-brand-900 hover:bg-brand-100">
              Search
            </button>
          </form>
          <RfqNavLink />
        </div>
        <nav aria-label="Main" className="w-full">
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="target inline-flex items-center font-semibold text-white hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
