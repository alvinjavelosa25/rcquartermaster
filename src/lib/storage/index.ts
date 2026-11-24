import { getEnv } from '@/env'
import { LocalStorage } from './local'
import { S3Storage } from './s3'
import type { PrivateStorage } from './types'

let instance: PrivateStorage | undefined

/** Private RFQ attachment storage, selected by STORAGE_DRIVER. */
export function getPrivateStorage(): PrivateStorage {
  if (instance) return instance
  const env = getEnv()
  if (env.STORAGE_DRIVER === 's3') {
    instance = new S3Storage({
      endpoint: env.S3_ENDPOINT!,
      region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      bucket: env.S3_PRIVATE_BUCKET!,
    })
  } else {
    instance = new LocalStorage(env.PAYLOAD_SECRET)
  }
  return instance
}

export { isValidStorageKey } from './types'
export type { PrivateStorage } from './types'
