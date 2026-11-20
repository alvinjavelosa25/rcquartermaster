import type { CollectionConfig } from 'payload'
import { nobody } from '@/access'

/**
 * Denormalised, published-only copy of products used by SearchService.
 * Maintained by PayloadSearchIndexer; never edited by hand and never exposed through the API.
 * The generated `tsv` column and GIN indexes are added in src/lib/search/schema.ts.
 */
export const SearchDocuments: CollectionConfig = {
  slug: 'search-documents',
  admin: { hidden: true },
  access: { read: nobody, create: nobody, update: nobody, delete: nobody },
  timestamps: true,
  fields: [
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      unique: true,
      index: true,
    },
    { name: 'sku', type: 'text', required: true, index: true },
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true },
    { name: 'summary', type: 'textarea' },
    { name: 'body', type: 'textarea' },
    { name: 'manufacturer', type: 'text' },
    { name: 'availability', type: 'text' },
    { name: 'categoryIds', type: 'json' },
    { name: 'categoryPath', type: 'text' },
    { name: 'categoryName', type: 'text' },
    { name: 'attributes', type: 'json' },
    { name: 'image', type: 'json' },
  ],
}
