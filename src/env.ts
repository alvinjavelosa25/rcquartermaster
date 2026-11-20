import { z } from 'zod'

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1')

const int = (def: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? Number(v) : def))
    .pipe(z.number().int().positive())

const emptyToUndef = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const schema = z
  .object({
    NEXT_PUBLIC_SITE_URL: z.preprocess(emptyToUndef, z.url().default('http://localhost:3000')),
    SITE_ENV: z.preprocess(
      emptyToUndef,
      z.enum(['development', 'preview', 'production']).optional(),
    ),
    VERCEL_ENV: z.preprocess(emptyToUndef, z.string().optional()),
    DATABASE_URI: z.string().min(1, 'DATABASE_URI is required'),
    PAYLOAD_SECRET: z.string().min(32, 'PAYLOAD_SECRET must be at least 32 characters'),
    IP_HASH_SALT: z.preprocess(emptyToUndef, z.string().min(16).optional()),
    CRON_SECRET: z.preprocess(emptyToUndef, z.string().min(16).optional()),
    SEARCH_PROVIDER: z.preprocess(emptyToUndef, z.enum(['postgres']).default('postgres')),
    STORAGE_DRIVER: z.preprocess(emptyToUndef, z.enum(['local', 's3']).default('local')),
    S3_ENDPOINT: z.preprocess(emptyToUndef, z.string().optional()),
    S3_REGION: z.preprocess(emptyToUndef, z.string().default('auto')),
    S3_ACCESS_KEY_ID: z.preprocess(emptyToUndef, z.string().optional()),
    S3_SECRET_ACCESS_KEY: z.preprocess(emptyToUndef, z.string().optional()),
    S3_PUBLIC_BUCKET: z.preprocess(emptyToUndef, z.string().optional()),
    S3_PRIVATE_BUCKET: z.preprocess(emptyToUndef, z.string().optional()),
    RFQ_NOTIFY_TO: z.preprocess(emptyToUndef, z.string().optional()),
    EMAIL_FROM: z.preprocess(emptyToUndef, z.string().default('rfq@example.com')),
    EMAIL_FROM_NAME: z.preprocess(emptyToUndef, z.string().default('RC Quartermaster')),
    RESEND_API_KEY: z.preprocess(emptyToUndef, z.string().optional()),
    RFQ_MAX_FILES: int(5),
    RFQ_MAX_FILE_MB: int(10),
    RFQ_MAX_TOTAL_MB: int(25),
    RFQ_RATE_LIMIT_PER_HOUR: int(5),
    RFQ_RATE_LIMIT_PER_DAY: int(20),
    RFQ_RATE_LIMIT_PER_EMAIL_PER_DAY: int(10),
    UPLOAD_RATE_LIMIT_PER_HOUR: int(30),
    SCANNER_PROVIDER: z.preprocess(emptyToUndef, z.enum(['none']).default('none')),
    ALLOW_UNSCANNED_DOWNLOADS: bool,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.preprocess(emptyToUndef, z.string().optional()),
    TURNSTILE_SECRET_KEY: z.preprocess(emptyToUndef, z.string().optional()),
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN: z.preprocess(emptyToUndef, z.string().optional()),
    NEXT_PUBLIC_GA4_ID: z.preprocess(emptyToUndef, z.string().optional()),
    SKIP_BUILD_DB: bool,
  })
  .superRefine((v, ctx) => {
    if (v.STORAGE_DRIVER === 's3') {
      for (const k of [
        'S3_ENDPOINT',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
        'S3_PUBLIC_BUCKET',
        'S3_PRIVATE_BUCKET',
      ] as const) {
        if (!v[k])
          ctx.addIssue({
            code: 'custom',
            path: [k],
            message: `${k} is required when STORAGE_DRIVER=s3`,
          })
      }
    }
    const prod = (v.SITE_ENV ?? v.VERCEL_ENV) === 'production'
    if (prod) {
      if (v.STORAGE_DRIVER === 'local') {
        ctx.addIssue({
          code: 'custom',
          path: ['STORAGE_DRIVER'],
          message: 'STORAGE_DRIVER=local is not allowed in production',
        })
      }
      if (!v.IP_HASH_SALT)
        ctx.addIssue({
          code: 'custom',
          path: ['IP_HASH_SALT'],
          message: 'IP_HASH_SALT is required in production',
        })
      if (!v.CRON_SECRET)
        ctx.addIssue({
          code: 'custom',
          path: ['CRON_SECRET'],
          message: 'CRON_SECRET is required in production',
        })
      if (!v.TURNSTILE_SECRET_KEY)
        ctx.addIssue({
          code: 'custom',
          path: ['TURNSTILE_SECRET_KEY'],
          message: 'TURNSTILE_SECRET_KEY is required in production',
        })
    }
  })

export type Env = z.infer<typeof schema> & {
  SITE_ENV_RESOLVED: 'development' | 'preview' | 'production'
}

let cached: Env | undefined

/** Parse and cache environment variables. Throws a readable error when invalid. */
export function getEnv(source: Record<string, string | undefined> = process.env): Env {
  if (source === process.env && cached) return cached
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`,
    )
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`)
  }
  const d = parsed.data
  const vercel =
    d.VERCEL_ENV === 'production' || d.VERCEL_ENV === 'preview' ? d.VERCEL_ENV : undefined
  const resolved =
    d.SITE_ENV ?? vercel ?? (source.NODE_ENV === 'production' ? 'production' : 'development')
  const env: Env = { ...d, SITE_ENV_RESOLVED: resolved }
  if (source === process.env) cached = env
  return env
}

export const isProductionSite = () => getEnv().SITE_ENV_RESOLVED === 'production'
export const siteUrl = () => getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '')
