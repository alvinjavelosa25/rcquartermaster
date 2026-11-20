import type { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { buttonClass } from '@/components/ui'
import { getPublicSettings } from '@/lib/data/settings'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact RC Quartermaster LLC for product, quotation and service enquiries.',
  alternates: { canonical: '/contact' },
}

export default async function ContactPage() {
  const s = await getPublicSettings()
  const hasDetails = s.phone || s.email || s.addressLines.length > 0
  return (
    <>
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: 'Contact' }]} />
      <h1 className="mt-4 text-3xl font-bold">Contact us</h1>
      <p className="mt-3 max-w-3xl text-lg">
        The fastest way to get pricing is a request for quote. For anything else, contact our team directly.
      </p>
      <p className="mt-4">
        <Link href="/rfq" className={buttonClass('primary')}>
          Start a request for quote
        </Link>
      </p>

      <section aria-labelledby="details" className="mt-10">
        <h2 id="details" className="text-2xl font-bold">
          Contact details
        </h2>
        {hasDetails ? (
          <address className="mt-3 space-y-2 not-italic">
            {s.phone && (
              <p>
                <span className="font-semibold">Phone:</span> <a href={`tel:${s.phone.replace(/[^\d+]/g, '')}`}>{s.phone}</a>
              </p>
            )}
            {s.email && (
              <p>
                <span className="font-semibold">Email:</span> <a href={`mailto:${s.email}`}>{s.email}</a>
              </p>
            )}
            {s.addressLines.length > 0 && (
              <p>
                <span className="font-semibold">Address:</span>
                <br />
                {s.addressLines.map((l, i) => (
                  <span key={l}>
                    {l}
                    {i < s.addressLines.length - 1 && <br />}
                  </span>
                ))}
              </p>
            )}
            {s.hours && (
              <p>
                <span className="font-semibold">Hours:</span> {s.hours}
              </p>
            )}
          </address>
        ) : (
          <p className="mt-3">Contact details will be published here soon. In the meantime, please use the request for quote form.</p>
        )}
        {s.responseTime && <p className="mt-4">{s.responseTime}</p>}
      </section>
    </>
  )
}
