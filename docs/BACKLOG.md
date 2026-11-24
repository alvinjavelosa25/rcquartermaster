# RC Quartermaster LLC: Backlog

Status: **Stage 1 draft, awaiting approval**. Estimates are engineering hours for one competent TypeScript developer, excluding client review latency. Accuracy is roughly +/-25% until OPEN_QUESTIONS blockers are resolved. Contingency (15%) is shown separately.

## Epics

| ID | Epic | Outcome |
|---|---|---|
| E1 | Platform and DevOps | Repo, environments, CI, hosting, migrations |
| E2 | Design system and accessibility | Accessible, mobile-first UI foundation |
| E3 | Catalogue data and admin | Collections, roles, workflow, CSV |
| E4 | Discovery | Category browsing, product pages, search |
| E5 | Content and SEO | Static pages, structured data, sitemap, redirects |
| E6 | RFQ | List, form, uploads, pipeline, admin handling |
| E7 | Security and compliance | Headers, abuse controls, retention, privacy |
| E8 | Quality and performance | Test automation, CWV, manual a11y audit |
| E9 | Operations and handover | Backups, docs, launch, training |

## Milestone 1: Foundation (96 h)

| ID | Epic | Task | Depends on | Est (h) |
|---|---|---|---|---|
| F-01 | E1 | Initialise Next.js + Payload + Tailwind, TS strict, ESLint, Prettier, folder layout | approval | 6 |
| F-02 | E1 | Zod-validated `env.ts` and `.env.example` | F-01 | 3 |
| F-03 | E1 | Neon project, Payload Postgres adapter, migration workflow, local DB (Docker Compose) | F-01 | 5 |
| F-04 | E1 | Vercel project, preview deployments, per-preview Neon branch, env scopes | F-03, Q-01 | 5 |
| F-05 | E1 | GitHub Actions CI (lint, typecheck, unit, build) | F-01 | 4 |
| F-06 | E3 | Users collection, three roles, access helpers, lockout, first-admin bootstrap | F-03 | 8 |
| F-07 | E3 | SiteSettings global (contact, recipients, retention, identifiers, analytics) | F-06 | 5 |
| F-08 | E2 | IA, sitemap, mobile-first wireframes for key pages and RFQ flow, review with client | Q-03 | 16 |
| F-09 | E2 | Design tokens (colour contrast, type, spacing, focus), base components (Button, Input, Select, Checkbox, Field, Alert, Breadcrumb, Pagination, Card, Table) | F-08 | 16 |
| F-10 | E2 | App shell: header, navigation, search field, RFQ counter, footer, skip link, landmarks | F-09 | 10 |
| F-11 | E7 | Baseline security headers and CSP spike (nonce vs hash), measure CWV impact, decide | F-01 | 6 |
| F-12 | E8 | Analytics scaffold (Plausible/GA4 toggles, event helper, no PII) | F-10, Q-20 | 3 |
| F-13 | E8 | Vitest, Playwright, axe harness; example specs; CI e2e job on preview | F-05 | 6 |
| F-14 | E1 | Structured logging helper, error boundaries, 404/500 pages | F-10 | 3 |
| | | **Milestone total** | | **96** |

Exit criteria: deployed preview with login, roles enforced, design system documented, CI green, CSP decision recorded.

## Milestone 2: Catalogue (189 h)

