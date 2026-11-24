import { unstable_cache } from 'next/cache'
import type { Payload } from 'payload'
import { COLLECTIONS, CATALOGUE_CACHE_TAG } from '@/lib/constants'
import { getPayloadClient, skipDbAtBuild } from '@/lib/payload'
import { getSearchService } from '@/lib/search'
import type { SearchParams, SearchResult } from '@/lib/search'
import type { Category, Page, Product } from '@/payload-types'

const cacheOpts = { tags: [CATALOGUE_CACHE_TAG], revalidate: 3600 }

export interface CategoryNode {
  id: number
  name: string
  slug: string
  path: string
  depth: number
  parentId: number | null
  description: string
  seoTitle: string
  seoDescription: string
  image: { url: string; alt: string } | null
  sortOrder: number
}

const idOf = (v: unknown): number | null =>
  typeof v === 'number'
    ? v
    : v && typeof v === 'object' && 'id' in v
      ? (v as { id: number }).id
      : null

function toNode(c: Category): CategoryNode {
  const img = typeof c.image === 'object' && c.image?.filename ? c.image : null
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    path: c.path ?? c.slug,
    depth: c.depth ?? 1,
    parentId: idOf(c.parent),
    description: c.description ?? '',
    seoTitle: c.seoTitle ?? '',
    seoDescription: c.seoDescription ?? '',
    image: img
      ? { url: `/api/media/file/${encodeURIComponent(img.filename!)}`, alt: img.alt }
      : null,
    sortOrder: c.sortOrder ?? 0,
  }
}

/** All published categories, flat, ordered by path. */
export const getCategories = unstable_cache(
  async (): Promise<CategoryNode[]> => {
    if (skipDbAtBuild()) return []
    const payload = await getPayloadClient()
    const res = await payload.find({
      collection: COLLECTIONS.categories,
      where: { _status: { equals: 'published' } },
      limit: 2000,
      pagination: false,
      depth: 1,
      sort: 'path',
      draft: false,
      overrideAccess: false,
    })
    return res.docs
      .map(toNode)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.path.localeCompare(b.path))
  },
  ['categories'],
  cacheOpts,
)

export const childrenOf = (all: CategoryNode[], parentId: number | null) =>
  all
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))

export function breadcrumbFor(all: CategoryNode[], node: CategoryNode): CategoryNode[] {
  const byId = new Map(all.map((c) => [c.id, c]))
  const chain: CategoryNode[] = []
  let cur: CategoryNode | undefined = node
  while (cur && chain.length < 8) {
    chain.unshift(cur)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return chain
}

export type PublicProduct = Product

async function loadProduct(
  slug: string,
  payload: Payload,
  draft: boolean,
): Promise<Product | null> {
  const res = await payload.find({
    collection: COLLECTIONS.products,
    where: draft
      ? { slug: { equals: slug } }
      : { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] },
    limit: 1,
    depth: 2,
    draft,
    overrideAccess: draft, // draft preview is only reachable after staff authentication (see /api/preview)
  })
  return res.docs[0] ?? null
}

export const getProductBySlug = unstable_cache(
  async (slug: string): Promise<Product | null> => {
    if (skipDbAtBuild()) return null
    return loadProduct(slug, await getPayloadClient(), false)
  },
  ['product'],
  cacheOpts,
)

export async function getProductDraftBySlug(slug: string): Promise<Product | null> {
  return loadProduct(slug, await getPayloadClient(), true)
}

export const getPageBySlug = unstable_cache(
  async (slug: string): Promise<Page | null> => {
    if (skipDbAtBuild()) return null
    const payload = await getPayloadClient()
    const res = await payload.find({
      collection: COLLECTIONS.pages,
      where: { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] },
      limit: 1,
      depth: 1,
      draft: false,
      overrideAccess: false,
    })
    return res.docs[0] ?? null
  },
  ['page'],
  cacheOpts,
)

export const getRelatedProducts = unstable_cache(
  async (ids: number[]): Promise<Product[]> => {
    if (!ids.length || skipDbAtBuild()) return []
    const payload = await getPayloadClient()
    const res = await payload.find({
      collection: COLLECTIONS.products,
      where: { and: [{ id: { in: ids } }, { _status: { equals: 'published' } }] },
      limit: 8,
      depth: 1,
      draft: false,
      overrideAccess: false,
    })
    return res.docs
  },
  ['related-products'],
  cacheOpts,
)

/** Search through the provider-agnostic service. Dynamic: never cached. */
export async function searchCatalogue(params: SearchParams): Promise<SearchResult> {
  if (skipDbAtBuild()) {
    return {
      hits: [],
      total: 0,
      page: 1,
      pageSize: 24,
      totalPages: 1,
      categoryCounts: [],
      attributeFacets: [],
      tookMs: 0,
    }
  }
  return getSearchService(await getPayloadClient()).search(params)
}

/** Cached listing for category pages (first page without filters is the common case). */
export const getCategoryListing = unstable_cache(
  async (categoryId: number, page: number): Promise<SearchResult> =>
    searchCatalogue({ categoryId, page }),
  ['category-listing'],
  cacheOpts,
)

export const getFeaturedProducts = unstable_cache(
  async (): Promise<SearchResult['hits']> =>
    (await searchCatalogue({ pageSize: 6, sort: 'name' })).hits,
  ['featured-products'],
  cacheOpts,
)

export interface SitemapEntry {
  path: string
  lastModified?: string
}

export const getSitemapEntries = unstable_cache(
  async (): Promise<SitemapEntry[]> => {
    if (skipDbAtBuild()) return []
    const payload = await getPayloadClient()
    const [cats, prods, pages] = await Promise.all([
      payload.find({
        collection: COLLECTIONS.categories,
        where: { _status: { equals: 'published' } },
        limit: 5000,
        pagination: false,
        depth: 0,
        draft: false,
        overrideAccess: false,
        select: { path: true, updatedAt: true },
      }),
      payload.find({
        collection: COLLECTIONS.products,
        where: { _status: { equals: 'published' } },
        limit: 50000,
        pagination: false,
        depth: 0,
        draft: false,
        overrideAccess: false,
        select: { slug: true, updatedAt: true },
      }),
      payload.find({
        collection: COLLECTIONS.pages,
        where: { _status: { equals: 'published' } },
        limit: 100,
        pagination: false,
        depth: 0,
        draft: false,
        overrideAccess: false,
        select: { slug: true, updatedAt: true },
      }),
    ])
    return [
      ...cats.docs.map((c) => ({ path: `/categories/${c.path}`, lastModified: c.updatedAt })),
      ...prods.docs.map((p) => ({ path: `/products/${p.slug}`, lastModified: p.updatedAt })),
      ...pages.docs.map((p) => ({ path: `/${p.slug}`, lastModified: p.updatedAt })),
    ]
  },
  ['sitemap'],
  cacheOpts,
)
