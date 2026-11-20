import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getEnv } from '@/env'
import { lexicalToText, buildLexical } from '@/lib/richtext'
import { validateAttributeValue } from '@/lib/attributes'

const redirects = JSON.parse(readFileSync('src/config/redirects.json', 'utf8')) as {
  redirects: { source: string; destination: string }[]
}

describe('[FR-068][UT-052] redirect map', () => {
  it('has the expected shape and only relative paths', () => {
    expect(Array.isArray(redirects.redirects)).toBe(true)
    for (const r of redirects.redirects) {
      expect(r.source.startsWith('/')).toBe(true)
      expect(r.destination.startsWith('/') || /^https:\/\//.test(r.destination)).toBe(true)
    }
  })
  it('has no duplicate sources, self-redirects, loops or chains', () => {
    const sources = new Map(redirects.redirects.map((r) => [r.source, r.destination]))
    expect(sources.size).toBe(redirects.redirects.length)
    for (const [source, destination] of sources) {
      expect(destination).not.toBe(source)
      expect(sources.has(destination), `${source} -> ${destination} is a chain`).toBe(false)
    }
  })
})

describe('[UT-053] environment validation', () => {
  const ok = { DATABASE_URI: 'postgres://x', PAYLOAD_SECRET: 'x'.repeat(32) }
  it('accepts a minimal development environment and applies defaults', () => {
    const env = getEnv({ ...ok })
    expect(env.RFQ_MAX_FILES).toBe(5)
    expect(env.STORAGE_DRIVER).toBe('local')
    expect(env.SITE_ENV_RESOLVED).toBe('development')
  })
  it('fails fast with readable messages', () => {
    expect(() => getEnv({})).toThrow(/DATABASE_URI/)
    expect(() => getEnv({ ...ok, PAYLOAD_SECRET: 'short' })).toThrow(/at least 32/)
  })
  it('requires S3 settings when STORAGE_DRIVER=s3', () => {
    expect(() => getEnv({ ...ok, STORAGE_DRIVER: 's3' })).toThrow(/S3_ENDPOINT/)
  })
  it('production forbids local storage and requires salts, cron secret and Turnstile secret', () => {
    expect(() => getEnv({ ...ok, SITE_ENV: 'production' })).toThrow(
      /STORAGE_DRIVER=local is not allowed/,
    )
    expect(() =>
      getEnv({
        ...ok,
        SITE_ENV: 'production',
        STORAGE_DRIVER: 's3',
        S3_ENDPOINT: 'https://x',
        S3_ACCESS_KEY_ID: 'a',
        S3_SECRET_ACCESS_KEY: 'b',
        S3_PUBLIC_BUCKET: 'p',
        S3_PRIVATE_BUCKET: 'q',
      }),
    ).toThrow(/IP_HASH_SALT/)
  })
  it('treats empty strings as unset', () => {
    expect(getEnv({ ...ok, S3_REGION: '', RFQ_MAX_FILES: '' }).S3_REGION).toBe('auto')
  })
  it('derives preview from VERCEL_ENV', () => {
    expect(getEnv({ ...ok, VERCEL_ENV: 'preview' }).SITE_ENV_RESOLVED).toBe('preview')
  })
})

describe('rich text helpers', () => {
  it('extracts plain text from built Lexical state', () => {
    const state = buildLexical([
      { type: 'h2', text: 'Title' },
      { type: 'p', text: 'First paragraph.' },
      { type: 'ul', items: ['One', 'Two'] },
    ])
    expect(lexicalToText(state)).toBe('Title\nFirst paragraph.\nOne\nTwo')
    expect(lexicalToText(null)).toBe('')
  })
})

describe('[FR-010] attribute value validation', () => {
  it('validates by type', () => {
    expect(validateAttributeValue({ type: 'number' }, '12.5')).toBeNull()
    expect(validateAttributeValue({ type: 'number', label: 'Qty' }, 'abc')).toMatch(
      /Qty must be a number/,
    )
    expect(validateAttributeValue({ type: 'boolean' }, 'true')).toBeNull()
    expect(validateAttributeValue({ type: 'boolean' }, 'yes')).not.toBeNull()
    expect(validateAttributeValue({ type: 'enum', options: ['S', 'M'] }, 'M')).toBeNull()
    expect(validateAttributeValue({ type: 'enum', options: ['S', 'M'] }, 'XL')).toMatch(
      /one of: S, M/,
    )
    expect(validateAttributeValue({ type: 'text' }, '')).not.toBeNull()
    expect(validateAttributeValue({ type: 'text' }, 'x'.repeat(201))).not.toBeNull()
  })
})