| ID | Epic | Task | Depends on | Est (h) |
|---|---|---|---|---|
| C-01 | E3 | Categories collection: hierarchy, path/depth hooks, cycle prevention, drafts | F-06 | 8 |
| C-02 | E3 | AttributeDefinitions collection and validation | C-01 | 5 |
| C-03 | E3 | Media and Documents collections; R2 storage adapter (public bucket); upload limits; unpublish handling | F-03, Q-02 | 10 |
| C-04 | E3 | Products collection: drafts, SKU uniqueness/normalisation, specs, attributes, relations, publish validation | C-01, C-02, C-03 | 12 |
| C-05 | E3 | Publish workflow, approvedBy/At, access rules (public sees published only), tests | C-04 | 5 |
| C-06 | E3 | Admin UX: list columns, filters, groupings, labels and descriptions, live preview | C-04 | 4 |
| C-07 | E4 | Search schema migration (`search_documents`, tsvector, GIN, trigram) | C-04 | 8 |
| C-08 | E4 | `SearchService`/`SearchIndexer` interfaces, Postgres implementation, ranking, facets | C-07 | 14 |
| C-09 | E4 | Index sync hooks, reindex script, consistency tests | C-08 | 6 |
| C-10 | E4 | Categories index and category listing pages: breadcrumbs, facets, pagination, empty states | C-08, F-10 | 14 |
| C-11 | E4 | Product detail page: gallery, specs table, documents, availability states, Add to RFQ slot | C-04, F-10 | 14 |
| C-12 | E4 | Search results page: query, filters in URL, sort, no-JS support, empty states, announcements | C-08 | 12 |
| C-13 | E5 | Pages collection and templates: Home, About/Capability, Services, Contact, Privacy, Accessibility; credentials component | F-07, F-09, Q-12, Q-14 | 24 |
| C-14 | E5 | SEO: metadata, canonicals, `sitemap.xml`, `robots.txt` (env aware), Organization and Product JSON-LD, breadcrumb JSON-LD | C-11, C-13 | 8 |
| C-15 | E5 | Redirect map placeholder file, loader in `next.config`, test | F-01 | 3 |
| C-16 | E3 | CSV import: template, Zod row validation, dry run, upsert by SKU, chunking, error report, CLI + admin UI | C-04, Q-05 | 14 |
| C-17 | E3 | CSV export (round-trippable, formula-injection safe) | C-16 | 5 |
| C-18 | E3 | Seed script: about 20 products across 4 categories, attributes, documents, images | C-04 | 6 |
| C-19 | E4 | On-demand revalidation (`revalidateTag`) on publish/unpublish/category move | C-04 | 5 |
| C-20 | E8 | Unit tests (search, CSV, slug/path), Playwright (browse, search) and axe for catalogue pages | C-10..C-12 | 12 |
| | | **Milestone total** | | **189** |

Exit criteria: catalogue manager can create, import, publish products; buyers can browse, search, filter and read product pages; sitemap and structured data valid; catalogue axe checks pass.

## Milestone 3: RFQ (166 h)

| ID | Epic | Task | Depends on | Est (h) |
|---|---|---|---|---|
| R-01 | E6 | Shared Zod schemas (buyer, items, dates, files) and error message catalogue | F-01 | 4 |
| R-02 | E6 | RFQ list store: localStorage with versioned schema, cross-tab sync, corruption-safe, revalidation against catalogue | R-01 | 10 |
| R-03 | E6 | Add to RFQ buttons and RFQ list UI (quantities, remove, live-region announcements, unavailable lines) | R-02, C-11 | 10 |
| R-04 | E6 | RFQ form UI: React Hook Form, error summary, autocomplete attributes, general RFQ mode, free-text lines, form state retention | R-01, F-09 | 16 |
| R-05 | E7 | Turnstile client widget and server verification; fallback contact path | R-04, Q-17 | 6 |
| R-06 | E7 | Rate limiter (Postgres) with IP-hash and email keys; Retry-After; cleanup cron | F-03, Q-16 | 8 |
| R-07 | E6 | Upload-URL endpoint, presigned PUT to quarantine, client uploader with progress, retry, accessible status | R-04, C-03 | 14 |
| R-08 | E7 | Attachment validation: extension allow-list, magic bytes, size/count/total limits, filename sanitisation, promotion to private bucket | R-07 | 10 |
| R-09 | E7 | `AttachmentScanner` interface, Noop provider, status gating, provider-ready tests | R-08, Q-18 | 6 |
| R-10 | E6 | Rfqs and RfqAttachments collections; reference generator; access rules; status history hook; retention fields | F-06 | 10 |
| R-11 | E6 | Submit route handler: origin check, Turnstile, rate limit, validate, transaction, idempotency, error contract | R-05, R-06, R-08, R-10 | 12 |
| R-12 | E6 | Email: `Mailer` interface, Resend adapter, sales and buyer templates (HTML and text), status tracking, retry cron, resend action | R-11, Q-08, Q-11 | 12 |
| R-13 | E6 | Admin RFQ experience: columns, search, filters, detail layout, attachment signed download, notes | R-10 | 12 |
| R-14 | E6 | RFQ CSV export (filtered) | R-13 | 5 |
| R-15 | E7 | Retention setting and purge job (RFQs, attachments, audit of purge) | R-10, Q-10 | 8 |
| R-16 | E8 | Conversion tracking: `add_to_rfq`, `rfq_start`, `rfq_submit`, `search`, `document_download` | F-12, R-11 | 4 |
| R-17 | E6 | Confirmation page (noindex), reference display, print-friendly summary | R-11 | 3 |
| R-18 | E8 | Unit tests (schemas, reference, limiter, validation, store) and Playwright e2e (RFQ submit, validation errors, attachments, rate limit, idempotency) with axe | R-03..R-15 | 16 |
| | | **Milestone total** | | **166** |

