import type { PostgresSchemaHook } from '@payloadcms/drizzle/postgres'
import { sql } from '@payloadcms/db-postgres/drizzle'
import { customType, index } from '@payloadcms/db-postgres/drizzle/pg-core'

/** Postgres tsvector column type (not provided by drizzle). */
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector'
  },
})

/**
 * Extends the Payload-managed `search_documents` table with a weighted, generated tsvector
 * column and GIN indexes. Weights: A = sku + name, B = summary + manufacturer, C = body.
 * Because it is declared in the Drizzle schema, migrations and dev push keep it in sync.
 */
export const searchSchemaHook: PostgresSchemaHook = ({ schema, extendTable }) => {
  const table = schema.tables['search_documents']
  if (!table) return schema

  extendTable({
    table,
    columns: {
      tsv: tsvector('tsv').generatedAlwaysAs(
        sql`(
          setweight(to_tsvector('english', coalesce(sku, '') || ' ' || coalesce(name, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(summary, '') || ' ' || coalesce(manufacturer, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(body, '')), 'C')
        )`,
      ),
    },
    extraConfig: (cols) => ({
      search_documents_tsv_idx: index('search_documents_tsv_idx').using('gin', cols.tsv),
      search_documents_category_ids_idx: index('search_documents_category_ids_idx').using(
        'gin',
        cols.categoryIds,
      ),
    }),
  })
  return schema
}
