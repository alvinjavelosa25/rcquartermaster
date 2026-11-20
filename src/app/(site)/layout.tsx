import type { Metadata, Viewport } from 'next'
import { Analytics } from '@/components/Analytics'
import { JsonLd } from '@/components/JsonLd'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { getPublicSettings } from '@/lib/data/settings'
import { siteUrl } from '@/env'
import './globals.css'

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: 'RC Quartermaster LLC | Facility supplies and request for quote', template: '%s | RC Quartermaster' },
  description:
    'Facility supplies, equipment and services for VA medical centres, federal facilities and healthcare systems. Browse approved products and request a quote.',
  openGraph: { type: 'website', siteName: 'RC Quartermaster LLC', locale: 'en_US' },
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = await getPublicSettings()
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: s.legalName || s.companyName,
    url: siteUrl(),
    description: s.tagline,
    ...(s.phone || s.email
      ? { contactPoint: { '@type': 'ContactPoint', contactType: 'sales', ...(s.phone ? { telephone: s.phone } : {}), ...(s.email ? { email: s.email } : {}) } }
      : {}),
    ...(s.addressLines.length ? { address: { '@type': 'PostalAddress', streetAddress: s.addressLines.join(', ') } } : {}),
  }
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only-focusable absolute left-2 top-2 z-50 rounded-md bg-white px-4 py-3 font-semibold text-brand-900"
        >
          Skip to main content
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-8 outline-none">
          {children}
        </main>
        <SiteFooter />
        <JsonLd data={organization} />
        <Analytics plausibleDomain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN} ga4Id={process.env.NEXT_PUBLIC_GA4_ID} />
      </body>
    </html>
  )
}
