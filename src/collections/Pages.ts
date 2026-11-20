import type { CollectionConfig } from 'payload'
import { adminOnly, catalogueStaff, publishedOrStaff } from '@/access'
import { revalidateCatalogue } from '@/lib/cache'
import { slugify } from '@/lib/slug'

/** Editable content pages: about, services, privacy, accessibility. Slugs are fixed by the site templates. */
export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Page', plural: 'Pages' },
  versions: { drafts: true, maxPerDoc: 25 },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'updatedAt'],
    group: 'Content',
    description: 'About, Services, Privacy policy and Accessibility statement. Do not change slugs.',
  },
  access: {
    read: publishedOrStaff,
    create: adminOnly,
    update: catalogueStaff,
    delete: adminOnly,
    readVersions: catalogueStaff,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data && !data.slug && typeof data.title === 'string') data.slug = slugify(data.title)
        return data
      },
    ],
    afterChange: [
      ({ doc }) => {
        revalidateCatalogue()
        return doc
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar', description: 'about, services, privacy, accessibility' },
    },
    { name: 'intro', type: 'textarea', maxLength: 400, admin: { description: 'Short introduction shown under the heading.' } },
    { name: 'content', type: 'richText', required: true },
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
