import { stringify } from 'csv-stringify/sync'
import type { Payload } from 'payload'
import { COLLECTIONS } from '@/lib/constants'
import { buildLexical, lexicalToText } from '@/lib/richtext'
import { slugify } from '@/lib/slug'
import { validateAttributeValue } from '@/lib/attributes'
import {
  ATTR_PREFIX,
  BASE_COLUMNS,
  CsvFormatError,
  MAX_ADMIN_IMPORT_ROWS,
  TEMPLATE_HEADERS,
  formatSpecifications,
  joinList,
  parseCsvText,
  parseSpecifications,
  sanitizeCsvCell,
  splitList,
  validateRow,
} from './products'

export interface ImportOptions {
  /** Validate only; write nothing. */
  dryRun: boolean
  /** Honour `status=published` rows. When false, everything is saved as a draft. */
  publish: boolean
  /** Maximum rows accepted (admin UI uses a lower cap than the CLI). */
  maxRows?: number
  stopOnFirstError?: boolean
}

export interface ImportReport {
  dryRun: boolean
  total: number
  created: number
  updated: number
  skipped: number
  failed: number
  errors: { row: number; sku?: string; message: string }[]
  fatal?: string
}

const emptyReport = (dryRun: boolean): ImportReport => ({
  dryRun,
  total: 0,
  created: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  errors: [],
})

function errorMessage(error: unknown): string {
  const data = (error as { data?: { errors?: { message?: string; path?: string }[] } }).data
  if (data?.errors?.length) return data.errors.map((e) => (e.path ? `${e.path}: ${e.message}` : e.message)).join('; ')
  return (error as Error).message ?? String(error)
}

/** Import products from CSV text. Upserts by SKU. Rows are independent: one bad row does not stop the others. */
export async function importProductsCsv(payload: Payload, text: string, opts: ImportOptions): Promise<ImportReport> {
  const report = emptyReport(opts.dryRun)
  let parsed
  try {
    parsed = parseCsvText(text)
  } catch (error) {
    report.fatal = error instanceof CsvFormatError ? error.message : 'The file could not be read.'
    return report
  }
  const maxRows = opts.maxRows ?? MAX_ADMIN_IMPORT_ROWS
  report.total = parsed.rows.length
  if (parsed.rows.length > maxRows) {
    report.fatal = `This file has ${parsed.rows.length} rows. The limit here is ${maxRows}; use the command line importer (npm run import:csv) for larger files.`
    return report
  }

  // Preload lookups once.
  const [categories, attrDefs, media, documents] = await Promise.all([
    payload.find({ collection: COLLECTIONS.categories, limit: 5000, pagination: false, depth: 0, overrideAccess: true, draft: false }),
    payload.find({ collection: COLLECTIONS.attributes, limit: 500, pagination: false, depth: 0, overrideAccess: true }),
    payload.find({ collection: COLLECTIONS.media, limit: 20000, pagination: false, depth: 0, overrideAccess: true, select: { filename: true } }),
    payload.find({ collection: COLLECTIONS.documents, limit: 20000, pagination: false, depth: 0, overrideAccess: true, select: { title: true } }),
  ])
  const categoryByPath = new Map(categories.docs.map((c) => [c.path, c.id]))
  const defByKey = new Map(attrDefs.docs.map((d) => [d.key, d]))
  const mediaByName = new Map(media.docs.map((m) => [m.filename ?? '', m.id]))
  const docsByTitle = new Map<string, number[]>()
  for (const d of documents.docs) {
    const k = d.title.trim().toLowerCase()
    docsByTitle.set(k, [...(docsByTitle.get(k) ?? []), d.id])
  }

  const seenSkus = new Set<string>()
  for (let i = 0; i < parsed.rows.length; i++) {
    const rowNumber = i + 2 // header is row 1
    const result = validateRow(parsed.rows[i]!)
    const fail = (message: string, sku?: string) => {
      report.failed += 1
      report.errors.push({ row: rowNumber, sku, message })
    }
    if (!result.ok) {
      fail(result.errors.join('; '), parsed.rows[i]!.sku)
      if (opts.stopOnFirstError) break
      continue
    }
    const row = result.row
    const problems: string[] = []
    if (seenSkus.has(row.sku)) problems.push('duplicate SKU earlier in this file')
    seenSkus.add(row.sku)

    const categoryId = row.category_path ? categoryByPath.get(row.category_path) : undefined
    if (row.category_path && !categoryId) problems.push(`unknown category "${row.category_path}"`)
    if (row.status === 'published' && opts.publish && !categoryId) problems.push('a category is required to publish')

    const extraCategoryIds: number[] = []
    for (const p of splitList(row.additional_category_paths)) {
      const id = categoryByPath.get(p)
      if (id) extraCategoryIds.push(id)
      else problems.push(`unknown additional category "${p}"`)
    }

    const attributeRows: { attribute: number; value: string }[] = []
    for (const [key, value] of Object.entries(row.attributes)) {
      const def = defByKey.get(key)
      if (!def) {
        problems.push(`unknown attribute "${key}"`)
        continue
      }
      const err = validateAttributeValue(
        { type: def.type, options: def.options?.map((o) => o.value), label: def.label },
        value,
      )
      if (err) problems.push(err)
      else attributeRows.push({ attribute: def.id, value })
    }

    const imageIds: number[] = []
    for (const f of splitList(row.image_filenames)) {
      const id = mediaByName.get(f)
      if (id) imageIds.push(id)
      else problems.push(`image "${f}" has not been uploaded to the media library`)
    }
    const documentIds: number[] = []
    for (const t of splitList(row.document_titles)) {
      const ids = docsByTitle.get(t.toLowerCase())
      if (!ids) problems.push(`document "${t}" not found`)
      else if (ids.length > 1) problems.push(`document title "${t}" is ambiguous`)
      else documentIds.push(ids[0]!)
    }

    if (problems.length) {
      fail(problems.join('; '), row.sku)
      if (opts.stopOnFirstError) break
      continue
    }

    const existing = await payload.find({
      collection: COLLECTIONS.products,
      where: { sku: { equals: row.sku } },
      limit: 1,
      depth: 0,
      draft: false,
      overrideAccess: true,
    })
    const current = existing.docs[0]

    const publishNow = opts.publish && row.status === 'published'
    const data: Record<string, unknown> = {
      sku: row.sku,
      name: row.name,
      summary: row.summary || undefined,
      category: categoryId ?? null,
      additionalCategories: extraCategoryIds,
      manufacturer: row.manufacturer || undefined,
      manufacturerPartNumber: row.manufacturer_part_number || undefined,
      unitOfMeasure: row.unit_of_measure || undefined,
      availability: row.availability,
      countryOfOrigin: row.country_of_origin || undefined,
      specifications: parseSpecifications(row.specifications).rows,
      attributes: attributeRows,
      documents: documentIds,
    }
    if (imageIds.length) data.images = imageIds.map((image) => ({ image }))
    // Only rewrite the rich-text description when the plain text actually changed (keeps formatting on round trips).
    if (!current || lexicalToText(current.description).trim() !== row.description) {
      data.description = row.description ? buildLexical(row.description.split(/\n{2,}/).map((text) => ({ type: 'p' as const, text }))) : null
    }
    if (!current) data.slug = slugify(`${row.name} ${row.sku}`)

    if (opts.dryRun) {
      if (current) report.updated += 1
      else report.created += 1
      continue
    }

    try {
      const payloadData = (publishNow ? { ...data, _status: 'published' } : data) as never
      if (current) {
        await payload.update({
          collection: COLLECTIONS.products,
          id: current.id,
          data: payloadData,
          draft: !publishNow,
          overrideAccess: true,
        })
        report.updated += 1
      } else {
        await payload.create({
          collection: COLLECTIONS.products,
          data: (publishNow ? payloadData : { ...data, _status: 'draft' }) as never,
          draft: !publishNow,
          overrideAccess: true,
        })
        report.created += 1
      }
    } catch (error) {
      fail(errorMessage(error), row.sku)
      if (opts.stopOnFirstError) break
    }
  }
  return report
}

