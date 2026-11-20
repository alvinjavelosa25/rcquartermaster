import { createHmac, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isValidStorageKey } from './types'
import type { PrivateStorage, StorageObjectInfo, UploadTarget } from './types'

const ROOT = path.resolve(process.cwd(), '.data/private')

export function signLocalUrl(
  secret: string,
  action: 'upload' | 'download',
  key: string,
  exp: number,
  extra = '',
): string {
  return createHmac('sha256', secret).update(`${action}\n${key}\n${exp}\n${extra}`).digest('hex')
}

export function verifyLocalSignature(
  secret: string,
  action: 'upload' | 'download',
  key: string,
  exp: number,
  sig: string,
  extra = '',
): boolean {
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false
  const expected = Buffer.from(signLocalUrl(secret, action, key, exp, extra), 'hex')
  let given: Buffer
  try {
    given = Buffer.from(sig, 'hex')
  } catch {
    return false
  }
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export const localPath = (key: string): string => {
  if (!isValidStorageKey(key)) throw new Error('Invalid storage key')
  return path.join(ROOT, key)
}

/** Development/test driver. Writes to .data/private and serves signed URLs from /api/dev-storage. */
export class LocalStorage implements PrivateStorage {
  constructor(private readonly secret: string) {}

  async createUploadTarget(
    key: string,
    opts: { contentType: string; expiresInSeconds: number },
  ): Promise<UploadTarget> {
    const exp = Math.floor(Date.now() / 1000) + opts.expiresInSeconds
    const sig = signLocalUrl(this.secret, 'upload', key, exp, opts.contentType)
    const qs = new URLSearchParams({ key, exp: String(exp), sig })
    return {
      url: `/api/dev-storage?${qs.toString()}`,
      method: 'PUT',
      headers: { 'Content-Type': opts.contentType },
    }
  }

  async head(key: string): Promise<StorageObjectInfo | null> {
    try {
      const s = await stat(localPath(key))
      return { size: s.size }
    } catch {
      return null
    }
  }

  async readRange(key: string, start: number, endInclusive: number): Promise<Uint8Array> {
    const buf = await readFile(localPath(key))
    return buf.subarray(start, endInclusive + 1)
  }

  async read(key: string): Promise<Uint8Array> {
    return readFile(localPath(key))
  }

  async move(fromKey: string, toKey: string): Promise<void> {
    const to = localPath(toKey)
    await mkdir(path.dirname(to), { recursive: true })
    await rename(localPath(fromKey), to)
  }

  async delete(key: string): Promise<void> {
    await rm(localPath(key), { force: true })
  }

  async createDownloadUrl(
    key: string,
    opts: { filename: string; expiresInSeconds: number },
  ): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + opts.expiresInSeconds
    const sig = signLocalUrl(this.secret, 'download', key, exp, opts.filename)
    const qs = new URLSearchParams({ key, exp: String(exp), sig, filename: opts.filename })
    return `/api/dev-storage?${qs.toString()}`
  }

  async deleteOlderThan(prefix: string, cutoff: Date): Promise<number> {
    const dir = path.join(ROOT, prefix)
    let deleted = 0
    const walk = async (d: string): Promise<void> => {
      let entries
      try {
        entries = await readdir(d, { withFileTypes: true })
      } catch {
        return
      }
      for (const e of entries) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) await walk(p)
        else if ((await stat(p)).mtime < cutoff) {
          await rm(p, { force: true })
          deleted += 1
        }
      }
    }
    await walk(dir)
    return deleted
  }

  /** Used by the dev-storage route to persist an uploaded body. */
  async writeBytes(key: string, data: Uint8Array): Promise<void> {
    const p = localPath(key)
    await mkdir(path.dirname(p), { recursive: true })
    await writeFile(p, data)
  }
}
