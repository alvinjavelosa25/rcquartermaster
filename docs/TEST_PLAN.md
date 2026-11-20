# RC Quartermaster LLC: Test Plan

Status: **Stage 1 draft, awaiting approval**.

## 1. Strategy

| Layer | Tool | Scope | Runs |
|---|---|---|---|
| Unit | Vitest | Pure domain logic (schemas, search query building, CSV, reference generator, rate limiter, validation, RFQ list store, access helpers) | Every commit (CI) |
| Integration | Vitest + local Postgres (Docker/Neon branch) | Payload hooks, access control, search SQL, RFQ service with fake mailer/storage/scanner | Every PR (CI) |
| End-to-end | Playwright (Chromium, Firefox, WebKit; mobile viewports) | Browse, search, RFQ flows, admin flows | Every PR on preview; full matrix nightly |
| Accessibility | `@axe-core/playwright` + manual | Automated rules on every key page/state; manual AT audit pre-launch | Every PR; manual in M4 |
| Performance | Lighthouse CI (pending approval) / Playwright metrics, CrUX after launch | CWV budgets on mobile profile | PR for key pages; weekly |
| Security | Header checks, RBAC tests, dependency audit, OWASP ZAP baseline (external tool) | See section 7 | PR (headers, RBAC, audit); pre-launch (ZAP, manual) |

Environments: tests use fixtures from the seed script; external services are faked in unit/integration and use sandbox/test keys in preview e2e (Turnstile test keys, Resend sandbox/recipient allow-list, separate R2 bucket).

Coverage targets: >= 80% line coverage for `src/lib/**`; every Must requirement has at least one automated test or a documented manual test. Traceability is by requirement ID in the test title, for example `[FR-013] exact SKU ranks first`.

Exit criteria for launch: all Must tests pass, zero open critical or serious accessibility defects, zero open high-severity security findings, performance budgets met on the production-like preview.

## 2. Unit and integration tests

