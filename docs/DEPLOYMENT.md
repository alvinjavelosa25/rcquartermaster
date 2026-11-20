# Deployment guide

Target: Vercel (app) + Neon (PostgreSQL) + Cloudflare R2 (files) + Resend (email) + Cloudflare Turnstile. All accounts should be owned by the client; developers are invited with least privilege.

Vercel's free Hobby plan prohibits commercial use. Use a Pro (or higher) team for production.

## 1. One-time setup

### 1.1 GitHub
1. Create the repository, push `main`, protect `main` (require PR + the CI `check` and `e2e` jobs).
2. Enable secret scanning with push protection and Dependabot alerts.

### 1.2 Neon (PostgreSQL)
1. Create a project in a **US region**. Create a database `rcq`.
2. Copy two connection strings: the **pooled** one (hostname contains `-pooler`) for the app, and the **direct** one for backups and migrations from your machine.
3. Enable point-in-time restore on a plan that gives the retention you need (see docs/BACKUP_RESTORE.md). Optional: use Neon branching so each Vercel preview gets its own database branch.
4. The `pg_trgm` extension is created automatically by the application.

### 1.3 Cloudflare R2
Create two buckets (US jurisdiction if required): `rcq-public` and `rcq-private`. Neither gets a public domain or public access.

For **`rcq-private`**:
- **CORS** (needed for browser uploads via presigned URLs):
  ```json
  [{
    "AllowedOrigins": ["https://www.rcquartermaster.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }]
  ```
  Add your preview URL pattern only if you want uploads to work on previews.
- **Lifecycle rule**: delete objects under prefix `quarantine/` after 1 day (abandoned uploads). The cron job also cleans this prefix as a second line of defence.
- Create an API token with Object Read & Write limited to the two buckets. Put the values in `S3_*` variables. R2 size limits are checked by the server after upload (R2 cannot enforce size conditions on presigned PUT), so keep the lifecycle rule.

### 1.4 Resend
1. Add the sending domain, publish the SPF, DKIM and DMARC DNS records Resend lists (client IT).
2. Create an API key. Set `EMAIL_FROM` to an address on the verified domain.
3. Test delivery to the actual `.gov`/`.mil` recipient domains before launch; ask recipients' IT to allow-list if needed.

### 1.5 Cloudflare Turnstile
Create a widget (Managed mode) for the production hostname. Use separate widgets for preview/dev. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.

### 1.6 Analytics (optional)
Plausible: add the domain, set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, create a **goal** named `rfq_submit` (this is the conversion). GA4: set `NEXT_PUBLIC_GA4_ID`; mark `generate_lead` (also sent on submit) or `rfq_submit` as a key event.

## 2. Vercel project

1. Import the GitHub repository. Framework preset: Next.js. Build command `npm run build`. Install `npm ci`. Node 22.
2. Add environment variables from docs/ENVIRONMENT.md.
   - **Production**: `SITE_ENV=production`, real keys, `STORAGE_DRIVER=s3`, pooled `DATABASE_URI`, `NEXT_PUBLIC_SITE_URL` set to the final URL.
   - **Preview**: test Turnstile keys, a Neon branch or separate database, a **separate R2 bucket pair** or prefix, a Resend key restricted to your own address (or leave `RESEND_API_KEY` empty to only log). Never reuse production data or secrets in previews. `SITE_ENV=preview` is inferred from Vercel.
3. Set `CRON_SECRET`. `vercel.json` already schedules `/api/cron/email-retry` (every 10 min), `/api/cron/retention` (daily) and `/api/cron/cleanup` (daily). Vercel sends `Authorization: Bearer $CRON_SECRET`. Any other scheduler can call the same URLs with that header.
4. Function duration: the CSV import and cron routes can take longer than the default; a Pro plan allows raising `maxDuration` (cron routes set 60 s).

## 3. Database migrations

Production never auto-syncs the schema. Apply migrations as a deliberate step **before** promoting a deployment that contains schema changes:

