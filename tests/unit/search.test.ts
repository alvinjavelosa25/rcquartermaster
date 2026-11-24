import { describe, expect, it } from 'vitest'
import { buildListingQuery, parseListingParams } from '@/lib/search/params'
import { escapeLike, normalizeQuery, trigramThreshold } from '@/lib/search/postgres'
import { collectCategoryIds } from '@/lib/search/indexer'

describe('[FR-012] listing URL parameters', () => {
  it('parses q, page, sort and attribute filters', () => {
    const p = parseListingParams({
      q: '  nitrile   gloves ',
      page: '3',
      sort: 'sku',
      'attr.size': ['M', 'L'],
      'attr.material': 'Nitrile',
      category: 'ppe/gloves',
    })
    expect(p).toEqual({
      q: 'nitrile gloves',
      page: 3,
      sort: 'sku',
      attributes: { size: ['M', 'L'], material: ['Nitrile'] },
      category: 'ppe/gloves',
    })
  })

  it('drops malformed values', () => {
    const p = parseListingParams({
      page: '-4',
      sort: 'drop table',
      'attr.BAD KEY': 'x',
      'attr.ok': '',
      category: '../../etc',
    })
    expect(p.page).toBe(1)
    expect(p.sort).toBeUndefined()
    expect(p.attributes).toEqual({})
    expect(p.category).toBe('etc')
  })

  it('caps page and query length', () => {
    expect(parseListingParams({ page: '999999' }).page).toBe(1000)
    expect(parseListingParams({ q: 'x'.repeat(500) }).q).toHaveLength(200)
  })

  it('builds canonical, stable query strings', () => {
    const q = buildListingQuery({
      q: 'a b',
      attributes: { size: ['M'], color: ['Red', 'Blue'] },
      page: 2,
    })
    expect(q).toBe('?q=a+b&attr.color=Red&attr.color=Blue&attr.size=M&page=2')
    expect(buildListingQuery({ page: 1 })).toBe('')
  })
})

describe('[UT-013] search query hygiene', () => {
  it('normalises whitespace and length', () => {
    expect(normalizeQuery('  a   b ')).toBe('a b')
    expect(normalizeQuery(undefined)).toBe('')
    expect(normalizeQuery('x'.repeat(300))).toHaveLength(200)
  })

  it('escapes LIKE metacharacters', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\')
  })

  it('uses a stricter trigram threshold for short queries', () => {
    expect(trigramThreshold('abcd')).toBeGreaterThan(trigramThreshold('abcdefgh'))
  })
})

describe('[FR-002] category ancestry for indexing', () => {
  const parents: Record<number, number | null> = { 3: 2, 2: 1, 1: null }
  it('collects a category and all ancestors', () => {
    expect(collectCategoryIds(3, (id) => parents[id])).toEqual([3, 2, 1])
  })
  it('stops on cycles', () => {
    expect(collectCategoryIds(1, (id) => ({ 1: 2, 2: 1 })[id as 1 | 2])).toEqual([1, 2])
  })
})
