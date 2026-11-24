export interface SearchParams {
  /** Free-text query. Empty means "list everything" (category browsing). */
  q?: string
  /** Category id. Matches the category and all of its descendants. */
  categoryId?: number
  /** Attribute filters: key -> accepted values (OR within a key, AND across keys). */
  attributes?: Record<string, string[]>
  sort?: 'relevance' | 'name' | 'sku'
  page?: number
  pageSize?: number
}

export interface SearchHit {
  productId: number
  sku: string
  name: string
  slug: string
  summary: string
  availability: string
  manufacturer: string
  categoryName: string
  categoryPath: string
  image: { url: string; alt: string; width?: number; height?: number } | null
}

export interface FacetValue {
  value: string
  label: string
  count: number
  selected: boolean
}

export interface AttributeFacet {
  key: string
  label: string
  unit?: string
  values: FacetValue[]
}

export interface CategoryFacetValue {
  id: number
  count: number
}

export interface SearchResult {
  hits: SearchHit[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  /** Counts of matching products per category id (ancestors included), ignoring the category filter. */
  categoryCounts: CategoryFacetValue[]
  attributeFacets: AttributeFacet[]
  tookMs: number
}

/** Query side. Implementations: PostgresSearchService (launch), Meilisearch/Algolia (later). */
export interface SearchService {
  search(params: SearchParams): Promise<SearchResult>
}

/** Write side: keeps the search index in sync with published catalogue content. */
export interface SearchIndexer {
  /** Re-read the published product and index it, or remove it when it is not published. */
  sync(productId: number | string): Promise<void>
  remove(productId: number | string): Promise<void>
  reindexAll(opts?: { batchSize?: number; onProgress?: (done: number) => void }): Promise<number>
}

export interface FilterableAttribute {
  key: string
  label: string
  unit?: string
  type: 'text' | 'number' | 'boolean' | 'enum'
  options?: { value: string; label: string }[]
  categoryIds?: number[]
}
