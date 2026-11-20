export const ROLES = ['admin', 'catalogue_manager', 'sales'] as const
export type Role = (typeof ROLES)[number]

export const RFQ_STATUSES = ['new', 'in_progress', 'quoted', 'closed'] as const
export type RfqStatus = (typeof RFQ_STATUSES)[number]

export const RFQ_STATUS_LABELS: Record<RfqStatus, string> = {
  new: 'New',
  in_progress: 'In progress',
  quoted: 'Quoted',
  closed: 'Closed',
}

export const AVAILABILITY = ['available', 'on_request', 'discontinued'] as const
export type Availability = (typeof AVAILABILITY)[number]

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  available: 'Available',
  on_request: 'Available on request',
  discontinued: 'Discontinued',
}

export const DOCUMENT_TYPES = ['spec_sheet', 'certificate', 'sds', 'brochure', 'other'] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  spec_sheet: 'Specification sheet',
  certificate: 'Certificate',
  sds: 'Safety data sheet',
  brochure: 'Brochure',
  other: 'Document',
}

export const PAGE_SIZE = 24
export const MAX_RFQ_ITEMS = 100
export const MAX_QUANTITY = 1_000_000

/** Collection slugs used across the app. */
export const COLLECTIONS = {
  users: 'users',
  categories: 'categories',
  attributes: 'attribute-definitions',
  products: 'products',
  media: 'media',
  documents: 'documents',
  rfqs: 'rfqs',
  rfqAttachments: 'rfq-attachments',
  pages: 'pages',
  searchDocuments: 'search-documents',
  rateLimits: 'rate-limits',
} as const

export const CATALOGUE_CACHE_TAG = 'catalogue'

export const RFQ_LIST_STORAGE_KEY = 'rcq.rfq-list'
