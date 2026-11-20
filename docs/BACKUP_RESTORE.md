# Backups and restore

Targets (proposed, confirm with the client): **RPO 24 hours, RTO 8 hours**.

## What is protected

| Data | Primary | Backup |
|---|---|---|
| Catalogue, RFQs, users, settings (PostgreSQL) | Neon | Neon point-in-time restore (window depends on plan) **and** a daily encrypted `pg_dump` to a separate bucket (`.github/workflows/backup.yml`) |
| Images and spec sheets (`S3_PUBLIC_BUCKET`) | R2 | Enable **object versioning** on the bucket; copy to the backup bucket periodically if the client requires it |
| RFQ attachments (`S3_PRIVATE_BUCKET`) | R2 | Object versioning; they are deleted by design after the retention period, so older backups can contain data that should be gone: apply the retention policy to backups (30 days) |
| Source code and configuration | GitHub | Git history. Environment variables: keep an encrypted copy in the client's password manager |

## Setting up the daily database backup

1. Create a **separate** R2 bucket (for example `rcq-backups`), private, with a lifecycle rule deleting objects older than 30 days. Create an API token limited to that bucket.
2. In GitHub (Settings > Secrets and variables > Actions) add:
   - `BACKUP_DATABASE_URL`: Neon **direct** connection string (not the pooler), ideally a read-only role
   - `BACKUP_PASSPHRASE`: a long random passphrase. Store a copy in the client's password manager: without it backups cannot be decrypted
   - `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`
3. Run the **Database backup** workflow once manually (Actions tab) and confirm an object appears under `db/YYYY/MM/DD/`.
4. Set `PG_VERSION` in the workflow to at least the server's major version.

A failed run shows red in GitHub; configure notifications for failed workflows.

## Restore procedure

Always restore into a **new, empty database** first, verify, then switch the application over.

### A. Point-in-time restore (fastest, within the Neon retention window)
1. In Neon, restore the branch to the chosen timestamp, or create a branch from that time.
2. Verify the data (section "Verify" below) using the branch's connection string.
3. Update `DATABASE_URI` in Vercel Production to the restored branch and redeploy.

### B. Restore from the encrypted dump
```bash
# 1. Download and decrypt
aws s3 cp s3://rcq-backups/db/2026/11/20/rcq-023000.dump.gpg . --endpoint-url "$BACKUP_S3_ENDPOINT"
gpg --batch --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" --output restore.dump --decrypt rcq-023000.dump.gpg

# 2. Create an empty database (Neon console or psql), then restore
pg_restore --no-owner --no-privileges --clean --if-exists --dbname "$NEW_DIRECT_DATABASE_URL" restore.dump

# 3. Apply any newer migrations, then rebuild the search index
DATABASE_URI="$NEW_DIRECT_DATABASE_URL" npm run migrate
DATABASE_URI="$NEW_DIRECT_DATABASE_URL" npm run reindex
```
4. Verify, then set `DATABASE_URI` in Vercel to the new database and redeploy.

### C. Restoring files
Restore previous object versions from R2 (dashboard or `aws s3api list-object-versions` / `copy-object`), or copy from the backup bucket.

### Verify
- `select count(*) from products, rfqs, users;` look plausible; `select max(created_at) from rfqs;` is the expected recent time.
- `/api/health` returns 200; sign in to `/admin`; open a recent RFQ; search for a known SKU.
- Run `npm run reindex` if search results look stale.

## Restore drill (before launch, then twice a year)
1. Restore the latest dump into a scratch database (procedure B).
2. Point a Vercel preview (or local `.env`) at it and run the verification list.
3. Record the date, who did it, how long it took (compare to the 8-hour RTO) and anything that was unclear. Update this document.

## Incident notes
- If personal data may have been exposed, follow the client's incident procedure; RFQs contain buyer names, emails and phone numbers.
- Rotate `PAYLOAD_SECRET` (logs everyone out), the R2 tokens, `RESEND_API_KEY` and `CRON_SECRET` after any suspected secret leak.
