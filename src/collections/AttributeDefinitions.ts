import type { CollectionConfig } from 'payload'
import { adminOnly, catalogueStaff, everyone } from '@/access'
import { revalidateCatalogue } from '@/lib/cache'

export const AttributeDefinitions: CollectionConfig = {
  slug: 'attribute-definitions',
  labels: { singular: 'Attribute', plural: 'Attributes' },
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'key', 'type', 'filterable', 'sortOrder'],
    group: 'Catalogue',
    description:
      'Configurable product attributes (for example Size, Material). Filterable attributes become search filters.',
  },
  access: {
    read: everyone,
    create: catalogueStaff,
    update: catalogueStaff,
    delete: adminOnly,
  },
  defaultSort: 'sortOrder',
  hooks: {
    afterChange: [
      ({ doc }) => {
        revalidateCatalogue()
        return doc
      },
    ],
  },
  fields: [
    { name: 'label', type: 'text', required: true },
    {
      name: 'key',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      validate: (value: string | null | undefined) =>
        /^[a-z0-9_]{1,64}$/.test(value ?? '') ||
        'Use lowercase letters, numbers and underscores only (for example glove_size).',
      admin: {
        description:
          'Machine name used in CSV files and URLs. Cannot be changed safely once products use it.',
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'text',
      options: [
        { label: 'Text', value: 'text' },
        { label: 'Number', value: 'number' },
        { label: 'Yes / No', value: 'boolean' },
        { label: 'List of options', value: 'enum' },
      ],
    },
    {
      name: 'unit',
      type: 'text',
      admin: { description: 'Optional unit shown after the value, for example mm.' },
    },
    {
      name: 'options',
      type: 'array',
      admin: { condition: (_, siblingData) => siblingData?.type === 'enum' },
      fields: [
        { name: 'value', type: 'text', required: true },
        { name: 'label', type: 'text', required: true },
      ],
    },
    {
      name: 'filterable',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Show as a filter on category and search pages.' },
    },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
  ],
}
