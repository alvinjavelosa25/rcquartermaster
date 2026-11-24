import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { RichTextContent } from '@/components/RichTextContent'
import { buttonClass } from '@/components/ui'
import { getPageBySlug } from '@/lib/data/catalogue'
import { getPublicSettings } from '@/lib/data/settings'

export async function contentMetadata(slug: string): Promise<Metadata> {
  const page = await getPageBySlug(slug)
  if (!page) return {}
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || page.intro || undefined,
    alternates: { canonical: `/${slug}` },
  }
}

/** CMS-driven content page (About, Services, Privacy, Accessibility). */
export async function ContentPage({
  slug,
  showCredentials = false,
  showRfqCta = false,
}: {
  slug: string
  showCredentials?: boolean
  showRfqCta?: boolean
}) {
  const page = await getPageBySlug(slug)
  if (!page) notFound()
  const settings = showCredentials ? await getPublicSettings() : null

  return (
    <>
      <Breadcrumbs items={[{ name: 'Home', href: '/' }, { name: page.title }]} />
      <h1 className="mt-4 text-3xl font-bold">{page.title}</h1>
      {page.intro && <p className="mt-3 max-w-3xl text-lg">{page.intro}</p>}
      <div className="mt-6">
        <RichTextContent data={page.content} />
      </div>

      {settings &&
        (settings.identifiers.length > 0 ||
          settings.certifications.length > 0 ||
          settings.capabilityStatementUrl) && (
          <section aria-labelledby="creds" className="mt-10 rounded-lg bg-surface-alt p-6">
            <h2 id="creds" className="text-2xl font-bold">
              Company information
            </h2>
            {settings.identifiers.length > 0 && (
              <dl className="mt-4 grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-2">
                {settings.identifiers.map((i) => (
                  <div key={i.label} className="contents">
                    <dt className="font-semibold">{i.label}</dt>
                    <dd>{i.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {settings.certifications.length > 0 && (
              <>
                <h3 className="mt-6 text-lg font-bold">Certifications and designations</h3>
                <ul className="mt-2 space-y-2">
                  {settings.certifications.map((c) => (
                    <li key={c.label}>
                      <span className="font-semibold">{c.label}</span>
                      {c.description ? `: ${c.description}` : ''}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {settings.capabilityStatementUrl && (
              <p className="mt-6">
                <a href={settings.capabilityStatementUrl} className={buttonClass('secondary')}>
                  Download capability statement (PDF)
                </a>
              </p>
            )}
          </section>
        )}

      {showRfqCta && (
        <p className="mt-10">
          <Link href="/rfq" className={buttonClass('primary')}>
            Request a quote
          </Link>
        </p>
      )}
    </>
  )
}
