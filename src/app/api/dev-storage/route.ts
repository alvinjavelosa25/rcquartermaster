import { getEnv } from '@/env'
import { json } from '@/lib/http'
import { LocalStorage, localPath, verifyLocalSignature } from '@/lib/storage/local'
import { isValidStorageKey } from '@/lib/storage/types'
import { readFile } from 'node:fs/promises'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Development and automated-test storage endpoint (STORAGE_DRIVER=local only).
 * Mirrors what a presigned URL does on R2: signed, expiring, scoped to one key.
 */
function enabled() {
  const env = getEnv()
  return env.STORAGE_DRIVER === 'local' && env.SITE_ENV_RESOLVED !== 'production'
}

export async function PUT(request: Request) {
  if (!enabled()) return json({ error: 'Not found' }, 404)
  const env = getEnv()
  const url = new URL(request.url)
  const key = url.searchParams.get('key') ?? ''
  const exp = Number(url.searchParams.get('exp'))
  const sig = url.searchParams.get('sig') ?? ''
  const contentType = request.headers.get('content-type') ?? ''
  if (!isValidStorageKey(key) || !verifyLocalSignature(env.PAYLOAD_SECRET, 'upload', key, exp, sig, contentType)) {
    return json({ error: 'Forbidden' }, 403)
  }
  const max = (env.RFQ_MAX_FILE_MB + 1) * 1024 * 1024
  if (Number(request.headers.get('content-length') ?? 0) > max) return json({ error: 'Too large' }, 413)
  const body = new Uint8Array(await request.arrayBuffer())
  if (body.length > max) return json({ error: 'Too large' }, 413)
  await new LocalStorage(env.PAYLOAD_SECRET).writeBytes(key, body)
  return new Response(null, { status: 200 })
}

export async function GET(request: Request) {
  if (!enabled()) return json({ error: 'Not found' }, 404)
  const env = getEnv()
  const url = new URL(request.url)
  const key = url.searchParams.get('key') ?? ''
  const exp = Number(url.searchParams.get('exp'))
  const sig = url.searchParams.get('sig') ?? ''
  const filename = url.searchParams.get('filename') ?? 'file'
  if (!isValidStorageKey(key) || !verifyLocalSignature(env.PAYLOAD_SECRET, 'download', key, exp, sig, filename)) {
    return json({ error: 'Forbidden' }, 403)
  }
  try {
    const data = await readFile(localPath(key))
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename.replace(/["\\\r\n]/g, '_')}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return json({ error: 'Not found' }, 404)
  }
}
