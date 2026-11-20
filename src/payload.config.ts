import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { resendAdapter } from '@payloadcms/email-resend'
import { s3Storage } from '@payloadcms/storage-s3'
import sharp from 'sharp'
import { getEnv } from '@/env'
import { Users } from '@/collections/Users'
import { Categories } from '@/collections/Categories'
import { AttributeDefinitions } from '@/collections/AttributeDefinitions'
import { Products } from '@/collections/Products'
import { Media } from '@/collections/Media'
import { Documents } from '@/collections/Documents'
import { Rfqs } from '@/collections/Rfqs'
import { RfqAttachments } from '@/collections/RfqAttachments'
import { Pages } from '@/collections/Pages'
import { SearchDocuments } from '@/collections/SearchDocuments'
import { RateLimits } from '@/collections/RateLimits'
import { SiteSettings } from '@/globals/SiteSettings'
import { searchSchemaHook } from '@/lib/search/schema'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const env = getEnv()
const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '')

export default buildConfig({
  secret: env.PAYLOAD_SECRET,
  serverURL: undefined,
  cors: [siteUrl],
  csrf: [siteUrl],
  // The public API surface is REST through Payload access control only. GraphQL is not used.
  graphQL: { disable: true },
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: ' | RC Quartermaster admin' },
  },
  collections: [
    Users,
    Categories,
    AttributeDefinitions,
    Products,
    Media,
    Documents,
    Rfqs,
    RfqAttachments,
    Pages,
    SearchDocuments,
    RateLimits,
  ],
  globals: [SiteSettings],
  editor: lexicalEditor(),
  db: postgresAdapter({
    pool: { connectionString: env.DATABASE_URI, max: Number(process.env.DB_POOL_MAX ?? 10) },
    // Needed for typo-tolerant search (similarity functions).
    extensions: ['pg_trgm'],
    afterSchemaInit: [searchSchemaHook],
    migrationDir: path.resolve(dirname, 'migrations'),
    // Local development convenience only. Preview and production apply reviewed migrations (npm run migrate).
    push: process.env.DB_PUSH === 'true',
  }),
  email: env.RESEND_API_KEY
    ? resendAdapter({
        apiKey: env.RESEND_API_KEY,
        defaultFromAddress: env.EMAIL_FROM,
        defaultFromName: env.EMAIL_FROM_NAME,
      })
    : undefined,
  plugins: [
    s3Storage({
      enabled: env.STORAGE_DRIVER === 's3',
      collections: { media: true, documents: true },
      bucket: env.S3_PUBLIC_BUCKET ?? 'unset',
      config: {
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        forcePathStyle: true,
        credentials: {
          accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
          secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? '',
        },
      },
    }),
  ],
  upload: { limits: { fileSize: 25 * 1024 * 1024 } },
  sharp,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
})
