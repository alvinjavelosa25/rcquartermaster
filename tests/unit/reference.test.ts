import { describe, expect, it } from 'vitest'
import { REFERENCE_RE, generateReference } from '@/lib/rfq/reference'

describe('[FR-040] RFQ reference numbers', () => {
  it('uses the RCQ-YYYYMM-XXXXXX format', () => {
    const ref = generateReference(new Date(Date.UTC(2026, 10, 20)))
    expect(ref).toMatch(REFERENCE_RE)
    expect(ref.startsWith('RCQ-202611-')).toBe(true)
  })

  it('does not collide across a realistic volume and avoids look-alike characters', () => {
    // 6 characters of base32 give about 1e9 values per month; the service also checks the database and retries.
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) seen.add(generateReference())
    expect(seen.size).toBe(500)
    for (let i = 0; i < 5000; i++) expect(generateReference().slice(11)).not.toMatch(/[ILOU]/)
  })

  it('rejects malformed references', () => {
    for (const bad of ['RCQ-202611-ABC', 'rcq-202611-ABCDEF', 'RCQ-202611-ABCDEI', '<script>']) {
      expect(REFERENCE_RE.test(bad), bad).toBe(false)
    }
  })
})
