import { APIError, ValidationError } from 'payload'
import type { CollectionConfig, Payload, PayloadRequest } from 'payload'
import { adminOnly, catalogueStaff, publishedOrStaff } from '@/access'
import { COLLECTIONS } from '@/lib/constants'
import { revalidateCatalogue } from '@/lib/cache'
import { getSearchIndexer } from '@/lib/search'
import { MAX_CATEGORY_DEPTH, buildCategoryPath, depthOfPath, slugify } from '@/lib/slug'

const idOf = (v: unknown): number | null => {
  if (typeof v === 'number') return v
  if (v && typeof v === 'object' && 'id' in v) return (v as { id: number }).id
  return null
}

async function loadCategory(payload: Payload, id: number, req: PayloadRequest) {
  return payload.findByID({
    collection: COLLECTIONS.categories,
    id,
    depth: 0,
    overrideAccess: true,
    req,
  })
}

/** Ids of a category and everything below it (breadth-first). */
async function subtreeIds(
  payload: Payload,
  rootId: number,
  req: PayloadRequest,
): Promise<number[]> {
  const ids = [rootId]
  let frontier = [rootId]
  while (frontier.length && ids.length < 5000) {
    const res = await payload.find({
      collection: COLLECTIONS.categories,
      where: { parent: { in: frontier } },
      limit: 1000,
      pagination: false,
      depth: 0,
      overrideAccess: true,
      req,
    })
    frontier = res.docs.map((d) => d.id).filter((id) => !ids.includes(id))
    ids.push(...frontier)
  }
  return ids
}

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: 'Category', plural: 'Categories' },
  versions: { drafts: true, maxPerDoc: 25 },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'path', 'sortOrder', '_status', 'updatedAt'],
    group: 'Catalogue',
    description:
      'Hierarchical product categories. Only published categories appear on the website.',
  },
  access: {
    read: publishedOrStaff,
    create: catalogueStaff,
    update: catalogueStaff,
    delete: adminOnly,
    readVersions: catalogueStaff,
  },
  defaultSort: 'path',
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        if (!data) return data
        if (!data.slug && typeof data.name === 'string') data.slug = slugify(data.name)
        if (typeof data.slug === 'string') data.slug = slugify(data.slug)

        // Cycle prevention: a category cannot be its own ancestor.
        const parentId = 'parent' in data ? idOf(data.parent) : idOf(originalDoc?.parent)
        const selfId = originalDoc?.id as number | undefined
        if (parentId && selfId) {
          let cursor: number | null = parentId
          for (let i = 0; cursor && i < 10; i++) {
            if (cursor === selfId) {
              throw new ValidationError({
                errors: [
                  {
                    message: 'A category cannot be placed inside itself or its own subcategory.',
                    path: 'parent',
                  },
                ],
              })
            }
            const next: { parent?: unknown } = await loadCategory(req.payload, cursor, req)
            cursor = idOf(next.parent)
          }
        }
        return data
      },
    ],
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const slug: string | undefined = data.slug ?? originalDoc?.slug
        if (!slug) return data
        const parentId = 'parent' in data ? idOf(data.parent) : idOf(originalDoc?.parent)
        let parentPath: string | null = null
        if (parentId) {
          const parent = await loadCategory(req.payload, parentId, req)
          parentPath = parent.path ?? null
        }
        const path = buildCategoryPath(parentPath, slug)
        const depth = depthOfPath(path)
        if (depth > MAX_CATEGORY_DEPTH) {
          throw new ValidationError({
            errors: [
              {
                message: `Categories can be at most ${MAX_CATEGORY_DEPTH} levels deep.`,
                path: 'parent',
              },
            ],
          })
        }
        const clash = await req.payload.find({
          collection: COLLECTIONS.categories,
          where: {
            path: { equals: path },
            ...(originalDoc?.id ? { id: { not_equals: originalDoc.id } } : {}),
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
          req,
        })
        if (clash.totalDocs > 0) {
          throw new ValidationError({
            errors: [
              { message: 'Another category at this level already uses this slug.', path: 'slug' },
            ],
          })
        }
        data.path = path
        data.depth = depth
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        const pathChanged = Boolean(previousDoc?.path) && previousDoc.path !== doc.path
        if (pathChanged) {
          // Recompute descendants' paths after a rename or move. Each child's own hook cascades further down.
          const children = await req.payload.find({
            collection: COLLECTIONS.categories,
            where: { parent: { equals: doc.id } },
            limit: 1000,
            pagination: false,
            depth: 0,
            overrideAccess: true,
            req,
          })
          for (const child of children.docs) {
            await req.payload.update({
              collection: COLLECTIONS.categories,
              id: child.id,
              // Re-saving the slug re-runs the path hook. Keep the current publish state untouched.
              data: { slug: child.slug, _status: child._status },
              overrideAccess: true,
              req,
            })
          }
        }
        // Search documents carry category ids and names, so refresh affected products.
        if (
          previousDoc?.id &&
          (pathChanged || previousDoc.parent !== doc.parent || previousDoc.name !== doc.name)
        ) {
          const ids = await subtreeIds(req.payload, doc.id, req)
          const products = await req.payload.find({
            collection: COLLECTIONS.products,
            where: { or: [{ category: { in: ids } }, { additionalCategories: { in: ids } }] },
            limit: 5000,
            pagination: false,
            depth: 0,
            overrideAccess: true,
            req,
            select: { sku: true },
          })
          const indexer = getSearchIndexer(req.payload, req)
          for (const p of products.docs) await indexer.sync(p.id)
        }
        revalidateCatalogue()
        return doc
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        const [children, products] = await Promise.all([
          req.payload.count({
            collection: COLLECTIONS.categories,
            where: { parent: { equals: id } },
            overrideAccess: true,
            req,
          }),
          req.payload.count({
            collection: COLLECTIONS.products,
            where: {
              or: [{ category: { equals: id } }, { additionalCategories: { contains: id } }],
            },
            overrideAccess: true,
            req,
          }),
        ])
        if (children.totalDocs > 0 || products.totalDocs > 0) {
          throw new APIError(
            'This category still has subcategories or products. Move or remove them first.',
            400,
          )
        }
      },
    ],
    afterDelete: [
      ({ doc }) => {
        revalidateCatalogue()
        return doc
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      admin: { description: 'Lowercase URL segment. Generated from the name when empty.' },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      admin: { description: 'Leave empty for a top-level category.' },
    },
    {
      name: 'path',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Computed. Used in the public URL.',
      },
    },
    { name: 'depth', type: 'number', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'sortOrder', type: 'number', defaultValue: 0, admin: { position: 'sidebar' } },
    { name: 'description', type: 'textarea', maxLength: 600 },
    { name: 'image', type: 'upload', relationTo: 'media' },
    {
      type: 'collapsible',
      label: 'SEO',
      admin: { initCollapsed: true },
      fields: [
        { name: 'seoTitle', type: 'text', maxLength: 70 },
        { name: 'seoDescription', type: 'textarea', maxLength: 170 },
      ],
    },
  ],
}
