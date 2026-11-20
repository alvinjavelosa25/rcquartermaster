import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Breadcrumbs, breadcrumbJsonLd } from '@/components/Breadcrumbs'
import { JsonLd } from '@/components/JsonLd'
import { Listing } from '@/components/Listing'
import { breadcrumbFor, childrenOf, getCategories, getCategoryListing, searchCatalogue } from '@/lib/data/catalogue'
import { buildListingQuery, parseListingParams, toSearchParams, type RawSearchParams } from '@/lib/search/params'
import { siteUrl } from '@/env'

type Props = {
  params: Promise<{ path: string[] }>
  searchParams: Promise<RawSearchParams>
}

export const dynamicParams = true
export async function generateStaticParams() {
  return []
}

async function resolve(path: string[]) {
  const all = await getCategories()
  const joined = path.map((p) => decodeURIComponent(p)).join('/')
  const node = all.find((c) => c.path === joined)
  return { all, node }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { path } = await params
  const { node } = await resolve(path)
  if (!node) return {}
  const parsed = parseListingParams(await searchParams)
  const filtered = parsed.page > 1 || Object.keys(parsed.attributes).length > 0 || parsed.sort
  return {
    title: node.seoTitle || node.name,
    description: node.seoDescription || node.description || `Browse ${node.name} products.`,
    alternates: { canonical: `/categories/${node.path}` },
    robots: filtered ? { index: false, follow: true } : undefined,
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { path } = await params
  const { all, node } = await resolve(path)
  if (!node) notFound()

  const parsed = parseListingParams(await searchParams)
  const simple = !parsed.q && !parsed.sort && Object.keys(parsed.attributes).length === 0
  const result = simple
    ? await getCategoryListing(node.id, parsed.page)
    : await searchCatalogue(toSearchParams(parsed, node.id))

  const subs = childrenOf(all, node.id)
  const counts = new Map(result.categoryCounts.map((c) => [c.id, c.count]))
  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Categories', href: '/categories' },
    ...breadcrumbFor(all, node).map((c) => ({ name: c.name, href: c.id === node.id ? undefined : `/categories/${c.path}` })),
  ]
  const base = `/categories/${node.path}`

  return (
    <>
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-4 text-3xl font-bold">{node.name}</h1>
      {node.description && <p className="mt-2 max-w-3xl text-lg">{node.description}</p>}
      <div className="mt-8">
        <Listing
          result={result}
          parsed={parsed}
          basePath={base}
          narrowHeading="Subcategories"
          narrowLinks={subs
            .map((s) => ({ name: s.name, href: `/categories/${s.path}${buildListingQuery({ q: parsed.q })}`, count: counts.get(s.id) ?? 0 }))
            .filter((l) => l.count > 0)}
        />
      </div>
      <JsonLd data={breadcrumbJsonLd(crumbs, siteUrl())} />
    </>
  )
}
