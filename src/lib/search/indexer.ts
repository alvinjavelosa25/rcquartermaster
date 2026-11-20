import type { Payload, PayloadRequest } from 'payload'
import { COLLECTIONS } from '@/lib/constants'
import { lexicalToText } from '@/lib/richtext'
import type { SearchIndexer } from './types'

type Id = number | string

interface CategoryLike {
  id: number
  name: string
  path: string
  parent?: number | CategoryLike | null
}

/** Pure: ids of a category and all of its ancestors, given a lookup of parents. */
export function collectCategoryIds(
  start: number,
  parentOf: (id: number) => number | null | undefined,
  maxDepth = 8,
): number[] {
  const out: number[] = []
  let current: number | null | undefined = start
  while (current != null && out.length < maxDepth && !out.includes(current)) {
    out.push(current)
    current = parentOf(current)
  }
  return out
}

const idOf = (v: unknown): number | null => {
  if (typeof v === 'number') return v
  if (v && typeof v === 'object' && 'id' in v) return (v as { id: number }).id
  return null
}

export interface SearchDocumentData {
  product: number
  sku: string
  name: string
  slug: string
  summary: string
  body: string
  manufacturer: string
  availability: string
  categoryIds: number[]
  categoryPath: string
  categoryName: string
  attributes: Record<string, string>
  image: { url: string; alt: string; width?: number; height?: number } | null
}

export class PayloadSearchIndexer implements SearchIndexer {
  constructor(
    private readonly payload: Payload,
    private readonly req?: PayloadRequest,
  ) {}

  private async ancestorIds(categoryId: number): Promise<number[]> {
    const cache = new Map<number, number | null>()
    const ids: number[] = []
    let current: number | null = categoryId
    while (current != null && ids.length < 8 && !ids.includes(current)) {
      ids.push(current)
      if (!cache.has(current)) {
        const cat = (await this.payload.findByID({
          collection: COLLECTIONS.categories,
          id: current,
          depth: 0,
          overrideAccess: true,
          req: this.req,
        })) as unknown as CategoryLike
        cache.set(current, idOf(cat.parent))
      }
      current = cache.get(current) ?? null
    }
    return ids
  }

  async build(productId: Id): Promise<SearchDocumentData | null> {
    let product
    try {
      product = await this.payload.findByID({
        collection: COLLECTIONS.products,
        id: productId,
        depth: 2,
        draft: false,
        overrideAccess: true,
        req: this.req,
      })
    } catch {
      return null
    }
    if (!product || product._status !== 'published') return null

    const category = product.category as unknown as CategoryLike | number | null
    const primaryId = idOf(category)
    const categoryIds = new Set<number>()
    if (primaryId != null) for (const id of await this.ancestorIds(primaryId)) categoryIds.add(id)
    for (const extra of product.additionalCategories ?? []) {
      const id = idOf(extra)
      if (id != null) for (const a of await this.ancestorIds(id)) categoryIds.add(a)
    }

    const attributes: Record<string, string> = {}
    const attributeText: string[] = []
    for (const row of product.attributes ?? []) {
      const def = row.attribute as unknown as { key?: string } | number | null
      if (def && typeof def === 'object' && def.key && row.value) {
        attributes[def.key] = String(row.value)
        attributeText.push(String(row.value))
      }
    }

    const specText = (product.specifications ?? []).map((s) => `${s.label} ${s.value}`)
    const body = [
      lexicalToText(product.description),
      ...specText,
      ...attributeText,
      product.manufacturerPartNumber ?? '',
    ]
      .filter(Boolean)
      .join('\n')

    const firstImage = product.images?.[0]
    const media = firstImage && typeof firstImage.image === 'object' ? firstImage.image : null
    const image =
      media && media.filename
        ? {
            url: `/api/media/file/${encodeURIComponent(media.filename)}`,
            alt: media.alt ?? product.name,
            width: media.width ?? undefined,
            height: media.height ?? undefined,
          }
        : null

    return {
      product: product.id,
      sku: product.sku,
      name: product.name,
      slug: product.slug,
      summary: product.summary ?? '',
      body,
      manufacturer: product.manufacturer ?? '',
      availability: product.availability ?? 'available',
      categoryIds: [...categoryIds],
      categoryPath: typeof category === 'object' && category ? category.path : '',
      categoryName: typeof category === 'object' && category ? category.name : '',
      attributes,
      image,
    }
  }

  private async findExisting(productId: Id) {
    const found = await this.payload.find({
      collection: COLLECTIONS.searchDocuments,
      where: { product: { equals: productId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req: this.req,
    })
    return found.docs[0]
  }

  async sync(productId: Id): Promise<void> {
    const data = await this.build(productId)
    if (!data) return this.remove(productId)
    const existing = await this.findExisting(productId)
    if (existing) {
      await this.payload.update({
        collection: COLLECTIONS.searchDocuments,
        id: existing.id,
        data,
        overrideAccess: true,
        req: this.req,
      })
    } else {
      await this.payload.create({
        collection: COLLECTIONS.searchDocuments,
        data,
        overrideAccess: true,
        req: this.req,
      })
    }
  }

  async remove(productId: Id): Promise<void> {
    await this.payload.delete({
      collection: COLLECTIONS.searchDocuments,
      where: { product: { equals: productId } },
      overrideAccess: true,
      req: this.req,
    })
  }

  async reindexAll(
    opts: { batchSize?: number; onProgress?: (done: number) => void } = {},
  ): Promise<number> {
    const batchSize = opts.batchSize ?? 100
    const seen: number[] = []
    let page = 1
    for (;;) {
      const res = await this.payload.find({
        collection: COLLECTIONS.products,
        where: { _status: { equals: 'published' } },
        limit: batchSize,
        page,
        depth: 0,
        draft: false,
        overrideAccess: true,
        req: this.req,
        select: { sku: true },
      })
      for (const doc of res.docs) {
        await this.sync(doc.id)
        seen.push(doc.id)
        opts.onProgress?.(seen.length)
      }
      if (!res.hasNextPage) break
      page += 1
    }
    // Drop index rows whose product is no longer published or no longer exists.
    await this.payload.delete({
      collection: COLLECTIONS.searchDocuments,
      where: seen.length ? { product: { not_in: seen } } : { id: { exists: true } },
      overrideAccess: true,
      req: this.req,
    })
    return seen.length
  }
}
