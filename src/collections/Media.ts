import type { CollectionConfig } from 'payload'
import { adminOnly, catalogueStaff, everyone } from '@/access'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Image', plural: 'Images' },
  admin: {
    group: 'Catalogue',
    useAsTitle: 'filename',
    description: 'Product, category and page images.',
  },
  access: {
    read: everyone,
    create: catalogueStaff,
    update: catalogueStaff,
    delete: adminOnly,
  },
  upload: {
    staticDir: '.data/media',
    // SVG is excluded on purpose: it can carry script.
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'],
    imageSizes: [{ name: 'thumbnail', width: 400, height: 400, position: 'centre' }],
    adminThumbnail: 'thumbnail',
    focalPoint: true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Describe the image for people who cannot see it. Required for accessibility.',
      },
    },
  ],
}
