import { describe, expect, it } from 'vitest'
import { buildCategoryPath, depthOfPath, normalizeSku, slugify } from '@/lib/slug'

describe('slug helpers', () => {
  it('[FR-004] normalises SKUs: trim, collapse whitespace, uppercase', () => {
    expect(normalizeSku('  ab-12 ')).toBe('AB-12')
    expect(normalizeSku('gl  v 1')).toBe('GL-V-1')
  })

  it('slugify handles accents, ampersands and punctuation', () => {
    expect(slugify('Masks & Eye Protection')).toBe('masks-and-eye-protection')
    expect(slugify('  Café  Crème! ')).toBe('cafe-creme')
    expect(slugify('---')).toBe('')
  })

  it('[FR-001] builds hierarchical category paths', () => {
    expect(buildCategoryPath(null, 'gloves')).toBe('gloves')
    expect(buildCategoryPath('ppe', 'gloves')).toBe('ppe/gloves')
    expect(depthOfPath('a/b/c')).toBe(3)
  })
})