/** Export every product (any status) as CSV text, UTF-8 with BOM, formula-safe. */
export async function exportProductsCsv(payload: Payload): Promise<string> {
  const [attrDefs, categories] = await Promise.all([
    payload.find({ collection: COLLECTIONS.attributes, limit: 500, pagination: false, depth: 0, overrideAccess: true, sort: 'sortOrder' }),
    payload.find({ collection: COLLECTIONS.categories, limit: 5000, pagination: false, depth: 0, overrideAccess: true }),
  ])
  const pathById = new Map(categories.docs.map((c) => [c.id, c.path]))
  const attrColumns = attrDefs.docs.map((d) => `${ATTR_PREFIX}${d.key}`)
  const headers = [...BASE_COLUMNS, ...attrColumns]
  const lines: string[][] = [headers]

  let page = 1
  for (;;) {
    const res = await payload.find({
      collection: COLLECTIONS.products,
      limit: 200,
      page,
      depth: 1,
      draft: false,
      overrideAccess: true,
      sort: 'sku',
    })
    for (const p of res.docs) {
      const attrs = new Map<string, string>()
      for (const a of p.attributes ?? []) {
        const def = typeof a.attribute === 'object' ? a.attribute : null
        if (def) attrs.set(`${ATTR_PREFIX}${def.key}`, a.value)
      }
      const cat = (v: unknown) => pathById.get(typeof v === 'object' && v ? (v as { id: number }).id : (v as number)) ?? ''
      const values: Record<string, string> = {
        sku: p.sku,
        name: p.name,
        status: p._status ?? 'draft',
        summary: p.summary ?? '',
        description: lexicalToText(p.description),
        category_path: cat(p.category),
        additional_category_paths: joinList((p.additionalCategories ?? []).map(cat).filter(Boolean)),
        manufacturer: p.manufacturer ?? '',
        manufacturer_part_number: p.manufacturerPartNumber ?? '',
        unit_of_measure: p.unitOfMeasure ?? '',
        availability: p.availability ?? 'available',
        country_of_origin: p.countryOfOrigin ?? '',
        specifications: formatSpecifications(p.specifications ?? []),
        image_filenames: joinList(
          (p.images ?? []).map((i) => (typeof i.image === 'object' ? (i.image.filename ?? '') : '')).filter(Boolean),
        ),
        document_titles: joinList(
          (p.documents ?? []).map((d) => (typeof d === 'object' ? d.title : '')).filter(Boolean),
        ),
      }
      lines.push(headers.map((h) => sanitizeCsvCell(h.startsWith(ATTR_PREFIX) ? (attrs.get(h) ?? '') : (values[h] ?? ''))))
    }
    if (!res.hasNextPage) break
    page += 1
  }
  return `\uFEFF${stringify(lines)}`
}

export function productTemplateCsv(): string {
  return `\uFEFF${stringify([
    [...TEMPLATE_HEADERS],
    [
      'EX-100',
      'Example product',
      'draft',
      'One or two sentence summary.',
      'Longer description. Separate paragraphs with a blank line.',
      'category-slug/sub-category-slug',
      '',
      'Example Manufacturer',
      'MPN-100',
      'EA',
      'available',
      '',
      'Material: Nitrile | Thickness: 4 mil',
      'example-image.png',
      'Example spec sheet',
      '',
    ],
  ])}`
}
