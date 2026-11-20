import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { PrivateStorage, StorageObjectInfo, UploadTarget } from './types'
import { isValidStorageKey } from './types'

export interface S3StorageConfig {
  endpoint: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

/** S3-compatible private bucket (Cloudflare R2). The bucket must NOT be public. */
export class S3Storage implements PrivateStorage {
  private readonly client: S3Client
  private readonly bucket: string

  constructor(cfg: S3StorageConfig) {
    this.bucket = cfg.bucket
    this.client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      forcePathStyle: true,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      // Newer SDK versions add checksum headers to presigned URLs, which browsers and R2 reject.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })
  }

  private guard(key: string): string {
    if (!isValidStorageKey(key)) throw new Error('Invalid storage key')
    return key
  }

  async createUploadTarget(key: string, opts: { contentType: string; expiresInSeconds: number }): Promise<UploadTarget> {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: this.guard(key), ContentType: opts.contentType }),
      { expiresIn: opts.expiresInSeconds, signableHeaders: new Set(['content-type']) },
    )
    return { url, method: 'PUT', headers: { 'Content-Type': opts.contentType } }
  }

  async head(key: string): Promise<StorageObjectInfo | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.guard(key) }))
      return { size: Number(res.ContentLength ?? 0), contentType: res.ContentType }
    } catch (e) {
      const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      if (status === 404 || (e as { name?: string }).name === 'NotFound') return null
      throw e
    }
  }

  async readRange(key: string, start: number, endInclusive: number): Promise<Uint8Array> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.guard(key), Range: `bytes=${start}-${endInclusive}` }),
    )
    return res.Body!.transformToByteArray()
  }

  async read(key: string): Promise<Uint8Array> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.guard(key) }))
    return res.Body!.transformToByteArray()
  }

  async move(fromKey: string, toKey: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: this.guard(toKey),
        CopySource: `${this.bucket}/${this.guard(fromKey)}`,
      }),
    )
    await this.delete(fromKey)
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.guard(key) }))
  }

  async createDownloadUrl(key: string, opts: { filename: string; expiresInSeconds: number }): Promise<string> {
    const safe = opts.filename.replace(/["\\\r\n]/g, '_')
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.guard(key),
        ResponseContentDisposition: `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(opts.filename)}`,
        ResponseContentType: 'application/octet-stream',
      }),
      { expiresIn: opts.expiresInSeconds },
    )
  }

  async deleteOlderThan(prefix: string, cutoff: Date): Promise<number> {
    let deleted = 0
    let token: string | undefined
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      )
      for (const obj of res.Contents ?? []) {
        if (obj.Key && obj.LastModified && obj.LastModified < cutoff) {
          await this.delete(obj.Key)
          deleted += 1
        }
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined
    } while (token)
    return deleted
  }
}
