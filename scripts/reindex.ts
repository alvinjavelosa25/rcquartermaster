/**
 * Rebuild the search index from published products: `npm run reindex`
 * Run after restoring a backup, importing in bulk with hooks disabled, or changing search weights.
 */
import { getPayloadClient } from '../src/lib/payload'
import { getSearchIndexer } from '../src/lib/search'

const payload = await getPayloadClient()
const started = Date.now()
const count = await getSearchIndexer(payload).reindexAll({
  onProgress: (n) => {
    if (n % 100 === 0) console.log(`indexed ${n}...`)
  },
})
console.log(
  `Reindexed ${count} published products in ${((Date.now() - started) / 1000).toFixed(1)}s`,
)
process.exit(0)
