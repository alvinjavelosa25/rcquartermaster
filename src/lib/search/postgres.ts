import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres/drizzle'
import type { SQL } from '@payloadcms/db-postgres/drizzle'
import { PAGE_SIZE } from '@/lib/constants'
import type {
  AttributeFacet,
  FilterableAttribute,
  SearchHit,
  SearchParams,
  SearchResult,
  SearchService,
} from './types'

const MAX_Q = 200
const KEY_RE = /^[a-z0-9_]{1,64}$/

export const normalizeQuery = (q: string | undefined): string =>
  (q ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_Q)

export const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`)

/** Longer queries tolerate more typos; short ones must be close matches to avoid noise. */
export const trigramThreshold = (q: string): number => (q.length >= 6 ? 0.3 : 0.5)

type Row = Record<string, unknown>

/**
 * Postgres full-text search implementation of SearchService.
 * Reads the denormalised `search_documents` table (see src/lib/search/schema.ts).
 * Everything is parameterised; the attribute key is validated and also bound as a parameter.
 */
export class PostgresSearchService implements SearchService {
  private trigram: boolean | undefined

  constructor(
    private readonly payload: Payload,
    private readonly loadAttributes: () => Promise<FilterableAttribute[]>,
  ) {}

  private async run(query: SQL): Promise<Row[]> {
    const res = (await this.payload.db.drizzle.execute(query)) as unknown as { rows: Row[] }
    return res.rows
  }

  private async hasTrigram(): Promise<boolean> {
    if (this.trigram === undefined) {
      const rows = await this.run(sql`SELECT 1 AS ok FROM pg_extension WHERE extname = 'pg_trgm'`)
      this.trigram = rows.length > 0
    }
    return this.trigram
  }

  private where(
    p: Required<Pick<SearchParams, 'q'>> & SearchParams,
    trigram: boolean,
    skip: { category?: boolean; attribute?: string } = {},
  ): SQL {
    const parts: SQL[] = [sql`true`]
    const q = normalizeQuery(p.q)
    if (q) {
      const prefix = `${escapeLike(q)}%`
      const alternatives: SQL[] = [
        sql`d.tsv @@ websearch_to_tsquery('english', ${q})`,
        sql`upper(d.sku) = upper(${q})`,
        sql`d.sku ILIKE ${prefix}`,
      ]
      if (trigram && q.length >= 4) {
        alternatives.push(sql`word_similarity(${q}, d.name) >= ${trigramThreshold(q)}`)
        alternatives.push(sql`similarity(d.sku, ${q}) >= 0.5`)
      }
      parts.push(sql`(${sql.join(alternatives, sql` OR `)})`)
    }
    if (p.categoryId && !skip.category) {
      parts.push(sql`d.category_ids @> ${JSON.stringify([p.categoryId])}::jsonb`)
    }
    for (const [key, values] of Object.entries(p.attributes ?? {})) {
      if (!KEY_RE.test(key) || values.length === 0 || key === skip.attribute) continue
      const list = sql.join(
        values.slice(0, 50).map((v) => sql`${v}`),
        sql`, `,
      )
      parts.push(sql`d.attributes ->> ${key} IN (${list})`)
    }
    return sql.join(parts, sql` AND `)
  }

  /**
   * Exact matching first (full text, SKU exact/prefix). Only when that finds nothing do we retry with
   * trigram similarity, so typo tolerance never adds noise to queries that already have real matches.
   */
  async search(params: SearchParams): Promise<SearchResult> {
    const started = Date.now()
    const q = normalizeQuery(params.q)
    const first = await this.execute(params, false)
    if (first.total > 0 || q.length < 4 || !(await this.hasTrigram()))
      return { ...first, tookMs: Date.now() - started }
    const fuzzy = await this.execute(params, true)
    return { ...fuzzy, tookMs: Date.now() - started }
  }

  private async execute(params: SearchParams, trigram: boolean): Promise<SearchResult> {
    const started = Date.now()
    const q = normalizeQuery(params.q)
    const pageSize = Math.min(Math.max(params.pageSize ?? PAGE_SIZE, 1), 100)
    const page = Math.max(params.page ?? 1, 1)
    const p = { ...params, q }

    const sort = params.sort ?? (q ? 'relevance' : 'name')
    const score: SQL = q
      ? sql`(
          ts_rank_cd(d.tsv, websearch_to_tsquery('english', ${q}), 32)
          + CASE WHEN upper(d.sku) = upper(${q}) THEN 100 ELSE 0 END
          + CASE WHEN d.sku ILIKE ${`${escapeLike(q)}%`} THEN 10 ELSE 0 END
          ${trigram && q.length >= 4 ? sql`+ word_similarity(${q}, d.name) * 0.5` : sql``}
        )`
      : sql`0`
    const orderBy =
      sort === 'relevance' && q
        ? sql`${score} DESC, lower(d.name) ASC, d.id ASC`
        : sort === 'sku'
          ? sql`d.sku ASC, d.id ASC`
          : sql`lower(d.name) ASC, d.id ASC`

    const where = this.where(p, trigram)
    const attributes = await this.loadAttributes()

    const [countRows, hitRows, categoryRows, attributeFacets] = await Promise.all([
      this.run(sql`SELECT count(*)::int AS total FROM search_documents d WHERE ${where}`),
      this.run(sql`
        SELECT d.product_id, d.sku, d.name, d.slug, d.summary, d.availability, d.manufacturer,
               d.category_name, d.category_path, d.image
        FROM search_documents d
        WHERE ${where}
        ORDER BY ${orderBy}
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `),
      this.run(sql`
        SELECT c.value::int AS id, count(*)::int AS count
        FROM search_documents d, jsonb_array_elements_text(d.category_ids) AS c(value)
        WHERE ${this.where(p, trigram, { category: true })}
        GROUP BY c.value
      `),
      this.facets(p, trigram, attributes),
    ])

    const total = Number(countRows[0]?.total ?? 0)
    const hits: SearchHit[] = hitRows.map((r) => ({
      productId: Number(r.product_id),
      sku: String(r.sku),
      name: String(r.name),
      slug: String(r.slug),
      summary: String(r.summary ?? ''),
      availability: String(r.availability ?? 'available'),
      manufacturer: String(r.manufacturer ?? ''),
      categoryName: String(r.category_name ?? ''),
      categoryPath: String(r.category_path ?? ''),
      image: (r.image as SearchHit['image']) ?? null,
    }))

    return {
      hits,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      categoryCounts: categoryRows.map((r) => ({ id: Number(r.id), count: Number(r.count) })),
      attributeFacets,
      tookMs: Date.now() - started,
    }
  }

  private async facets(
    p: Required<Pick<SearchParams, 'q'>> & SearchParams,
    trigram: boolean,
    defs: FilterableAttribute[],
  ): Promise<AttributeFacet[]> {
    const usable = defs.filter((d) => KEY_RE.test(d.key))
    const results = await Promise.all(
      usable.map(async (def) => {
        const rows = await this.run(sql`
          SELECT d.attributes ->> ${def.key} AS value, count(*)::int AS count
          FROM search_documents d
          WHERE ${this.where(p, trigram, { attribute: def.key })}
            AND d.attributes ->> ${def.key} IS NOT NULL
          GROUP BY 1
          ORDER BY 2 DESC, 1 ASC
          LIMIT 30
        `)
        const selected = new Set(p.attributes?.[def.key] ?? [])
        const labelFor = (v: string) => def.options?.find((o) => o.value === v)?.label ?? v
        const facet: AttributeFacet = {
          key: def.key,
          label: def.label,
          unit: def.unit,
          values: rows.map((r) => ({
            value: String(r.value),
            label: labelFor(String(r.value)),
            count: Number(r.count),
            selected: selected.has(String(r.value)),
          })),
        }
        return facet
      }),
    )
    return results.filter((f) => f.values.length > 0)
  }
}
