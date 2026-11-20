import { describe, expect, it } from 'vitest'
import {
  detectKind,
  sanitizeFilename,
  validateBatch,
  validateDeclaredFile,
  verifyMagic,
  type AttachmentLimits,
} from '@/lib/rfq/attachments'

const limits: AttachmentLimits = {
  maxFiles: 5,
  maxFileBytes: 10 * 1024 * 1024,
  maxTotalBytes: 25 * 1024 * 1024,
}
const bytes = (...b: number[]) => new Uint8Array(b)
const ascii = (s: string) => new TextEncoder().encode(s)

describe('[FR-038] declared file validation (ATT-01..ATT-09)', () => {
  it('accepts allowed types within limits', () => {
    for (const [name, type] of [
      ['a.pdf', 'application/pdf'],
      ['a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['a.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ['a.csv', 'text/csv'],
      ['a.PNG', 'image/png'],
      ['a.jpg', 'image/jpeg'],
    ]) {
      expect(
        validateDeclaredFile({ filename: name!, size: 1000, contentType: type! }, limits).ok,
      ).toBe(true)
    }
  })

  it('ATT-02 enforces the size limit exactly', () => {
    expect(
      validateDeclaredFile(
        { filename: 'a.pdf', size: limits.maxFileBytes, contentType: 'application/pdf' },
        limits,
      ).ok,
    ).toBe(true)
    expect(
      validateDeclaredFile(
        { filename: 'a.pdf', size: limits.maxFileBytes + 1, contentType: 'application/pdf' },
        limits,
      ).ok,
    ).toBe(false)
  })

  it('ATT-04 rejects empty files', () => {
    expect(
      validateDeclaredFile({ filename: 'a.pdf', size: 0, contentType: 'application/pdf' }, limits)
        .ok,
    ).toBe(false)
  })

  it('ATT-05 rejects dangerous and unlisted extensions', () => {
    for (const n of [
      'a.exe',
      'a.js',
      'a.sh',
      'a.bat',
      'a.html',
      'a.svg',
      'a.zip',
      'a.docm',
      'a.xlsm',
      'noextension',
      'a.',
    ]) {
      expect(validateDeclaredFile({ filename: n, size: 10, contentType: '' }, limits).ok, n).toBe(
        false,
      )
    }
  })

  it('ATT-07 rejects a declared type that does not match the extension', () => {
    expect(
      validateDeclaredFile({ filename: 'a.pdf', size: 10, contentType: 'image/png' }, limits).ok,
    ).toBe(false)
    expect(
      validateDeclaredFile(
        { filename: 'a.pdf', size: 10, contentType: 'application/octet-stream' },
        limits,
      ).ok,
    ).toBe(true)
  })

  it('ATT-08 rejects double extensions with a dangerous inner extension', () => {
    expect(
      validateDeclaredFile(
        { filename: 'report.exe.pdf', size: 10, contentType: 'application/pdf' },
        limits,
      ).ok,
    ).toBe(false)
    expect(
      validateDeclaredFile({ filename: 'report.pdf.exe', size: 10, contentType: '' }, limits).ok,
    ).toBe(false)
    expect(
      validateDeclaredFile(
        { filename: 'v1.2.final.pdf', size: 10, contentType: 'application/pdf' },
        limits,
      ).ok,
    ).toBe(true)
  })

  it('ATT-03 enforces count and total size', () => {
    expect(validateBatch([1, 1, 1, 1, 1, 1], limits)).toMatch(/at most 5/)
    expect(validateBatch([20 * 1024 * 1024, 10 * 1024 * 1024], limits)).toMatch(/total/)
    expect(validateBatch([1, 2], limits)).toBeNull()
  })
})

describe('sanitizeFilename (ATT-09)', () => {
  it('strips paths, control and bidi characters', () => {
    expect(sanitizeFilename('../../etc/passwd.pdf')).toBe('passwd.pdf')
    expect(sanitizeFilename('C:\\temp\\x.pdf')).toBe('x.pdf')
    expect(sanitizeFilename('inv\u202eoice.pdf')).toBe('invoice.pdf')
    expect(sanitizeFilename('   ...  ')).toBe('file')
    expect(sanitizeFilename('a'.repeat(500) + '.pdf').length).toBeLessThanOrEqual(200)
  })
})

describe('magic byte verification (ATT-06)', () => {
  it('detects PDF, PNG, JPEG, OLE, ZIP and text', () => {
    expect(detectKind(ascii('%PDF-1.7 ...'))).toBe('pdf')
    expect(detectKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('png')
    expect(detectKind(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg')
    expect(detectKind(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1))).toBe('ole')
    expect(detectKind(bytes(0x50, 0x4b, 0x03, 0x04, 0))).toBe('zip')
    expect(detectKind(ascii('sku,qty\nA,1\n'))).toBe('text')
    expect(detectKind(bytes(0x4d, 0x5a, 0x90, 0x00, 0x03))).toBeNull() // Windows executable "MZ"
  })

  it('rejects an executable renamed to .pdf', () => {
    expect(verifyMagic('pdf', bytes(0x4d, 0x5a, 0x90, 0x00, 0x03, 0, 0, 0)).ok).toBe(false)
  })

  it('rejects text with NUL bytes as csv', () => {
    expect(verifyMagic('csv', bytes(0x61, 0x2c, 0x00, 0x62)).ok).toBe(false)
    expect(verifyMagic('csv', ascii('a,b\n1,2\n')).ok).toBe(true)
  })

  it('accepts OOXML-looking zips and refuses macro containers', () => {
    const ok = new Uint8Array([
      0x50,
      0x4b,
      0x03,
      0x04,
      ...ascii('[Content_Types].xml word/document.xml'),
    ])
    expect(verifyMagic('docx', ok).ok).toBe(true)
    const macro = new Uint8Array([
      0x50,
      0x4b,
      0x03,
      0x04,
      ...ascii('[Content_Types].xml word/vbaProject.bin'),
    ])
    expect(verifyMagic('docx', macro).ok).toBe(false)
    const plainZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...ascii('evil.exe')])
    expect(verifyMagic('xlsx', plainZip).ok).toBe(false)
  })

  it('rejects a mismatch between extension and content', () => {
    expect(verifyMagic('png', ascii('%PDF-1.4')).ok).toBe(false)
    expect(verifyMagic('exe', ascii('%PDF-1.4')).ok).toBe(false)
  })
})
