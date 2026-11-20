import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/Breadcrumbs'
import { DocumentLink } from '@/components/DocumentLink'
import { JsonLd } from '@/components/JsonLd'
import { RichTextContent } from '@/components/RichTextContent'
import { AddToRfqButton } from '@/components/rfq/AddToRfqButton'
import { formatBytes } from '@/components/ui'
import { siteUrl } from '@/env'
import {
  AVAILABILITY_LABELS,
  DOCUMENT_TYPE_LABELS,
  type Availability,
  type DocumentType,
} from '@/lib/constants'
import { breadcrumbFor, getCategories, getRelatedProducts } from '@/lib/data/catalogue'
import { lexicalToText } from '@/lib/richtext'
import type { Category, Document, Media, Product } from '@/payload-types'

export function productMetadata(product: Product): Metadata {
  const image =
    product.images?.[0] && typeof product.images[0].image === 'object'
      ? (product.images[0].image as Media)
      : null
  const description =
    product.seoDescription || product.summary || lexicalToText(product.description).slice(0, 160)
  return {
    title: product.seoTitle || `${product.name} (${product.sku})`,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.name,
      description,
      type: 'website',
      ...(image?.filename
        ? { images: [`/api/media/file/${encodeURIComponent(image.filename)}`] }
        : {}),
    },
  }
}

const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

