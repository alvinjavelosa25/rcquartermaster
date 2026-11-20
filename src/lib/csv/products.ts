import { parse } from 'csv-parse/sync'
import { z } from 'zod'
import { AVAILABILITY } from '@/lib/constants'
import { normalizeSku } from '@/lib/slug'

export const MAX_IMPORT_ROWS = 20_000
export const MAX_ADMIN_IMPORT_ROWS = 2_000

export const BASE_COLUMNS = [
  'sku',
  'name',
  'status',
  'summary',
  'description',
  'category_path',
  'additional_category_paths',
  'manufacturer',
  'manufacturer_part_number',
  'unit_of_measure',
  'availability',
  'country_of_origin',
  'specifications',
  'image_filenames',
  'document_titles',
] as const

export const ATTR_PREFIX = 'attr.'
const LIST_SEP = '|'

const FORMULA_START = /^[=+\-@\t\r]/

/** Neutralise spreadsheet formulas in exported cells (CSV injection). */
export function sanitizeCsvCell(value: unknown): string {
  const s = value == null ? '' : String(value)
  return FORMULA_START.test(s) ? `'${s}` : s
}

/** Reverse of sanitizeCsvCell, so an export can be imported again unchanged. */
export function unsanitizeCsvCell(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value
}

export const splitList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(LIST_SEP)
    .map((s) => s.trim())
    .filter(Boolean)

export const joinList = (values: string[]): string => values.join(` ${LIST_SEP} `)

export interface SpecRow {
  label: string
  value: string
}

/** "Label: value | Other: value" -> rows. Entries without a colon are rejected by the caller. */
export function parseSpecifications(value: string | undefined): {
  rows: SpecRow[]
  invalid: string[]
} {
  const rows: SpecRow[] = []
  const invalid: string[] = []
  for (const part of splitList(value)) {
    const idx = part.indexOf(':')
    const label = idx > 0 ? part.slice(0, idx).trim() : ''
    const val = idx > 0 ? part.slice(idx + 1).trim() : ''
    if (label && val) rows.push({ label, value: val })
    else invalid.push(part)
  }
  return { rows, invalid }
}

export const formatSpecifications = (
  rows: { label: string; value: string; unit?: string | null }[],
): string => joinList(rows.map((r) => `${r.label}: ${r.value}${r.unit ? ` ${r.unit}` : ''}`))

export const productRowSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, 'SKU is required')
    .max(64, 'SKU must be 64 characters or fewer')
    .transform(normalizeSku),
  name: z.string().trim().min(1, 'Name is required').max(300),
  status: z.preprocess(
    (v) =>
      typeof v === 'string' && v.trim() === ''
        ? undefined
        : typeof v === 'string'
          ? v.trim().toLowerCase()
          : v,
    z.enum(['draft', 'published']).default('draft'),
  ),
  summary: z.string().trim().max(300, 'Summary must be 300 characters or fewer').default(''),
  description: z.string().trim().max(20_000).default(''),
  category_path: z.string().trim().default(''),
  additional_category_paths: z.string().default(''),
  manufacturer: z.string().trim().max(200).default(''),
  manufacturer_part_number: z.string().trim().max(200).default(''),
  unit_of_measure: z.string().trim().max(16).default(''),
  availability: z.preprocess(
    (v) =>
      typeof v === 'string' && v.trim() === ''
        ? undefined
        : typeof v === 'string'
          ? v.trim().toLowerCase()
          : v,
    z.enum(AVAILABILITY).default('available'),
  ),
  country_of_origin: z.string().trim().max(100).default(''),
  specifications: z.string().default(''),
  image_filenames: z.string().default(''),
  document_titles: z.string().default(''),
})

export type ProductRow = z.output<typeof productRowSchema> & { attributes: Record<string, string> }

export interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
}

export class CsvFormatError extends Error {}

/** Parse CSV text into header + raw rows. Throws CsvFormatError for structural problems. */
export function parseCsvText(text: string): ParsedCsv {
  let records: Record<string, string>[]
  try {
    records = parse(text, {
      columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
      bom: true,
      skip_empty_lines: true,
      relax_quotes: false,
      trim: true,
    }) as Record<string, string>[]
  } catch (error) {
    throw new CsvFormatError(`The file is not valid CSV: ${(error as Error).message}`)
  }
  const first = records[0]
  // `columns` consumed the header; recover it from the first record, or from the text when the file has no rows.
  const headers = first
    ? Object.keys(first)
    : (text
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)[0]
        ?.split(',')
        .map((h) => h.trim().toLowerCase()) ?? [])
  for (const required of ['sku', 'name']) {
    if (!headers.includes(required))
      throw new CsvFormatError(`Missing required column "${required}".`)
  }
  if (records.length > MAX_IMPORT_ROWS) {
    throw new CsvFormatError(
      `The file has more than ${MAX_IMPORT_ROWS} rows. Split it into smaller files.`,
    )
  }
  const unknown = headers.filter(
    (h) => !(BASE_COLUMNS as readonly string[]).includes(h) && !h.startsWith(ATTR_PREFIX),
  )
  if (unknown.length) throw new CsvFormatError(`Unknown column(s): ${unknown.join(', ')}.`)
  return { headers, rows: records }
}

/** Validate one raw row. Returns the typed row or a list of messages. */
export function validateRow(
  raw: Record<string, string>,
): { ok: true; row: ProductRow } | { ok: false; errors: string[] } {
  const clean: Record<string, string> = {}
  const attributes: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    const v = unsanitizeCsvCell(value ?? '')
    if (key.startsWith(ATTR_PREFIX)) {
      if (v) attributes[key.slice(ATTR_PREFIX.length)] = v
    } else {
      clean[key] = v
    }
  }
  const parsed = productRowSchema.safeParse(clean)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'row'}: ${i.message}`),
    }
  }
  const specs = parseSpecifications(parsed.data.specifications)
  if (specs.invalid.length) {
    return {
      ok: false,
      errors: [
        `specifications: use "Label: value" pairs separated by "|" (problem with: ${specs.invalid.join('; ')})`,
      ],
    }
  }
  return { ok: true, row: { ...parsed.data, attributes } }
}

export const TEMPLATE_HEADERS = [...BASE_COLUMNS, 'attr.example_key'] as const
