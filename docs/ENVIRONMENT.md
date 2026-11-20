# Environment variable reference

Copy `.env.example` to `.env` locally. In Vercel set variables per environment (Production, Preview, Development). Variables starting with `NEXT_PUBLIC_` are exposed to the browser: never put secrets in them. All variables are validated at startup by `src/env.ts`; a clear error lists anything missing or invalid.

"Prod" column: R = required in production, O = optional, D = has a default.

## Core

| Variable | Prod | Description |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | R | Public base URL without trailing slash, for example `https://www.rcquartermaster.com`. Used for canonical URLs, sitemap, CSRF/CORS allow-list and email links. Set per environment (preview URLs differ). |
| `SITE_ENV` | O | `development`, `preview` or `production`. Defaults to `VERCEL_ENV`, then to `production` when `NODE_ENV=production`. Anything other than production is `noindex` and blocked in robots.txt. |
| `DATABASE_URI` | R | PostgreSQL connection string. On Neon/Supabase use the **pooled** connection string for the app. |
| `PAYLOAD_SECRET` | R | 32+ characters. Signs sessions and local signed URLs. Rotating it logs everyone out. `openssl rand -hex 32` |
| `IP_HASH_SALT` | R | 16+ characters. Salt for hashing client IPs (rate limits, RFQ metadata). Changing it resets rate-limit history only. |
| `CRON_SECRET` | R | 16+ characters. Bearer secret for `/api/cron/*`. Vercel Cron sends it automatically when the variable exists. |
| `DB_PUSH` | local only | `true` lets Payload auto-sync the schema (development convenience). Never set in preview or production. |
| `DB_POOL_MAX` | D (10) | Maximum database connections per instance. |
| `SKIP_BUILD_DB` | CI only | `true` makes `next build` run without a database (data helpers return empty data). Never set on Vercel. |

## Search

| Variable | Prod | Description |
|---|---|---|
| `SEARCH_PROVIDER` | D (`postgres`) | Search implementation. Only `postgres` exists today; a Meilisearch/Algolia provider is added in `src/lib/search/index.ts`. |

## Storage

| Variable | Prod | Description |
|---|---|---|
| `STORAGE_DRIVER` | R (`s3`) | `s3` for Cloudflare R2 or any S3-compatible service. `local` (disk) is for development/tests and is **refused in production**. |
| `S3_ENDPOINT` | R | For R2: `https://<account-id>.r2.cloudflarestorage.com`. |
| `S3_REGION` | D (`auto`) | `auto` for R2. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | R | R2 API token with Object Read & Write on both buckets below. |
| `S3_PUBLIC_BUCKET` | R | Bucket for CMS media and spec sheets. Not publicly addressable either: the app serves files through Payload so unpublished documents stay private. |
| `S3_PRIVATE_BUCKET` | R | Bucket for RFQ attachments (`quarantine/` and `rfq/` prefixes). Must never be public. Needs the CORS and lifecycle rules in docs/DEPLOYMENT.md. |

## RFQ, email and abuse protection

| Variable | Prod | Description |
|---|---|---|
| `RFQ_NOTIFY_TO` | R | Default sales inbox(es), comma separated. The admin setting "Sales inbox recipients" overrides it when filled in. |
| `EMAIL_FROM`, `EMAIL_FROM_NAME` | R | Sender. The domain must be verified in Resend (SPF, DKIM, DMARC). |
| `RESEND_API_KEY` | R | Resend API key. Without it emails are only logged to the console (development). |
| `RFQ_MAX_FILES` | D (5) | Maximum attachments per RFQ. |
| `RFQ_MAX_FILE_MB` | D (10) | Maximum size per attachment. |
| `RFQ_MAX_TOTAL_MB` | D (25) | Maximum total attachment size per RFQ. |
| `RFQ_RATE_LIMIT_PER_HOUR` | D (5) | RFQ submissions per client IP per hour. Raise it if buyers share a NAT/proxy address. |
| `RFQ_RATE_LIMIT_PER_DAY` | D (20) | Per client IP per day. |
| `RFQ_RATE_LIMIT_PER_EMAIL_PER_DAY` | D (10) | Per buyer email address per day. |
| `UPLOAD_RATE_LIMIT_PER_HOUR` | D (30) | Upload-URL requests per client IP per hour. |
| `SCANNER_PROVIDER` | D (`none`) | Virus scanner. `none` marks attachments `skipped`. Implement `AttachmentScanner` in `src/lib/security/scanner.ts` for a real provider. |
| `ALLOW_UNSCANNED_DOWNLOADS` | D (false) | `true` lets staff download attachments whose status is `skipped` (no scanner). Keep `false` once a scanner exists. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | R | Cloudflare Turnstile widget keys. The defaults in `.env.example` are Cloudflare's public test keys (always pass): never use them in production. |

## Analytics

| Variable | Prod | Description |
|---|---|---|
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | O | Enables Plausible (cookieless). Value is the site domain registered in Plausible. |
| `NEXT_PUBLIC_GA4_ID` | O | Enables GA4 (`G-XXXXXXXX`). Loaded only after the visitor accepts the cookie banner. |

## Tests and scripts only

| Variable | Description |
|---|---|
| `SEED_PASSWORD` | Password for seeded development users. |
| `FORCE_SEED=1` | Allow `npm run seed` in a production environment (do not). |
| `IMPORT_DRY_RUN=1`, `IMPORT_PUBLISH=1`, `IMPORT_STOP_ON_ERROR=1` | Options for `npm run import:csv`. |
| `E2E_BASE_URL` | Run Playwright against an already running deployment instead of starting a server. |

## GitHub Actions secrets (backups)

`BACKUP_DATABASE_URL` (direct, non-pooled connection), `BACKUP_PASSPHRASE`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`. See docs/BACKUP_RESTORE.md.
