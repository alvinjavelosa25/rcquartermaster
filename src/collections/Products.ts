import { ValidationError } from 'payload'
import type { CollectionConfig } from 'payload'
import { adminOnly, catalogueStaff, publishedOrStaff } from '@/access'
import { AVAILABILITY, AVAILABILITY_LABELS, COLLECTIONS } from '@/lib/constants'
import { revalidateCatalogue } from '@/lib/cache'
import { getSearchIndexer } from '@/lib/search'
import { normalizeSku, slugify } from '@/lib/slug'
import { validateAttributeValue } from '@/lib/attributes'

const idOf = (v: unknown): number | null => {
  if (typeof v === 'number') return v
  if (v && typeof v === 'object' && 'id' in v) return (v as { id: number }).id
  return null
}

export const Products: CollectionConfig = {
  slug: 'products',
  labels: { singular: 'Product', plural: 'Products' },
  versions: { drafts: true, maxPerDoc: 25 },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['sku', 'name', 'category', 'availability', '_status', 'updatedAt'],
    listSearchableFields: ['sku', 'name', 'manufacturerPartNumber'],
    group: 'Catalogue',
    description: 'Only Published products appear on the website, in search and in the sitemap.',
    components: {
      beforeList: ['/components/admin/ProductCsvTools#ProductCsvTools'],
    },
    preview: (doc) =>
      doc?.slug
        ? `${(process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '')}/preview/products/${encodeURIComponent(String(doc.slug))}`
        : null,
  },
  access: {
    read: publishedOrStaff,
    create: catalogueStaff,
    update: catalogueStaff,
    delete: adminOnly,
    readVersions: catalogueStaff,
  },
  defaultSort: 'sku',
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data
        if (typeof data.sku === 'string') data.sku = normalizeSku(data.sku)
        if (!data.slug && typeof data.name === 'string' && data.sku) {
          data.slug = slugify(`${data.name} ${data.sku}`)
        } else if (typeof data.slug === 'string') {
          data.slug = slugify(data.slug)
        }
        return data
      },
    ],
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const merged = { ...originalDoc, ...data }

        // Attribute values must match their definition (number, yes/no, one of the listed options).
        const rows: { attribute?: unknown; value?: string }[] = merged.attributes ?? []
        if (rows.length) {
          const ids = rows.map((r) => idOf(r.attribute)).filter((v): v is number => v != null)
          const defs = await req.payload.find({
            collection: COLLECTIONS.attributes,
            where: { id: { in: ids } },
            limit: 200,
            pagination: false,
            depth: 0,
            overrideAccess: true,
            req,
          })
          const byId = new Map(defs.docs.map((d) => [d.id, d]))
          const errors: { message: string; path: string }[] = []
          rows.forEach((row, i) => {
            const def = byId.get(idOf(row.attribute) ?? -1)
            if (!def) return
            const err = validateAttributeValue(
              { type: def.type, options: def.options?.map((o) => o.value), label: def.label },
              row.value ?? '',
            )
            if (err) errors.push({ message: err, path: `attributes.${i}.value` })
          })
          const seen = new Set<number>()
          rows.forEach((row, i) => {
            const id = idOf(row.attribute)
            if (id == null) return
            if (seen.has(id))
              errors.push({
                message: 'This attribute is listed twice.',
                path: `attributes.${i}.attribute`,
              })
            seen.add(id)
          })
          if (errors.length) throw new ValidationError({ errors })
        }

        // Publishing requires the public-facing essentials.
        if (merged._status === 'published') {
          const errors: { message: string; path: string }[] = []
          if (!merged.summary)
            errors.push({ message: 'A summary is required to publish.', path: 'summary' })
          if (!idOf(merged.category))
            errors.push({ message: 'A category is required to publish.', path: 'category' })
          if (!merged.images?.length)
            errors.push({ message: 'At least one image is required to publish.', path: 'images' })
          if (errors.length) throw new ValidationError({ errors })
          if (req.user) {
            data.approvedBy = req.user.id
            data.approvedAt = new Date().toISOString()
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        // Always re-read the *published* state, so editing a draft never removes a live product from search.
        await getSearchIndexer(req.payload, req).sync(doc.id)
        revalidateCatalogue()
        return doc
      },
    ],
    afterDelete: [
      async ({ id, req, doc }) => {
        await getSearchIndexer(req.payload, req).remove(id)
        revalidateCatalogue()
        return doc
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'sku',
          type: 'text',
          required: true,
          unique: true,
          index: true,
          admin: { description: 'Unique. Trimmed and upper-cased automatically.', width: '40%' },
        },
        { name: 'name', type: 'text', required: true, admin: { width: '60%' } },
      ],
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar', description: 'Generated from name and SKU when empty.' },
    },
    {
      name: 'summary',
      type: 'textarea',
      maxLength: 300,
      admin: {
        description:
          'One or two sentences. Shown on cards and in search results. Required to publish.',
      },
    },
    { name: 'description', type: 'richText' },
    {
      type: 'row',
      fields: [
        {
          name: 'category',
          type: 'relationship',
          relationTo: 'categories',
          index: true,
          admin: { description: 'Primary category. Required to publish.' },
        },
        {
          name: 'additionalCategories',
          type: 'relationship',
          relationTo: 'categories',
          hasMany: true,
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'manufacturer', type: 'text' },
        { name: 'manufacturerPartNumber', type: 'text', index: true },
        { name: 'unitOfMeasure', type: 'text', admin: { description: 'For example EA, BX, CS.' } },
      ],
    },
    {
      name: 'availability',
      type: 'select',
      required: true,
      defaultValue: 'available',
      options: AVAILABILITY.map((value) => ({ value, label: AVAILABILITY_LABELS[value] })),
      admin: {
        position: 'sidebar',
        description: 'Discontinued products cannot be added to an RFQ.',
      },
    },
    {
      name: 'countryOfOrigin',
      type: 'text',
      admin: { position: 'sidebar', description: 'Optional. Only fill in when verified.' },
    },
    {
      name: 'specifications',
      type: 'array',
      labels: { singular: 'Specification', plural: 'Approved specifications' },
      admin: { description: 'Approved specification rows shown in a table on the product page.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'label', type: 'text', required: true },
            { name: 'value', type: 'text', required: true },
            { name: 'unit', type: 'text', admin: { width: '20%' } },
          ],
        },
      ],
    },
    {
      name: 'attributes',
      type: 'array',
      labels: { singular: 'Attribute value', plural: 'Attribute values' },
      admin: {
        description:
          'Values for configurable attributes. Filterable attributes become search filters.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'attribute',
              type: 'relationship',
              relationTo: 'attribute-definitions',
              required: true,
            },
            { name: 'value', type: 'text', required: true },
          ],
        },
      ],
    },
    {
      name: 'images',
      type: 'array',
      labels: { singular: 'Image', plural: 'Images' },
      admin: {
        description: 'The first image is the primary image. At least one is required to publish.',
      },
      fields: [{ name: 'image', type: 'upload', relationTo: 'media', required: true }],
    },
    {
      name: 'documents',
      type: 'relationship',
      relationTo: 'documents',
      hasMany: true,
      admin: { description: 'Only Published documents are shown to buyers.' },
    },
    { name: 'relatedProducts', type: 'relationship', relationTo: 'products', hasMany: true },
    {
      type: 'collapsible',
      label: 'SEO',
      admin: { initCollapsed: true },
      fields: [
        { name: 'seoTitle', type: 'text', maxLength: 70 },
        { name: 'seoDescription', type: 'textarea', maxLength: 170 },
      ],
    },
    {
      type: 'row',
      admin: { position: 'sidebar' },
      fields: [
        {
          name: 'approvedBy',
          type: 'relationship',
          relationTo: 'users',
          admin: { readOnly: true },
        },
        {
          name: 'approvedAt',
          type: 'date',
          admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
        },
      ],
    },
  ],
}
