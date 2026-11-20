import type { CollectionConfig } from 'payload'
import { adminOnly, nobody, rfqStaff } from '@/access'

/**
 * Metadata for files uploaded with an RFQ. The bytes live in the PRIVATE bucket under `storageKey`
 * and are only reachable through /api/rfq-attachments/[id]/download after an authorisation check.
 * Records are created by the RFQ pipeline (server side, overrideAccess) and are immutable afterwards
 * except for scan results.
 */
export const RfqAttachments: CollectionConfig = {
  slug: 'rfq-attachments',
  labels: { singular: 'RFQ attachment', plural: 'RFQ attachments' },
  admin: {
    group: 'Requests for quote',
    useAsTitle: 'originalName',
    defaultColumns: ['originalName', 'rfq', 'sizeBytes', 'scanStatus', 'createdAt'],
  },
  access: {
    read: rfqStaff,
    create: nobody,
    update: nobody,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'rfq',
      type: 'relationship',
      relationTo: 'rfqs',
      required: true,
      index: true,
      admin: { readOnly: true },
    },
    { name: 'originalName', type: 'text', required: true, admin: { readOnly: true } },
    { name: 'storageKey', type: 'text', required: true, admin: { readOnly: true, hidden: true } },
    { name: 'declaredMime', type: 'text', admin: { readOnly: true } },
    { name: 'detectedKind', type: 'text', admin: { readOnly: true } },
    { name: 'sizeBytes', type: 'number', admin: { readOnly: true } },
    { name: 'sha256', type: 'text', admin: { readOnly: true } },
    {
      name: 'scanStatus',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Clean', value: 'clean' },
        { label: 'Infected', value: 'infected' },
        { label: 'Error', value: 'error' },
        { label: 'Skipped (no scanner)', value: 'skipped' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
    { name: 'scannedAt', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'scanDetail', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
    {
      name: 'download',
      type: 'ui',
      admin: { components: { Field: '/components/admin/AttachmentDownload#AttachmentDownload' } },
    },
  ],
}