/** Product detail content, shared by the public page and the staff draft preview. */
export async function ProductView({
  product,
  preview = false,
}: {
  product: Product
  preview?: boolean
}) {
  const categories = await getCategories()
  const primary =
    typeof product.category === 'object' && product.category ? (product.category as Category) : null
  const node = primary ? categories.find((c) => c.id === primary.id) : undefined
  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Categories', href: '/categories' },
    ...(node
      ? breadcrumbFor(categories, node).map((c) => ({
          name: c.name,
          href: `/categories/${c.path}`,
        }))
      : []),
    { name: product.name },
  ]

  const images = (product.images ?? [])
    .map((i) => (typeof i.image === 'object' ? (i.image as Media) : null))
    .filter((m): m is Media => Boolean(m?.filename))
  const documents = (product.documents ?? []).filter(
    (d): d is Document =>
      typeof d === 'object' && d !== null && d.status === 'published' && Boolean(d.filename),
  )
  const attributeRows = (product.attributes ?? []).flatMap((a) =>
    typeof a.attribute === 'object' && a.attribute
      ? [{ label: a.attribute.label, value: a.value, unit: a.attribute.unit ?? '' }]
      : [],
  )
  const specRows = [
    ...(product.specifications ?? []).map((s) => ({
      label: s.label,
      value: s.value,
      unit: s.unit ?? '',
    })),
    ...attributeRows,
  ]
  const identityRows = [
    ['SKU', product.sku],
    product.manufacturer ? ['Manufacturer', product.manufacturer] : null,
    product.manufacturerPartNumber
      ? ['Manufacturer part number', product.manufacturerPartNumber]
      : null,
    product.unitOfMeasure ? ['Unit of measure', product.unitOfMeasure] : null,
    product.countryOfOrigin ? ['Country of origin', product.countryOfOrigin] : null,
  ].filter((r): r is string[] => r !== null)

  const related = await getRelatedProducts(
    (product.relatedProducts ?? []).map((r) => (typeof r === 'object' ? r.id : r)),
  )
  const availability = (product.availability ?? 'available') as Availability
  const discontinued = availability === 'discontinued'
  const abs = (url: string) => `${siteUrl()}${url}`

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.sku,
    description: product.summary || lexicalToText(product.description).slice(0, 300),
    ...(images.length
      ? { image: images.map((m) => abs(`/api/media/file/${encodeURIComponent(m.filename!)}`)) }
      : {}),
    ...(product.manufacturer ? { brand: { '@type': 'Brand', name: product.manufacturer } } : {}),
    ...(product.manufacturerPartNumber ? { mpn: product.manufacturerPartNumber } : {}),
    ...(primary ? { category: primary.name } : {}),
    url: abs(`/products/${product.slug}`),
  }

  return (
    <>
      <Breadcrumbs items={crumbs} />
      {preview && (
        <p
          role="note"
          className="mt-4 rounded-md border-2 border-accent bg-accent-bg p-3 font-semibold text-accent"
        >
          Draft preview. This page is visible to signed-in staff only and shows unpublished changes.
        </p>
      )}
      <article className="mt-4">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            {images.length > 0 ? (
              <ul className="grid gap-4">
                {images.map((m, i) => (
                  <li key={m.id}>
                    <Image
                      src={`/api/media/file/${encodeURIComponent(m.filename!)}`}
                      alt={m.alt}
                      width={m.width ?? 1200}
                      height={m.height ?? 900}
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      priority={i === 0}
                      className="h-auto w-full rounded-lg border border-line"
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-surface-alt text-muted">
                No image available
              </div>
            )}
          </div>

          <div>
            <h1 className="text-3xl font-bold leading-tight">{product.name}</h1>
            <p className="mt-2 text-muted">
              SKU <span className="font-mono">{product.sku}</span>
            </p>
            {product.summary && <p className="mt-4 text-lg">{product.summary}</p>}
            {availability !== 'available' && (
              <p className="mt-3 inline-block rounded-md bg-accent-bg px-3 py-1 font-semibold text-accent">
                {AVAILABILITY_LABELS[availability]}
              </p>
            )}
            <div className="mt-6">
              {discontinued ? (
                <p>
                  This product is discontinued.{' '}
                  <Link href={`/rfq?alt=${encodeURIComponent(product.sku)}`}>
                    Ask us for an alternative
                  </Link>
                  .
                </p>
              ) : (
                <AddToRfqButton
                  product={{
                    sku: product.sku,
                    name: product.name,
                    slug: product.slug,
                    unitOfMeasure: product.unitOfMeasure,
                  }}
                />
              )}
              <p className="mt-3 text-sm text-muted">
                Pricing is provided by quotation. Add products to your request and we will reply
                with a quote.
              </p>
            </div>

            <h2 className="mt-8 text-xl font-bold">Product details</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
              {identityRows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-semibold">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {product.description && (
          <section aria-labelledby="desc-heading" className="mt-10">
            <h2 id="desc-heading" className="text-2xl font-bold">
              Description
            </h2>
            <RichTextContent data={product.description} />
          </section>
        )}

        {specRows.length > 0 && (
          <section aria-labelledby="spec-heading" className="mt-10">
            <h2 id="spec-heading" className="text-2xl font-bold">
              Approved specifications
            </h2>
            <div
              className="mt-3 overflow-x-auto"
              role="group"
              aria-label="Scrollable specifications table"
              tabIndex={0}
            >
              <table className="w-full min-w-[20rem] border-collapse text-left">
                <caption className="sr-only">Specifications for {product.name}</caption>
                <tbody>
                  {specRows.map((r, i) => (
                    <tr key={`${r.label}-${i}`} className="border-b border-line">
                      <th scope="row" className="w-1/3 py-2 pr-4 align-top font-semibold">
                        {r.label}
                      </th>
                      <td className="py-2">
                        {r.value}
                        {r.unit ? ` ${r.unit}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {documents.length > 0 && (
          <section aria-labelledby="docs-heading" className="mt-10">
            <h2 id="docs-heading" className="text-2xl font-bold">
              Documents
            </h2>
            <ul className="mt-3 space-y-3">
              {documents.map((d) => (
                <li key={d.id} className="rounded-lg border border-line p-4">
                  <DocumentLink
                    href={`/api/documents/file/${encodeURIComponent(d.filename!)}`}
                    type={d.type}
                  >
                    {d.title}
                    <span className="sr-only">
                      {' '}
                      ({DOCUMENT_TYPE_LABELS[d.type as DocumentType]}, PDF
                      {d.filesize ? `, ${formatBytes(d.filesize)}` : ''})
                    </span>
                  </DocumentLink>
                  <p className="mt-1 text-sm text-muted" aria-hidden="true">
                    {DOCUMENT_TYPE_LABELS[d.type as DocumentType]} · PDF
                    {d.filesize ? ` · ${formatBytes(d.filesize)}` : ''}
                    {d.versionLabel ? ` · ${d.versionLabel}` : ''}
                  </p>
                  <p className="text-sm text-muted">
                    {d.effectiveDate
                      ? `Effective ${dateFmt.format(new Date(d.effectiveDate))}`
                      : ''}
                    {d.effectiveDate && d.expiryDate ? ' · ' : ''}
                    {d.expiryDate ? `Expires ${dateFmt.format(new Date(d.expiryDate))}` : ''}
                  </p>
                  {d.accessibleAlternative && (
                    <p className="text-sm text-muted">
                      An accessible version is available on request.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {related.length > 0 && (
          <section aria-labelledby="related-heading" className="mt-10">
            <h2 id="related-heading" className="text-2xl font-bold">
              Related products
            </h2>
            <ul className="mt-3 space-y-1">
              {related.map((r) => (
                <li key={r.id}>
                  <Link href={`/products/${r.slug}`}>{r.name}</Link>{' '}
                  <span className="text-muted">({r.sku})</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
      <JsonLd data={productJsonLd} />
      <JsonLd
        data={breadcrumbJsonLd(
          crumbs.map((c, i) => (i === crumbs.length - 1 ? { name: c.name } : c)),
          siteUrl(),
        )}
      />
    </>
  )
}
