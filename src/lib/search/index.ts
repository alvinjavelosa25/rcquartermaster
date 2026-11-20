import type { Payload, PayloadRequest } from 'payload'
import { getEnv } from '@/env'
import type { FilterableAttribute, SearchIndexer, SearchService } from './types'
import { PayloadSearchIndexer } from './indexer'
import { PostgresSearchService } from './postgres'
import { COLLECTIONS } from '@/lib/constants'

export type { SearchParams, SearchResult, SearchHit, SearchService, SearchIndexer } from './types'

export async function loadFilterableAttributes(payload: Payload): Promise<FilterableAttribute[]> {
  const res = await payload.find({
    collection: COLLECTIONS.attributes,
    where: { filterable: { equals: true } },
    sort: 'sortOrder',
    limit: 100,
    depth: 0,
    overrideAccess: true,
    pagination: false,
  })
  return res.docs.map((d) => ({
    key: d.key,
    label: d.label,
    unit: d.unit ?? undefined,
    type: d.type,
    options: d.options?.map((o) => ({ value: o.value, label: o.label })),
  }))
}

/** Factory: the only place that knows which provider is configured. */
export function getSearchService(payload: Payload): SearchService {
  switch (getEnv().SEARCH_PROVIDER) {
    case 'postgres':
    default:
      return new PostgresSearchService(payload, () => loadFilterableAttributes(payload))
  }
}

export function getSearchIndexer(payload: Payload, req?: PayloadRequest): SearchIndexer {
  return new PayloadSearchIndexer(payload, req)
}