| ID | Area | Case | Expected | Req |
|---|---|---|---|---|
| UT-001 | SKU | Normalise `" ab-12 "` | `AB-12`; duplicates detected case-insensitively | FR-004 |
| UT-002 | Category path | Create nested categories; rename a middle one | Descendant paths recomputed; unique | FR-001 |
| UT-003 | Category cycles | Set parent to own descendant | Rejected with validation error | FR-001 |
| UT-004 | Publish validation | Publish product without category, image alt or summary | Rejected, message names missing fields | FR-005, FR-017 |
| UT-005 | Public access | Public read of draft/unpublished product, category, document, page | Not returned (Local API and REST) | FR-007 |
| UT-006 | RBAC matrix | Each role x collection x operation per the permissions matrix | Allowed/denied exactly as specified | FR-021 |
| UT-007 | Sales field limits | Sales updates RFQ buyer fields | Rejected; only status, notes, assignedTo accepted | S-04 |
| UT-010 | Search query | `nitrile gloves` | Parameterised SQL; ranking order by A>B>C weights | FR-011 |
| UT-011 | Search SKU | Exact SKU, prefix, lowercase SKU | Exact first; prefix next | FR-013 |
| UT-012 | Search typo | `nitirle` | Trigram match returns nitrile products | FR-014 |
| UT-013 | Search injection | Query with `'; DROP TABLE`, `&`, `|`, `:*`, very long string, only stopwords | No error, safe empty or valid results; length capped | NFR-022 |
| UT-014 | Facets | Counts for category and attribute filters | Counts match filtered result totals | FR-012 |
| UT-015 | Category inheritance | Filter by parent category | Includes products in descendants | FR-002 |
| UT-016 | Indexer | Publish, edit, unpublish, delete product | `search_documents` row created, updated, removed | FR-016 |
| UT-017 | Interface contract | Run the same contract suite against `PostgresSearchService` (and future providers) | Identical results shape | FR-016 |
| UT-020 | RFQ schema | Valid, missing required, invalid email, phone formats, oversize text, past needed-by date, quantity 0/-1/1.5/1e9 | Zod errors with field paths and messages | FR-034, FR-035 |
| UT-021 | General RFQ | No items and empty description | Invalid; with description valid | FR-032 |
| UT-022 | Reference | Generate 100k references | Format `RCQ-YYYYMM-XXXXXX`, no collisions in test; collision retry works | FR-040 |
| UT-023 | Idempotency | Same key submitted twice | One record, same reference returned | FR-053 |
| UT-024 | RFQ list store | Add, merge duplicates, change qty, remove, corrupt JSON, old schema version, 500 items, quota exceeded | Safe behaviour, no exceptions, migration applied | FR-030, FR-031 |
| UT-025 | Cross-tab sync | `storage` event from another tab | State updates | FR-031 |
| UT-026 | Snapshots | Product renamed after submit | RFQ keeps original SKU/name snapshot | FR-040 |
| UT-030 | Turnstile | Mock success, failure, timeout, malformed response | Success passes; others reject; timeout fails closed | FR-036 |
| UT-031 | Rate limiter | N+1 requests in window; window rollover; different keys; concurrent requests | Limit enforced exactly; atomic under concurrency | FR-037 |
| UT-032 | IP hashing | Same IP with same salt, different salt | Deterministic hash, raw IP never persisted/logged | NFR-026 |
| UT-033 | Mailer | Resend failure, timeout, 429 | RFQ stored, status `failed`, retry scheduled | FR-051 |
| UT-034 | Email content | Header injection in name (`\r\nBcc:`), HTML in fields | Newlines stripped, HTML escaped | NFR-022 |
| UT-035 | Recipients | Admin list set, empty, invalid address; env fallback | Correct list used; invalid rejected on save | FR-043 |
| UT-040 | CSV import | Valid, missing columns, duplicate SKUs in file, unknown category, bad enum, BOM, CRLF, quoted commas, 5k rows | Row-level report; valid rows applied; no silent creation | FR-019 |
| UT-041 | CSV dry run | Dry run | Zero DB writes | FR-019 |
| UT-042 | CSV round trip | Export then import | No diff | FR-020 |
| UT-043 | CSV injection | Cells starting `=`, `+`, `-`, `@`, tab, CR on export | Prefixed/neutralised | NFR-022 |
| UT-044 | CSV publish rights | Catalogue Manager imports with publish flag | Allowed per policy; Sales denied | FR-021 |
| UT-050 | Retention | RFQs past, at and before `retentionExpiresAt`; setting changed | Only expired deleted with attachments; purge logged | FR-048 |
| UT-051 | JSON-LD | Product with quotes, `</script>`, unicode | Valid JSON, safely embedded | NFR-022 |
| UT-052 | Redirects | Each entry in redirect map | 301 and correct destination, no loops/chains | FR-068 |
| UT-053 | Env | Missing/invalid variables | App fails fast with clear message | NFR-023 |

## 3. End-to-end tests (Playwright)

Run on desktop (1280x800) and mobile (Pixel 7, iPhone 14) projects.

