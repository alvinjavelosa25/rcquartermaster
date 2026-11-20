import type { SearchParams } from './types'

export type RawSearchParams = Record<string, string | string[] | undefined>

export interface ParsedListing {
  q: string
  page: number
  sort: 'relevance' | 'name' | 'sku' | undefined
  attributes: Record<string, string[]>
  /** Category path from the `category` parameter (search page). */
  category: string
}

const KEY_RE = /^[a-z0-9_]{1,64}$/

const first = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
const all = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : [])

/** Parse and sanitise listing/search URL parameters. Unknown or malformed values are dropped. */
export function parseListingParams(raw: RawSearchParams): ParsedListing {
  const q = first(raw.q).replace(/\s+/g, ' ').trim().slice(0, 200)
  const pageNum = Number.parseInt(first(raw.page), 10)
  const page = Number.isFinite(pageNum) && pageNum >= 1 ? Math.min(pageNum, 1000) : 1
  const sortRaw = first(raw.sort)
  const sort =
    sortRaw === 'relevance' || sortRaw === 'name' || sortRaw === 'sku' ? sortRaw : undefined
  const attributes: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith('attr.')) continue
    const attrKey = key.slice(5)
    if (!KEY_RE.test(attrKey)) continue
    const values = all(value)
      .map((v) => v.trim().slice(0, 200))
      .filter(Boolean)
      .slice(0, 20)
    if (values.length) attributes[attrKey] = values
  }
  const category = first(raw.category)
    .replace(/[^a-z0-9/-]/gi, '')
    .split('/')
    .filter((s) => s && s !== '.' && s !== '..')
    .join('/')
    .slice(0, 200)
  return { q, page, sort, attributes, category }
}

/** Build a query string from parsed params (stable ordering so URLs are canonical). */
export function buildListingQuery(p: Partial<ParsedListing> & { page?: number }): string {
  const sp = new URLSearchParams()
  if (p.q) sp.set('q', p.q)
  if (p.category) sp.set('category', p.category)
  if (p.sort) sp.set('sort', p.sort)
  for (const key of Object.keys(p.attributes ?? {}).sort()) {
    for (const v of p.attributes![key]!) sp.append(`attr.${key}`, v)
  }
  if (p.page && p.page > 1) sp.set('page', String(p.page))
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export function toSearchParams(p: ParsedListing, categoryId?: number): SearchParams {
  return { q: p.q, page: p.page, sort: p.sort, attributes: p.attributes, categoryId }
}
