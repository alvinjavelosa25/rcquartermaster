import Link from 'next/link'
import { getPublicSettings } from '@/lib/data/settings'

export async function SiteFooter() {
  const s = await getPublicSettings()
  return (
    <footer className="mt-16 bg-brand-900 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="text-lg font-bold">{s.companyName}</p>
          <p className="mt-2 max-w-sm text-sm text-slate-100">{s.tagline}</p>
          {s.identifiers.length > 0 && (
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {s.identifiers.map((i) => (
                <div key={i.label} className="contents">
                  <dt className="font-semibold">{i.label}</dt>
                  <dd>{i.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div>
          <h2 className="text-base font-bold">Contact</h2>
          <address className="mt-2 text-sm not-italic">
            {s.phone && (
              <p>
                <a
                  href={`tel:${s.phone.replace(/[^\d+]/g, '')}`}
                  className="inline-block py-1 text-white"
                >
                  {s.phone}
                </a>
              </p>
            )}
            {s.email && (
              <p>
                <a href={`mailto:${s.email}`} className="inline-block py-1 text-white">
                  {s.email}
                </a>
              </p>
            )}
            {s.addressLines.map((l) => (
              <p key={l}>{l}</p>
            ))}
            {s.hours && <p className="mt-2">{s.hours}</p>}
          </address>
          <p className="mt-3 text-sm">
            <Link href="/contact" className="inline-block py-1 text-white">
              Need help with a request?
            </Link>
          </p>
        </div>
        <nav aria-label="Footer">
          <h2 className="text-base font-bold">Site</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <Link href="/categories" className="inline-block py-1 text-white">
                Products
              </Link>
            </li>
            <li>
              <Link href="/rfq" className="inline-block py-1 text-white">
                Request for quote
              </Link>
            </li>
            <li>
              <Link href="/services" className="inline-block py-1 text-white">
                Services
              </Link>
            </li>
            <li>
              <Link href="/about" className="inline-block py-1 text-white">
                About and capabilities
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="inline-block py-1 text-white">
                Privacy policy
              </Link>
            </li>
            <li>
              <Link href="/accessibility" className="inline-block py-1 text-white">
                Accessibility statement
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/30 px-4 py-4 text-center text-sm">
        © {new Date().getFullYear()} {s.legalName || s.companyName}. All rights reserved.
      </div>
    </footer>
  )
}
