import type { CollectionConfig } from 'payload'
import { adminOnly, catalogueStaff, statusPublishedOrStaff } from '@/access'
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/lib/constants'
import { revalidateCatalogue } from '@/lib/cache'

export const Documents: CollectionConfig = {
  slug: 'documents',
  labels: { singular: 'Document', plural: 'Documents' },
  admin: {
    group: 'Catalogue',
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'status', 'effectiveDate', 'expiryDate'],
    description:
      'Spec sheets, certificates and safety data sheets. Files are only served publicly while the document is Published.',
  },
  access: {
    // File downloads go through Payload, so this rule also protects the file itself.
    read: statusPublishedOrStaff,
    create: catalogueStaff,
    update: catalogueStaff,
    delete: adminOnly,
  },
  upload: {
    staticDir: '.data/documents',
    mimeTypes: ['application/pdf'],
  },
  hooks: {
    afterChange: [
      ({ doc }) => {
        revalidateCatalogue()
        return doc
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
    { name: 'title', type: 'text', required: true },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'spec_sheet',
      options: DOCUMENT_TYPES.map((value) => ({ value, label: DOCUMENT_TYPE_LABELS[value] })),
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft (not public)', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'versionLabel', type: 'text', admin: { description: 'For example "Rev C, 2026".' } },
    {
      type: 'row',
      fields: [
        { name: 'effectiveDate', type: 'date', admin: { date: { pickerAppearance: 'dayOnly' } } },
        {
          name: 'expiryDate',
          type: 'date',
          admin: { date: { pickerAppearance: 'dayOnly' }, description: 'Certificates: shown to buyers.' },
        },
      ],
    },
    {
      name: 'accessibleAlternative',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Tick if this PDF is tagged/accessible or an accessible alternative is available on request.' },
    },
  ],
}
