/**
 * CSV product import: `npm run import:csv -- path/to/products.csv [dry-run] [publish] [stop-on-error]`
 * Upserts by SKU. Rows are saved as drafts unless `publish` is given AND the row has status=published.
 * Options are bare words (the Payload CLI strips --flags); IMPORT_DRY_RUN=1, IMPORT_PUBLISH=1 and
 * IMPORT_STOP_ON_ERROR=1 environment variables work too. Prints a per-row error report.
 * Exit code 1 when any row failed.
 */
import { readFile } from 'node:fs/promises'
import { MAX_IMPORT_ROWS } from '../src/lib/csv/products'
import { importProductsCsv } from '../src/lib/csv/import-export'
import { getPayloadClient } from '../src/lib/payload'

const args = process.argv.slice(2).filter((a) => a !== '--')
const flag = (word: string, env: string) =>
  args.includes(word) || args.includes(`--${word}`) || process.env[env] === '1'
const file = args.find(
  (a) => !a.startsWith('--') && !['dry-run', 'publish', 'stop-on-error'].includes(a),
)
if (!file) {
  console.error('Usage: npm run import:csv -- <file.csv> [dry-run] [publish] [stop-on-error]')
  process.exit(2)
}

const payload = await getPayloadClient()
const text = await readFile(file, 'utf8')
const report = await importProductsCsv(payload, text, {
  dryRun: flag('dry-run', 'IMPORT_DRY_RUN'),
  publish: flag('publish', 'IMPORT_PUBLISH'),
  stopOnFirstError: flag('stop-on-error', 'IMPORT_STOP_ON_ERROR'),
  maxRows: MAX_IMPORT_ROWS,
})

console.log(
  `${report.dryRun ? '[dry run] ' : ''}rows: ${report.total}, created: ${report.created}, updated: ${report.updated}, failed: ${report.failed}`,
)
if (report.fatal) console.error(report.fatal)
for (const e of report.errors)
  console.error(`  row ${e.row}${e.sku ? ` (${e.sku})` : ''}: ${e.message}`)
process.exit(report.fatal || report.failed ? 1 : 0)
