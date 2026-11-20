import { getPayloadClient } from '../src/lib/payload'
import { sql } from '@payloadcms/db-postgres/drizzle'

const payload = await getPayloadClient()
const res = (await payload.db.drizzle.execute(
  sql`select column_name, data_type, is_generated from information_schema.columns where table_name = 'search_documents' order by ordinal_position`,
)) as unknown as { rows: unknown[] }
console.log(JSON.stringify(res.rows))
const idx = (await payload.db.drizzle.execute(
  sql`select indexname from pg_indexes where tablename = 'search_documents'`,
)) as unknown as { rows: unknown[] }
console.log(JSON.stringify(idx.rows))
process.exit(0)