| ID | Flow | Steps and expected | Req |
|---|---|---|---|
| E2E-001 | Browse | Home -> Categories -> subcategory -> product; breadcrumbs correct; titles unique | B-01 |
| E2E-002 | Pagination | Category with > 24 products: next/prev, page count, URL, focus and `aria-current` | B-01 |
| E2E-003 | Empty category | Empty state with search and general RFQ link | B-01 |
| E2E-004 | Search by keyword | Query returns relevant, count announced, URL shareable | B-02 |
| E2E-005 | Search by SKU | Exact SKU first | FR-013 |
| E2E-006 | No results | Message and suggestions | B-02 |
| E2E-007 | Filters | Apply category and attribute filters, back button, clear all; works with JS disabled | B-03 |
| E2E-008 | Product page | All fields, images with alt, specs table, documents with size | B-04, B-05 |
| E2E-009 | Unpublished | Draft/unpublished product URL gives 404 and is absent from search/sitemap | B-04 |
| E2E-010 | Document gating | Unpublished document URL not retrievable (direct storage URL included) | B-05 |
| E2E-020 | Add to RFQ | Add from product and listing; count updates; live region text; no duplicates | B-06 |
| E2E-021 | Manage list | Edit quantity, invalid value error, remove, reload persistence, new tab sync | B-07 |
| E2E-022 | Unavailable item | Unpublish product after adding; RFQ page flags it | B-07 |
| E2E-023 | Submit RFQ (SKU) | Full valid submission with Turnstile test key; confirmation with reference; list cleared; DB record and emails (fake) | B-08, B-10 |
| E2E-024 | General RFQ | Submit without SKUs | B-09 |
| E2E-025 | Validation | Submit empty: error summary focused, links jump to fields, data retained | B-08, B-11 |
| E2E-026 | Turnstile failure | Use failing test key: friendly error, fallback contact shown, data retained | B-15 |
| E2E-027 | Rate limit | Exceed limit: 429 with message and phone/email | FR-037 |
| E2E-028 | Double submit | Rapid double click and network retry: single RFQ | FR-053 |
| E2E-029 | Server failure | Fake DB error: 503 message, no email | B-08 |
| E2E-030 | Email failure | Fake Resend failure: success shown, retry, admin shows failed | B-10 |
| E2E-031 | Attachments happy path | Attach PDF and DOCX; progress announced; stored privately; admin sees them | B-08 |
| E2E-040 | Admin login/roles | Each role sees only permitted navigation and collections | A-01 |
| E2E-041 | Lockout | 5 bad logins then correct password | A-03 |
| E2E-042 | Product lifecycle | Create draft -> preview -> publish -> visible within 60 s -> unpublish -> gone within 60 s | M-01, M-02 |
| E2E-043 | CSV import via admin | Dry run then import; error report downloadable | M-06 |
| E2E-044 | RFQ handling | Sales filters and searches RFQs, changes status, adds note, exports CSV | S-02..S-06 |
| E2E-045 | Attachment download | Sales gets signed link for clean file; unauthenticated gets 401/403; infected/pending blocked | S-03 |
| E2E-050 | SEO | `sitemap.xml` lists only published; `robots.txt` content (prod vs preview); canonical tags; JSON-LD validates | FR-063..067 |
| E2E-051 | 404 | Unknown URL returns 404 status with helpful page | FR-069 |
| E2E-052 | Redirects | Sample old URLs return 301 to new | FR-068 |
| E2E-053 | Analytics | `rfq_submit` event fired once on success, none on failure, no PII in payload | FR-073 |
| E2E-054 | No-JS | Browse and search work with JS disabled; RFQ page explains JS requirement | NFR-070 |
| E2E-055 | Preview noindex | Preview deployment sends `noindex` | FR-064 |

## 4. Accessibility tests

### 4.1 Automated (axe via Playwright, tags `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`, `best-practice`)
Zero violations of any impact on: Home, Categories, Category listing (with and without filters), Product detail, Search results (results, empty), RFQ page (empty list, with items, with errors, with uploads, success page), Services, About, Contact, Privacy, Accessibility, 404, and open states (navigation menu, facet disclosures, dialogs). Run at 320 px, 768 px and 1280 px, and in forced-colours/dark mode if supported.

Also: ESLint `jsx-a11y` rules, colour-token contrast unit test (all token pairs >= 4.5:1 or 3:1 for UI).

### 4.2 Manual checklist (Milestone 4)
| ID | Check | Criteria |
|---|---|---|
| A11Y-01 | Keyboard only: complete browse -> search -> add -> RFQ submit | 2.1.1, 2.1.2, 2.4.3, 2.4.7 |
| A11Y-02 | Focus not obscured by sticky header or banners | 2.4.11 |
| A11Y-03 | Target sizes >= 24x24 CSS px (design target 44) | 2.5.8 |
| A11Y-04 | No drag-only interactions | 2.5.7 |
| A11Y-05 | Consistent help (contact/RFQ help link in same relative place) | 3.2.6 |
| A11Y-06 | Redundant entry avoided (details kept when returning, no re-asking) | 3.3.7 |
| A11Y-07 | Accessible authentication: Turnstile and admin login need no cognitive test; password managers allowed (no paste blocking) | 3.3.8 |
| A11Y-08 | NVDA + Firefox/Chrome: landmarks, headings, forms, errors, live regions, upload status, tables | 1.3.1, 3.3.1, 3.3.3, 4.1.3 |
| A11Y-09 | VoiceOver macOS Safari and iOS Safari: same flows | as above |
| A11Y-10 | JAWS + Chrome smoke test (if available) | as above |
| A11Y-11 | 200% text and 400% zoom (320 px): reflow, no clipping | 1.4.4, 1.4.10 |
| A11Y-12 | Text spacing override bookmarklet | 1.4.12 |
| A11Y-13 | Windows High Contrast/forced colours | 1.4.11 |
| A11Y-14 | Reduced motion respected | 2.3.3 (AAA but policy) |
| A11Y-15 | Page titles, language, link purpose, image alt quality review | 2.4.2, 3.1.1, 2.4.4, 1.1.1 |
| A11Y-16 | Autocomplete tokens on buyer fields | 1.3.5 |
| A11Y-17 | Time limits: none, or adjustable (RFQ list does not expire) | 2.2.1 |
| A11Y-18 | Voice control (Dragon/Voice Control): visible labels match accessible names | 2.5.3 |
| A11Y-19 | Documents: sample PDFs checked; link text states type/size | NFR-004 |
| A11Y-20 | Accessibility statement accurate; feedback route tested | FR-070 |