```bash
DATABASE_URI="<direct connection string>" PAYLOAD_SECRET=... npm run migrate
```

CI applies them to the throwaway test database. Generate new migrations locally with `npm run migrate:create <name>` after changing a collection, review the SQL, commit it. For destructive changes (dropping columns) use the expand/contract pattern across two releases.

## 4. First deployment

1. Run migrations against the production database.
2. Deploy `main`. Open `/admin`: the **first user you create becomes Admin**. Create it immediately after the first deploy (do not leave the production admin open to the public).
3. Create other staff users with the right roles. Use passwords of 12+ characters from a password manager.
4. Fill in **Site settings** (contact details, RFQ recipients, retention). Leave identifiers unverified until the client confirms them.
5. Edit the four content pages (About, Services, Privacy, Accessibility), then publish. The seed text is placeholder and the privacy policy needs legal review.
6. Import the product data (docs/ADMIN_GUIDE.md), publish, spot-check search.
7. Do **not** run `npm run seed` in production.

## 5. Domain and TLS

Add the domain in Vercel, update DNS (client IT), wait for the certificate. Redirect the apex to `www` (or the reverse) in Vercel domain settings. HSTS is sent by the app. After verifying HTTPS everywhere, consider adding the domain to the HSTS preload list.

## 6. Redirects from the old site

After the URL audit, fill `src/config/redirects.json`:
```json
{ "redirects": [{ "source": "/old-products/gloves", "destination": "/categories/personal-protective-equipment/gloves" }] }
```
All entries are served as permanent 301s. `tests/unit/redirects.test.ts` rejects duplicates, loops and chains. Submit the new sitemap (`/sitemap.xml`) in Google Search Console and Bing Webmaster Tools.

## 7. Release process

1. Open a PR. CI runs lint, formatting, types, unit tests, build, then the Playwright + axe suite on a fresh database.
2. Vercel builds a preview deployment per PR. Review it; it is `noindex`.
3. Merge to `main` to deploy production. If the PR contains a migration, run it first (section 3).
4. After deploy: check `/api/health`, submit a test RFQ (use a clearly marked test company), confirm both emails arrive and the record appears in the admin.

**Rollback**: in Vercel, promote the previous deployment (instant). Database migrations are not automatically reversed; design them to be backward compatible (expand/contract) so the previous app version keeps working.

## 8. Monitoring

- Uptime monitor on `https://<domain>/api/health` (503 means the database is unreachable).
- Vercel log drains or alerts on 5xx rates. Structured error lines start with `[rfq]` or `[retention]`.
- Plausible/GA4 goal `rfq_submit` as the business KPI.
- Search Console Core Web Vitals report after launch.

## 9. Self-hosting (no vendor lock-in)

The app is a standard Node.js server: `npm ci && npm run build && npm run start` behind any reverse proxy, with PostgreSQL 15+, any S3 API, and a scheduler calling the three cron URLs with the bearer secret. Ensure the proxy overwrites `X-Forwarded-For` (rate limiting relies on it).

## 10. Hardening checklist before launch

- [ ] `SITE_ENV=production`, real Turnstile keys, `STORAGE_DRIVER=s3`
- [ ] Buckets are private; CORS and lifecycle rules applied
- [ ] Resend domain verified; test emails delivered to buyer and sales inboxes
- [ ] First admin created; no seed users exist (`select email from users`)
- [ ] `CRON_SECRET`, `IP_HASH_SALT`, `PAYLOAD_SECRET` unique per environment and stored only in Vercel
- [ ] Backup workflow secrets set and a restore drill completed (docs/BACKUP_RESTORE.md)
- [ ] Security headers verified (`curl -I`), CSP reviewed (the current policy still allows inline scripts: see ARCHITECTURE.md 7.2)
- [ ] Accessibility audit (keyboard, NVDA, VoiceOver, 400% zoom) completed
- [ ] Redirect map populated and tested
- [ ] Privacy policy and accessibility statement approved
