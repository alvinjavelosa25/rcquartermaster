import { describe, expect, it } from 'vitest'
import {
  CsvFormatError,
  formatSpecifications,
  parseCsvText,
  parseSpecifications,
  sanitizeCsvCell,
  unsanitizeCsvCell,
  validateRow,
} from '@/lib/csv/products'

describe('[FR-019][FR-020] CSV helpers', () => {
  it('UT-043 neutralises spreadsheet formulas and reverses it on import', () => {
    for (const v of ['=SUM(A1)', '+1', '-5', '@cmd', '\tx', '\rx']) {
      const safe = sanitizeCsvCell(v)
      expect(safe.startsWith("'")).toBe(true)
      expect(unsanitizeCsvCell(safe)).toBe(v)
    }
    expect(sanitizeCsvCell('Normal text')).toBe('Normal text')
    expect(sanitizeCsvCell(null)).toBe('')
    expect(unsanitizeCsvCell("'quoted")).toBe("'quoted")
  })

  it('parses BOM, CRLF and quoted commas', () => {
    const csv = '\uFEFFsku,name,summary\r\nA-1,"Gloves, nitrile","Say ""hi"""\r\n'
    const { rows } = parseCsvText(csv)
    expect(rows).toEqual([{ sku: 'A-1', name: 'Gloves, nitrile', summary: 'Say "hi"' }])
  })

  it('rejects missing required columns, unknown columns and bad CSV', () => {
    expect(() => parseCsvText('name\nx\n')).toThrow(CsvFormatError)
    expect(() => parseCsvText('sku,name,bogus\nA,B,C\n')).toThrow(/Unknown column/)
    expect(() => parseCsvText('sku,name\n"A,B\n')).toThrow(CsvFormatError)
  })

  it('accepts attr.* columns', () => {
    const { headers } = parseCsvText('sku,name,attr.size\nA,B,M\n')
    expect(headers).toContain('attr.size')
  })

  it('validates rows and reports readable errors', () => {
    const ok = validateRow({
      sku: ' ab-1 ',
      name: 'Thing',
      status: 'PUBLISHED',
      'attr.size': 'M',
      availability: '',
    })
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.row.sku).toBe('AB-1')
      expect(ok.row.status).toBe('published')
      expect(ok.row.availability).toBe('available')
      expect(ok.row.attributes).toEqual({ size: 'M' })
    }
    const bad = validateRow({ sku: '', name: '', status: 'maybe' })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors.join(' ')).toMatch(/SKU is required/)
    const longSummary = validateRow({ sku: 'A', name: 'B', summary: 'x'.repeat(301) })
    expect(longSummary.ok).toBe(false)
  })

  it('parses and formats specifications and reports malformed entries', () => {
    expect(parseSpecifications('Material: Nitrile | Thickness: 4 mil').rows).toEqual([
      { label: 'Material', value: 'Nitrile' },
      { label: 'Thickness', value: '4 mil' },
    ])
    expect(parseSpecifications('no colon here').invalid).toEqual(['no colon here'])
    expect(formatSpecifications([{ label: 'Width', value: '21', unit: 'in' }])).toBe('Width: 21 in')
    const bad = validateRow({ sku: 'A', name: 'B', specifications: 'broken' })
    expect(bad.ok).toBe(false)
  })

  it('round-trips a specification string', () => {
    const s = 'Material: Nitrile | Thickness: 4 mil'
    expect(formatSpecifications(parseSpecifications(s).rows)).toBe(s)
  })
})
