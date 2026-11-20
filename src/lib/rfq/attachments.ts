/**
 * Attachment rules for RFQ uploads. Pure functions, no I/O, fully unit tested.
 * Policy: allow-list of extensions, declared MIME check, magic-byte check on the stored object.
 */

export type FileKind = 'pdf' | 'ole' | 'zip' | 'png' | 'jpeg' | 'text'

interface AllowedType {
  /** Acceptable declared Content-Type values (lowercase). */
  mime: string[]
  /** Content-Type used for the presigned upload. */
  uploadType: string
  kind: FileKind
}

export const ALLOWED_ATTACHMENTS: Record<string, AllowedType> = {
  pdf: { mime: ['application/pdf'], uploadType: 'application/pdf', kind: 'pdf' },
  doc: { mime: ['application/msword'], uploadType: 'application/msword', kind: 'ole' },
  docx: {
    mime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    uploadType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    kind: 'zip',
  },
  xls: { mime: ['application/vnd.ms-excel'], uploadType: 'application/vnd.ms-excel', kind: 'ole' },
  xlsx: {
    mime: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    uploadType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    kind: 'zip',
  },
  csv: {
    mime: ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/csv'],
    uploadType: 'text/csv',
    kind: 'text',
  },
  txt: { mime: ['text/plain'], uploadType: 'text/plain', kind: 'text' },
  png: { mime: ['image/png'], uploadType: 'image/png', kind: 'png' },
  jpg: { mime: ['image/jpeg'], uploadType: 'image/jpeg', kind: 'jpeg' },
  jpeg: { mime: ['image/jpeg'], uploadType: 'image/jpeg', kind: 'jpeg' },
}

/** Extensions that must never be accepted, even as an inner extension (for example "a.exe.pdf" is checked too). */
const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'dll', 'bat', 'cmd', 'com', 'scr', 'msi', 'ps1', 'psm1', 'vbs', 'vbe', 'js', 'jse', 'mjs',
  'wsf', 'wsh', 'jar', 'sh', 'bash', 'zsh', 'app', 'apk', 'dmg', 'iso', 'lnk', 'reg', 'hta', 'html',
  'htm', 'xhtml', 'svg', 'swf', 'php', 'py', 'rb', 'pl', 'docm', 'xlsm', 'pptm', 'dotm', 'xlam',
  'zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2',
])

export interface AttachmentLimits {
  maxFiles: number
  maxFileBytes: number
  maxTotalBytes: number
}

export type ValidationResult = { ok: true; ext: string; uploadType: string } | { ok: false; error: string }

/** Remove path parts, control/bidi characters and collapse whitespace. For display only; never used as a storage key. */
export function sanitizeFilename(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? ''
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+/, '')
    .replace(/[.\s]+$/, '')
    .trim()
  return cleaned.slice(0, 200) || 'file'
}

export function extensionOf(name: string): string {
  const clean = sanitizeFilename(name).toLowerCase()
  const idx = clean.lastIndexOf('.')
  return idx > 0 ? clean.slice(idx + 1) : ''
}

/** Validate what the client declares before issuing an upload URL. */
export function validateDeclaredFile(
  file: { filename: string; size: number; contentType: string },
  limits: AttachmentLimits,
): ValidationResult {
  const clean = sanitizeFilename(file.filename)
  const parts = clean.toLowerCase().split('.')
  const ext = parts.length > 1 ? (parts.at(-1) ?? '') : ''
  if (!ext || !(ext in ALLOWED_ATTACHMENTS)) {
    return { ok: false, error: `${clean}: this file type is not allowed. Allowed: ${Object.keys(ALLOWED_ATTACHMENTS).join(', ')}.` }
  }
  // Reject dangerous inner extensions, for example "report.exe.pdf".
  if (parts.slice(1, -1).some((p) => DANGEROUS_EXTENSIONS.has(p))) {
    return { ok: false, error: `${clean}: file name contains a disallowed extension.` }
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, error: `${clean}: the file is empty.` }
  }
  if (file.size > limits.maxFileBytes) {
    return { ok: false, error: `${clean}: the file is larger than ${Math.floor(limits.maxFileBytes / 1024 / 1024)} MB.` }
  }
  const allowed = ALLOWED_ATTACHMENTS[ext]!
  const declared = file.contentType.trim().toLowerCase().split(';')[0] ?? ''
  if (declared && !allowed.mime.includes(declared) && declared !== 'application/octet-stream') {
    return { ok: false, error: `${clean}: the declared file type does not match its extension.` }
  }
  return { ok: true, ext, uploadType: allowed.uploadType }
}

export function validateBatch(sizes: number[], limits: AttachmentLimits): string | null {
  if (sizes.length > limits.maxFiles) return `You can attach at most ${limits.maxFiles} files.`
  const total = sizes.reduce((a, b) => a + b, 0)
  if (total > limits.maxTotalBytes) {
    return `Attachments may total at most ${Math.floor(limits.maxTotalBytes / 1024 / 1024)} MB.`
  }
  return null
}

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v)

/** Detect a file kind from the leading bytes. Returns null when nothing allowed matches. */
export function detectKind(bytes: Uint8Array): FileKind | null {
  if (bytes.length < 4) return null
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return 'pdf' // %PDF
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'ole'
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return 'zip'
  if (isProbablyText(bytes)) return 'text'
  return null
}

function isProbablyText(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return true
  } catch {
    // The sample may cut a multi-byte sequence at the end; retry without the last 3 bytes.
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(0, Math.max(0, bytes.length - 3)))
      return true
    } catch {
      return false
    }
  }
}

const latin1 = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join('')

export type MagicResult = { ok: true; kind: FileKind } | { ok: false; error: string }

/** Verify that the leading bytes of an uploaded object match its extension. */
export function verifyMagic(ext: string, bytes: Uint8Array): MagicResult {
  const allowed = ALLOWED_ATTACHMENTS[ext]
  if (!allowed) return { ok: false, error: 'File type is not allowed.' }
  const detected = detectKind(bytes)
  if (detected !== allowed.kind) {
    return { ok: false, error: 'The file content does not match its file type.' }
  }
  if (allowed.kind === 'zip') {
    // OOXML packages must look like Office documents. Macro containers are refused outright.
    const head = latin1(bytes.slice(0, 8192))
    if (!/\[Content_Types\]\.xml|_rels\/|word\/|xl\//.test(head)) {
      return { ok: false, error: 'The file is not a valid Office document.' }
    }
    if (/vbaProject\.bin/.test(head)) {
      return { ok: false, error: 'Documents containing macros are not accepted.' }
    }
  }
  return { ok: true, kind: allowed.kind }
}

/** Number of leading bytes the server needs to inspect. */
export const MAGIC_SAMPLE_BYTES = 8192