Defect policy: critical/serious block release; moderate fixed or scheduled with owner; findings logged in the ACR.

## 5. Performance tests

Profile: simulated mobile (Moto G Power class, 4x CPU slowdown, Slow 4G); production build on preview with realistic seed (5k SKUs for search tests).

| ID | Case | Target |
|---|---|---|
| PERF-01 | Home, category listing, product detail, search results, RFQ page lab runs (median of 5) | LCP < 2.5 s (aim 2.0 s), CLS < 0.1 (aim 0.02), INP < 200 ms, TBT < 200 ms |
| PERF-02 | Page weight and JS: catalogue pages | <= 170 KB compressed JS, LCP image responsive and AVIF/WebP |
| PERF-03 | Images: no layout shift, lazy loading below the fold, correct `sizes` | CLS and audit pass |
| PERF-04 | Search latency at 5k and 10k SKUs (k6/autocannon or script, 20 concurrent) | p95 < 300 ms DB time; TTFB < 600 ms |
| PERF-05 | Cache: publish/unpublish reflected | <= 60 s |
| PERF-06 | RFQ submit server time (without attachments) | p95 < 1.5 s excluding email |
| PERF-07 | CSV import 2,000 rows in admin and 20,000 via CLI | Completes with chunking; no timeout |
| PERF-08 | Third-party budget: Turnstile loads only on RFQ page; analytics deferred | No effect on LCP |
| PERF-09 | Field data after launch (CrUX/Search Console, Plausible/Vercel) | p75 meets CWV for 28 days |

## 6. RFQ attachment test cases

Fixtures in `tests/fixtures/attachments/` include EICAR test string (as harmless text, never executable).

| ID | Case | Expected |
|---|---|---|
| ATT-01 | Valid PDF, DOCX, XLSX, CSV, PNG, JPG within limits | Accepted; stored private; metadata recorded; sha256 stored |
| ATT-02 | Exactly at size limit / 1 byte over | Accept / reject with clear message |
| ATT-03 | More files than max count; total size over limit | Rejected with per-rule message |
| ATT-04 | Zero-byte file | Rejected |
| ATT-05 | `.exe`, `.js`, `.sh`, `.bat`, `.html`, `.svg`, `.zip`, `.docm`, `.xlsm` | Rejected by extension at upload-url request |
| ATT-06 | Executable renamed `invoice.pdf` | Presign allowed, rejected at submit by magic-byte check |
| ATT-07 | Declared MIME differs from detected (for example `image/png` header on PDF) | Rejected |
| ATT-08 | Double extension `report.pdf.exe`, trailing dots/spaces, RTL override characters | Rejected or sanitised; stored key independent of name |
| ATT-09 | Path traversal in name (`../../x.pdf`, `%2e%2e`), very long name, unicode, emoji | Name sanitised for display; key unaffected; no error |
| ATT-10 | Direct PUT with larger body than declared or with different content-type than presigned | Storage rejects (conditions) |
| ATT-11 | Presigned URL used after expiry, or reused for another key | Rejected |
| ATT-12 | Submit referencing a key not in quarantine, another buyer's key, or an arbitrary storage path | Rejected; no data leak |
| ATT-13 | Same quarantine key attached to two RFQs | Second rejected (single-use) |
| ATT-14 | Abandoned uploads (never submitted) | Removed by lifecycle/cleanup within 24 h |
| ATT-15 | Upload aborted mid-way, then retry; network loss | Clear error; retry works; no partial file referenced |
| ATT-16 | Scanner returns `infected` (EICAR with fake scanner) | Attachment flagged, download blocked, sales notified in email and admin |
| ATT-17 | Scanner timeout/error | Status `error`, not downloadable, retry scheduled |
| ATT-18 | No scanner configured | `skipped` and policy applies; warning logged |
| ATT-19 | Password-protected or malformed PDF/OOXML | Accepted if signature valid; flagged `scan error`/unscannable per provider policy |
| ATT-20 | Concurrent uploads of 5 files | All succeed; progress announced accurately |
| ATT-21 | Download by unauthenticated user, by Catalogue Manager, by Sales | 401/403, 403, allowed (when clean) |
| ATT-22 | Signed URL expiry and `Content-Disposition: attachment`, `nosniff` | Expires <= 5 min; forced download |
| ATT-23 | Public bucket listing/guessing for RFQ keys | Not possible; private bucket denies anonymous |
| ATT-24 | Retention purge | Attachments deleted with RFQ; storage objects gone; audit entry |
| ATT-25 | Keyboard and screen-reader flow for choosing, removing, errors on files | Operable and announced (A11Y-08) |
| ATT-26 | Files with CSV formula content opened in admin export | Neutralised in exports |

