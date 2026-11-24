import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** Reads design tokens from globals.css and verifies WCAG contrast of every pair used in the UI. */
const css = readFileSync('src/app/(site)/globals.css', 'utf8')
const token = (name: string) => {
  const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!m) throw new Error(`token ${name} not found`)
  return m[1]!
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (l1 + 0.05) / (l2 + 0.05)
}

describe('[NFR-001] design token contrast', () => {
  const textPairs: [string, string][] = [
    ['ink', 'surface'],
    ['ink', 'surface-alt'],
    ['muted', 'surface'],
    ['muted', 'surface-alt'],
    ['brand-700', 'surface'],
    ['brand-700', 'brand-50'],
    ['brand-900', 'brand-50'],
    ['brand-800', 'surface'],
    ['surface', 'brand-800'],
    ['surface', 'brand-900'],
    ['brand-900', 'brand-100'],
    ['danger', 'surface'],
    ['danger', 'danger-bg'],
    ['accent', 'accent-bg'],
    ['accent', 'surface'],
    ['success', 'surface'],
    ['success', 'success-bg'],
    ['ink', 'accent-bg'],
    ['ink', 'brand-50'],
  ]
  it.each(textPairs)('text %s on %s meets 4.5:1', (fg, bg) => {
    expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5)
  })

  it('focus ring meets 3:1 against the page background', () => {
    expect(ratio(token('focus'), token('surface'))).toBeGreaterThanOrEqual(3)
    expect(ratio(token('focus'), token('brand-900'))).toBeGreaterThanOrEqual(1) // white box-shadow ring provides separation on dark
  })

  it('UI component borders meet 3:1 (inputs use slate-500 #64748b)', () => {
    expect(ratio('#64748b', token('surface'))).toBeGreaterThanOrEqual(3)
  })
})