Exit criteria: end-to-end RFQ works on preview with real Turnstile test keys, Resend sandbox and R2; attachment negative tests pass; sales can triage in admin.

## Milestone 4: Hardening and Launch (152 h)

| ID | Epic | Task | Depends on | Est (h) |
|---|---|---|---|---|
| H-01 | E8 | Manual accessibility audit (keyboard, NVDA, VoiceOver, 400% zoom, forced colours) and remediation | M3 | 24 |
| H-02 | E8 | Accessibility statement finalisation and ACR/VPAT draft | H-01 | 6 |
| H-03 | E8 | Performance tuning, CWV verification on real mobile profiles, bundle budgets, image audit | M3 | 16 |
| H-04 | E7 | Security review: CSP finalisation, headers verification, OWASP checklist, RBAC tests, dependency audit, ZAP baseline | M3 | 16 |
| H-05 | E9 | Backup automation (pg_dump to R2, retention), R2 versioning, restore drill, runbook | F-03 | 10 |
| H-06 | E5 | Apply final redirect map from audit; redirect tests; Search Console plan | Q-13 | 6 |
| H-07 | E3 | Product data load: mapping, import dry runs, data quality report, image/document upload support | Q-05, Q-06 | 16 |
| H-08 | E9 | Documentation: README, env reference, admin user guide, deployment guide, restore guide, handover checklist | M3 | 20 |
| H-09 | E9 | Production cutover: DNS, TLS, SPF/DKIM/DMARC for Resend domain, production Turnstile, Vercel plan, uptime monitors | Q-01, Q-08 | 8 |
| H-10 | E8 | UAT support and defect fixing | M3 | 20 |
| H-11 | E9 | Launch checklist, smoke tests, 2-week hypercare plan | H-09 | 6 |
| H-12 | E9 | Admin training session and recorded walkthrough | H-08 | 4 |
| | | **Milestone total** | | **152** |

Exit criteria: all Must requirements verified per TEST_PLAN, no open critical or serious a11y/security defects, restore drill passed, handover checklist signed.

## Summary

| Milestone | Hours |
|---|---|
| 1 Foundation | 96 |
| 2 Catalogue | 189 |
| 3 RFQ | 166 |
| 4 Hardening and Launch | 152 |
| **Subtotal** | **603** |
| Contingency (15%) | 90 |
| **Total with contingency** | **693** |

Not included: client content writing, product photography, data cleansing at the client side, PM/meetings overhead, paid scanner provider integration beyond the hook (estimate after Q-18), ACR by a third-party auditor.

## Post-launch candidates (not scheduled)
| ID | Task | Est (h) |
|---|---|---|
| P-01 | Search autocomplete (accessible combobox) | 10 |
| P-02 | Related products | 6 |
| P-03 | Contact form with Turnstile and email | 8 |
| P-04 | Admin-managed redirects collection | 8 |
| P-05 | RFQ assignment and SLA reminders | 10 |
| P-06 | MFA for admin (TOTP or SSO) if not in launch | 16 |
| P-07 | Meilisearch/Algolia provider | 24 |
| P-08 | Capability statement generator / downloadable PDF | 8 |

## Risks
| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| RK-1 | Product data quality and format unknown | Schedule | Early sample file (Q-05), data quality report, import dry-run |
| RK-2 | Accessibility of Turnstile and third-party widgets | Compliance | AT testing in M3, fallback contact path |
| RK-3 | Nonce CSP forces dynamic rendering | CWV | Spike F-11, hybrid policy |
| RK-4 | Payload/Next.js version coupling | Upgrades | Pin versions, upgrade as pair, ADR |
| RK-5 | Payload admin accessibility out of our control | Staff only | Scope public conformance claim; document |
| RK-6 | Vercel serverless limits (body size, duration) on uploads and CSV | Functionality | Presigned uploads, chunked/CLI imports |
| RK-7 | Business identifiers or certifications displayed inaccurately | Legal/reputation | Per-item `verified` flag, client sign-off |
| RK-8 | Email deliverability to .gov/.mil recipients | Missed RFQ confirmations | SPF/DKIM/DMARC, test with target domains, phone fallback on confirmation page |
| RK-9 | Hosting providers lack FedRAMP authorisation | Buyer objections | Site holds no CUI; notice on form; confirm in Q-22 |
| RK-10 | Budget unconfirmed | Scope | Managed free tiers, prioritised MoSCoW, optional items flagged |