## 7. Security tests

| ID | Case | Expected |
|---|---|---|
| SEC-01 | Response headers on all route types (HSTS, CSP, nosniff, Referrer-Policy, Permissions-Policy, frame-ancestors) | Present and correct; CSP has no `unsafe-inline` scripts on public pages (or documented exception) |
| SEC-02 | CSP violations during e2e runs | None reported on public pages |
| SEC-03 | RBAC: attempt every forbidden collection/operation per role via admin UI, REST and GraphQL | Denied |
| SEC-04 | Unauthenticated access to `/api` Payload routes for non-public data, drafts, `?draft=true`, `depth`/`where` abuse to reach unpublished or RFQ data | Denied or filtered |
| SEC-05 | IDOR: enumerate RFQ ids, attachment ids, reference numbers | Not accessible without auth |
| SEC-06 | XSS: payloads in all RFQ fields, product fields, search `q`, filters, email templates, admin notes | Escaped everywhere |
| SEC-07 | SQL injection fuzz on search params and filters | No errors, no leakage |
| SEC-08 | CSRF/Origin: cross-origin POST to `/api/rfq` and admin actions | Rejected |
| SEC-09 | Turnstile bypass attempts: missing, reused, expired, tampered token, token for another site | Rejected |
| SEC-10 | Rate limit evasion with spoofed `X-Forwarded-For` | Limits use trusted platform IP |
| SEC-11 | Oversized JSON body, deep nesting, unexpected fields | 413/400, no crash; unknown fields stripped |
| SEC-12 | Email header injection and HTML injection | Neutralised |
| SEC-13 | Admin brute force and lockout; session cookie flags; logout invalidation | Lockout works; Secure, HttpOnly, SameSite set |
| SEC-14 | Secrets scan (CI) and review of client bundle for server-only env leakage | None found |
| SEC-15 | `npm audit`/Dependabot | No high/critical unresolved |
| SEC-16 | Cron endpoints without or with wrong secret | 401 |
| SEC-17 | Preview deployments use non-production secrets and data | Verified |
| SEC-18 | Open redirect, clickjacking, directory/storage listing | Not present |
| SEC-19 | Logging: no PII or tokens in logs | Verified by test and sampling |
| SEC-20 | OWASP ZAP baseline against preview; manual review against OWASP Top 10 checklist | No high findings |
| SEC-21 | Backup restore drill into a fresh DB and bucket; verify sample RFQ and catalogue integrity | Passes within RTO |
| SEC-22 | Unpublished document and draft product not retrievable via storage URL, sitemap, search index, cache | Verified |
| SEC-23 | Privacy: IP stored only as hash; retention purge works; privacy policy matches behaviour | Verified |

## 8. Test data and tooling
- Seed: about 20 products across 4 categories, 6 attributes, 8 documents, 3 users (one per role), 5 sample RFQs.
- Fakes: `FakeMailer`, `FakeStorage` (in-memory), `FakeScanner` (configurable), `FakeTurnstile` (official test keys in e2e).
- CI jobs: `lint`, `typecheck`, `unit`, `integration`, `build`, `e2e-preview`, `a11y-preview`, `audit`. Playwright traces and axe reports uploaded as artifacts.
