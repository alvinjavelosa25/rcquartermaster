import type { CollectionConfig, Field } from 'payload'
import { adminOnly, nobody, nobodyField, rfqStaff, rfqStaffField } from '@/access'
import { RFQ_STATUSES, RFQ_STATUS_LABELS } from '@/lib/constants'

/** Fields supplied by the buyer. Immutable for everyone once the record exists. */
const immutable = (field: Field): Field =>
  ({
    ...(field as object),
    access: { update: nobodyField },
  }) as Field

const buyerFields: Field[] = [
  {
    type: 'row',
    fields: (
      [
        { name: 'buyerName', type: 'text', required: true },
        { name: 'email', type: 'email', required: true, index: true },
        { name: 'phone', type: 'text', required: true },
      ] satisfies Field[]
    ).map(immutable),
  },
  {
    type: 'row',
    fields: (
      [
        { name: 'organisation', type: 'text', required: true, index: true },
        { name: 'facility', type: 'text' },
        { name: 'buyerRole', type: 'text' },
      ] satisfies Field[]
    ).map(immutable),
  },
  immutable({ name: 'neededBy', type: 'date', admin: { date: { pickerAppearance: 'dayOnly' } } }),
  immutable({ name: 'solicitationNumber', type: 'text' }),
  immutable({ name: 'deliveryDetails', type: 'textarea' }),
  immutable({ name: 'specialInstructions', type: 'textarea' }),
  immutable({
    name: 'generalDescription',
    type: 'textarea',
    admin: { description: 'Used when the buyer did not select catalogue items.' },
  }),
  immutable({
    name: 'items',
    type: 'array',
    labels: { singular: 'Line', plural: 'Requested items' },
    fields: [
      {
        type: 'row',
        fields: [
          { name: 'sku', type: 'text', admin: { description: 'Empty for free-text lines.' } },
          { name: 'name', type: 'text', required: true },
          { name: 'quantity', type: 'number', required: true },
          { name: 'unitOfMeasure', type: 'text' },
        ],
      },
      {
        name: 'product',
        type: 'relationship',
        relationTo: 'products',
        admin: { description: 'Linked catalogue product, if it still exists.' },
      },
    ],
  }),
]

export const Rfqs: CollectionConfig = {
  slug: 'rfqs',
  labels: { singular: 'RFQ', plural: 'RFQs' },
  admin: {
    useAsTitle: 'reference',
    group: 'Requests for quote',
    defaultColumns: ['reference', 'status', 'buyerName', 'organisation', 'createdAt'],
    listSearchableFields: ['reference', 'buyerName', 'organisation', 'email', 'itemSkus'],
    description:
      'Requests for quote submitted through the website. Buyer-supplied fields are read-only.',
    components: { beforeList: ['/components/admin/RfqCsvTools#RfqCsvTools'] },
  },
  access: {
    read: rfqStaff,
    create: nobody, // created only by the RFQ pipeline (server side)
    update: rfqStaff,
    delete: adminOnly,
  },
  defaultSort: '-createdAt',
  timestamps: true,
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation, req }) => {
        const items: { sku?: string | null }[] = data.items ?? originalDoc?.items ?? []
        data.itemSkus = items
          .map((i) => i.sku)
          .filter(Boolean)
          .join(' ')

        if (
          operation === 'update' &&
          data.status &&
          originalDoc?.status &&
          data.status !== originalDoc.status
        ) {
          const history = Array.isArray(originalDoc.statusHistory) ? originalDoc.statusHistory : []
          data.statusHistory = [
            ...history,
            {
              from: originalDoc.status,
              to: data.status,
              by: req.user?.id ?? null,
              at: new Date().toISOString(),
            },
          ]
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'reference',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      access: { update: nobodyField },
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      index: true,
      options: RFQ_STATUSES.map((value) => ({ value, label: RFQ_STATUS_LABELS[value] })),
      access: { update: rfqStaffField },
      admin: { position: 'sidebar' },
    },
    {
      name: 'assignedTo',
      type: 'relationship',
      relationTo: 'users',
      access: { update: rfqStaffField },
      admin: { position: 'sidebar' },
    },
    ...buyerFields,
    { name: 'itemSkus', type: 'text', admin: { hidden: true } },
    {
      name: 'attachments',
      type: 'join',
      collection: 'rfq-attachments',
      on: 'rfq',
      admin: { description: 'Files are downloadable only after the virus-scan check passes.' },
    },
    {
      name: 'notes',
      type: 'array',
      labels: { singular: 'Internal note', plural: 'Internal notes (never shown to buyers)' },
      access: { update: rfqStaffField },
      fields: [
        { name: 'body', type: 'textarea', required: true },
        { name: 'author', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
        {
          name: 'createdAt',
          type: 'date',
          admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
        },
      ],
      hooks: {
        beforeChange: [
          ({ value, req }) => {
            // Stamp author and time on notes that do not have them yet.
            if (!Array.isArray(value)) return value
            return value.map((n: { author?: unknown; createdAt?: string }) => ({
              ...n,
              author: n.author ?? req.user?.id,
              createdAt: n.createdAt ?? new Date().toISOString(),
            }))
          },
        ],
      },
    },
    {
      name: 'statusHistory',
      type: 'array',
      access: { update: nobodyField },
      admin: { readOnly: true, initCollapsed: true },
      fields: [
        { name: 'from', type: 'text' },
        { name: 'to', type: 'text' },
        { name: 'by', type: 'relationship', relationTo: 'users' },
        { name: 'at', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    {
      type: 'collapsible',
      label: 'System details',
      admin: { initCollapsed: true },
      fields: [
        immutable({ name: 'privacyAcknowledgedAt', type: 'date' }),
        immutable({
          name: 'retentionExpiresAt',
          type: 'date',
          index: true,
          admin: { description: 'RFQ and attachments are deleted after this date.' },
        }),
        immutable({ name: 'idempotencyKey', type: 'text', unique: true, index: true }),
        immutable({
          name: 'notifications',
          type: 'group',
          fields: [
            {
              name: 'salesEmailStatus',
              type: 'select',
              defaultValue: 'pending',
              options: ['pending', 'sent', 'failed'],
            },
            {
              name: 'buyerEmailStatus',
              type: 'select',
              defaultValue: 'pending',
              options: ['pending', 'sent', 'failed'],
            },
            { name: 'attempts', type: 'number', defaultValue: 0 },
            { name: 'lastAttemptAt', type: 'date' },
            { name: 'lastError', type: 'text' },
          ],
        }),
        immutable({
          name: 'clientMeta',
          type: 'group',
          fields: [
            { name: 'ipHash', type: 'text' },
            { name: 'userAgent', type: 'text' },
            { name: 'turnstileVerified', type: 'checkbox' },
          ],
        }),
      ],
    },
  ],
}
