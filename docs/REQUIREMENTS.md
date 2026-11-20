# RC Quartermaster LLC: Requirements

Status: **Stage 1 draft, awaiting approval**. Date: 2026-11-20.

## 1. Purpose and scope

A full redesign of rcquartermaster.com as a **procurement tool**. Buyers (VA medical centres, federal facilities, healthcare systems, institutional procurement teams) discover products, review approved information and submit a Request for Quote (RFQ).

### In scope
Public catalogue, search, RFQ list and submission pipeline, content pages, CMS admin (catalogue and RFQ management), SEO, analytics, security, accessibility, documentation.

### Out of scope
- Shopping cart, checkout, payment processing, public pricing, buyer accounts or login. Any future e-commerce is a separate project.
- Order management, ERP/inventory integration, quote document generation (quotes are prepared and sent outside the site).
- Hosting FAR/DFARS-controlled data. RFQs must not contain CUI or classified information (a notice is shown on the form).

### Glossary
| Term | Meaning |
|---|---|
| RFQ | Request for Quote submitted by a buyer |
| SKU | Stock-keeping unit, unique product identifier owned by RC Quartermaster |
| Approved information | Content with status Published. Only this is public |
| Catalogue Manager | Staff role that maintains products, categories, attributes and documents |
| Sales/RFQ Viewer | Staff role that handles RFQs |
| ACR/VPAT | Accessibility Conformance Report, commonly requested by federal buyers |

### MoSCoW legend
**M** Must (launch blocker), **S** Should (launch target, may slip with agreement), **C** Could (post-launch candidate), **W** Won't (this release).

### Personas
- **Buyer**: procurement officer, contracting specialist or facility manager. Often on a locked-down government network, older browsers, assistive technology, short on time, needs SKU-level precision and documents for the file.
- **Sales/RFQ staff**: triages RFQs, prepares quotes, tracks status.
- **Catalogue Manager**: maintains accurate, approved product data.
- **Admin**: owns users, settings, retention, integrations.

---

## 2. User stories and acceptance criteria

Traceability: each story lists the functional requirements (FR) it exercises.

### 2.1 Buyer

**B-01 Browse by category** (FR-001, FR-002, FR-003)
As a buyer I want to browse a category hierarchy so that I can find product types without knowing SKUs.
- Given I am on the Categories page, When it loads, Then I see top-level categories with names and (where provided) images, each a link.
- Given I open a category that has subcategories, When the page loads, Then I see its subcategories and the published products in it and its descendants, with a breadcrumb trail.
- Given a category has more than 24 products, When I view it, Then results are paginated with accessible pagination links and a stated total.
- Given a category has no published products, When I view it, Then I see an empty state with a search box and a link to submit a general RFQ.

**B-02 Keyword search** (FR-011, FR-013, FR-014)
As a buyer I want to search by keyword or SKU so that I can reach a product fast.
- Given I enter an exact SKU, When I submit, Then that product is the first result.
- Given I enter a partial SKU or product phrase, When I submit, Then relevant published products are returned ranked by relevance.
- Given I enter a query with a minor typo (for example "gloves nitirle"), When I submit, Then similar-matching products are returned (Should).
- Given no results match, When results render, Then I see a "no results" message with suggestions (broaden query, browse categories, general RFQ). The result count is announced to screen readers.

**B-03 Filter results** (FR-010, FR-012)
As a buyer I want to filter by category and attributes so that I can narrow results.
- Given a result set, When I select a filter value, Then results update, the URL reflects the filter (shareable, back button works) and the count is announced.
- Given active filters, When I choose "Clear all", Then the filters reset.
- Filters work without JavaScript through standard form submission (progressive enhancement).

**B-04 View product detail** (FR-004, FR-005, FR-007)
As a buyer I want complete approved product information so that I can decide whether to request a quote.
- Given a published product, When I open its page, Then I see name, SKU, description, specifications table, images with alt text, documents and an "Add to RFQ" button.
- Given a product is draft or unpublished, When I request its URL, Then I receive the 404 page and it is absent from search, listings and sitemap.
- Given a product was unpublished after being indexed, When a crawler requests it, Then it is not served (404; 410 is acceptable).

**B-05 Download documents** (FR-006)
As a buyer I want spec sheets and certificates so that I can include them in my procurement file.
- Given a product has published documents, When I view it, Then each document shows title, type, file format, size and (where set) effective/expiry date, and downloads on activation.
- Given a document is draft or unpublished, Then neither the link nor the file URL is available publicly.

**B-06 Add to RFQ** (FR-008, FR-030)
As a buyer I want to add a product to an RFQ list so that I can quote multiple items at once.
- Given I am on a product page, When I activate "Add to RFQ", Then the item is added with quantity 1 (or my chosen quantity), the RFQ item count updates and a status message is announced via a live region. Focus is not moved unexpectedly.
- Given the product is already in my list, When I add it again, Then the quantity increases or I am told it is already listed (no duplicate lines).

**B-07 Manage RFQ list** (FR-030, FR-031)
As a buyer I want to edit my list so that the request is accurate.
- Given items in my list, When I change a quantity to a positive integer, Then it is saved. Invalid values (0, negative, non-integer, above maximum) show an inline error.
- Given items in my list, When I remove an item, Then it is removed and the change is announced.
- Given I close the browser tab, When I return on the same device, Then my list is still present.
- Given a listed product has since been unpublished, When I open my RFQ page, Then that line is flagged as unavailable and can be removed or kept as a free-text line (the SKU snapshot is retained).
- All actions are operable by keyboard with no drag-and-drop dependency.

**B-08 Submit RFQ** (FR-034, FR-035, FR-036, FR-038, FR-040)
As a buyer I want to submit the RFQ with my details so that sales can respond.
- Given a completed valid form and a passed Turnstile check, When I submit, Then the RFQ is saved, I see a confirmation page with a reference number and my RFQ list is cleared.
- Given I submit with missing/invalid required fields, When validation fails, Then an error summary receives focus, lists each error as a link to its field and each field shows an inline message. Entered data is retained.
- Given I attach a permitted file within limits, When I submit, Then it is attached to the RFQ.
- Given the server is unavailable or rate-limited, When I submit, Then I see a clear message, my data is retained and I am given the sales phone/email alternative.

**B-09 General RFQ** (FR-032, FR-033)
As a buyer I want to submit an RFQ without catalogue SKUs so that I can ask for items not listed.
- Given an empty RFQ list, When I open the RFQ page, Then I can describe my needs in a required free-text field and submit.
- Given I want an unlisted item, When I add a free-text line (description, quantity), Then it is submitted alongside SKU lines (Should).

**B-10 Confirmation** (FR-042)
- Given a successful submission, When processing completes, Then I receive an email with the reference number, a summary of items and expected next steps within a minute under normal conditions.
- Given the email provider fails, Then my submission is still recorded and confirmed on screen, and the email is retried.

**B-11 Accessible forms** (NFR-001)
As a buyer using assistive technology I want to complete the RFQ independently.
- Given I use only a keyboard, When I complete and submit the RFQ, Then every control is reachable and operable, focus order is logical and focus is always visible and not obscured.
- Given I use NVDA/JAWS/VoiceOver, When I complete the form, Then labels, required state, format hints, errors, status messages and upload progress are announced.
- Given the Turnstile challenge cannot be completed, Then an alternative (email/phone) is offered and no cognitive-function test is required.
- Given I previously entered my details in this session, When the form needs them again, Then they are retained (WCAG 3.3.7).

**B-12 Verify credentials** (FR-071, FR-072)
- Given I am on About/Capability, Then I see the company's legal name, UEI, CAGE code, NAICS codes and certifications as approved by the client, plus a link to the capability statement PDF.

**B-13 Mobile use** (NFR-010, NFR-100)
- Given a 320 px wide viewport at 400% zoom, Then content reflows without horizontal scrolling (except data tables, which scroll within a labelled region) and targets are at least 44 px.

### 2.2 Sales/RFQ staff

**S-01 Notification** (FR-041, FR-043)
- Given a buyer submits an RFQ, When it is saved, Then each configured sales inbox receives an email with reference, buyer details, items, dates, instructions and a link to the admin record. Attachments are linked (not attached) and require login.
- Given recipients are changed in settings, When the next RFQ arrives, Then the new list is used. If no list is set in the admin, the `RFQ_NOTIFY_TO` environment default is used.

**S-02 Find RFQs** (FR-044)
- Given I am logged in as Sales, When I open RFQs, Then I can search by reference, buyer name, organisation, email or SKU and filter by status and date range, sorted newest first by default.

**S-03 Review detail and attachments** (FR-045, FR-039)
- Given an RFQ, When I open it, Then I see all submitted fields, items, notification status and attachments with scan status.
- Given an attachment is not scan-clean (pending, infected, error), Then it cannot be downloaded and the reason is shown.
- Given an attachment is clean, When I click it, Then I receive a short-lived (<= 5 minutes) signed link. Anonymous users cannot access any attachment.

**S-04 Update status** (FR-046, FR-050)
- Given an RFQ with status New, When I set In progress, Quoted or Closed, Then it saves and the change (who, when, from, to) is recorded.
- Buyer-submitted fields are read-only for Sales.

**S-05 Export** (FR-047)
- Given a filtered list, When I export, Then I receive a CSV of the matching RFQs (one row per RFQ with items summarised; line-item export optional), UTF-8 with BOM for Excel, with spreadsheet-formula injection neutralised.

**S-06 Internal notes** (FR-049)
- Given an RFQ, When I add a note, Then it records author and time, and is never shown to the buyer.

**S-07 Role limits** (FR-021)
- Given I am Sales, When I try to edit products/categories/documents, Then I have no access to those collections' write operations.

### 2.3 Catalogue Manager

**M-01 Create and edit products** (FR-004, FR-010, FR-017)
- Given I am logged in, When I create a product with a unique SKU, name, category, description, specifications and images (alt text required), Then it saves as Draft and is not public.
- Given a SKU already exists (case-insensitive, trimmed), When I save, Then validation blocks the duplicate.

**M-02 Publish and unpublish** (FR-007, FR-017)
- Given a valid draft, When I publish, Then it appears publicly within 60 seconds (cache revalidation), is indexed for search and added to the sitemap.
- Given a published product, When I unpublish, Then it disappears from listings, search, sitemap and direct URL within 60 seconds.
- Publishing is blocked if required public fields are missing.

**M-03 Categories** (FR-001)
- Given I create a category with a parent, When saved, Then its path is computed (for example `janitorial/floor-care`), cycles are rejected and descendants' paths update if I rename or move it.
- Given I unpublish a category, Then its public page is removed and its products remain reachable via other categories and search (behaviour confirmed in OPEN_QUESTIONS).

**M-04 Attributes** (FR-010)
- Given I define an attribute (key, label, type text/number/boolean/enum, unit, filterable), When I assign values on products, Then filterable attributes appear as facets on listing and search once at least one published product has a value.

**M-05 Documents** (FR-006, FR-023)
- Given I upload a PDF with title, type and (optional) dates, When I publish it and attach it to a product, Then it is downloadable on that product page.
- Upload rejects non-allowed types and files above the size limit.

**M-06 CSV import** (FR-019)
- Given a CSV in the documented template, When I upload it with "Dry run", Then I get a report (rows to create, update, skip, errors with row numbers and reasons) and nothing is written.
- Given a validated file, When I run the import, Then products are upserted by SKU as **drafts by default** (publish flag optional and role-restricted), and a downloadable error report is produced for failed rows. Invalid rows do not block valid rows (configurable "stop on first error").
- Given unknown categories or attributes, Then rows fail with explicit errors (no silent creation unless enabled).

**M-07 CSV export** (FR-020)
- Given I export products, Then I receive a CSV that can be re-imported unchanged (round-trip), including status.

**M-08 Preview** (FR-082)
- Given a draft, When I use Preview, Then I see it as the public page with a visible "Draft preview" banner, accessible only while logged in.

**M-09 Role limits** (FR-021)
- Given I am a Catalogue Manager, When I navigate to RFQs, Then I cannot view them.

### 2.4 Admin

**A-01 Users and roles** (FR-021, FR-080)
- Given I am Admin, When I create a user and assign a role (Admin, Catalogue Manager, Sales/RFQ Viewer), Then access follows the permissions matrix in ARCHITECTURE.md.
**A-02 Settings** (FR-043, FR-048, FR-081)
- Given I am Admin, When I edit RFQ recipients, retention period or displayed business identifiers, Then changes apply without a deploy and are versioned/audited.
**A-03 Account protection** (NFR-021)
- Given five failed logins, When another is attempted, Then the account is locked for the configured period.

---

## 3. Functional requirements

### 3.1 Catalogue and search
| ID | Requirement | Priority |
|---|---|---|
| FR-001 | Hierarchical categories (parent/child, recommended max depth 4) with computed unique path slug | M |
| FR-002 | Category index and category listing pages showing subcategories and products of the category and its descendants | M |
| FR-003 | Listings paginated (default 24), sortable (relevance/name/SKU) | M |
| FR-004 | Product record: name, SKU, summary, description (rich text), specifications (label/value/unit), images, documents, primary category, optional additional categories, manufacturer, manufacturer part number, unit of measure, availability state | M |
| FR-005 | Every product image requires alt text (enforced in admin) | M |
| FR-006 | Product page lists published downloadable documents with type, format, size | M |
| FR-007 | Only Published content (products, categories, documents, pages) is public in pages, search, sitemap, APIs and file URLs | M |
| FR-008 | "Add to RFQ" action on product detail and listing/search result cards | M |
| FR-009 | Related products on product page | C |
| FR-010 | Admin-defined configurable attributes (text, number, boolean, enum) with filterable flag and optional category scoping | M |
| FR-011 | Keyword search across name, SKU, summary, description, specification values and attribute values | M |
| FR-012 | Filters by category and filterable attributes with facet counts; state kept in URL | M |
| FR-013 | Exact and prefix SKU match ranks first | M |
| FR-014 | Typo tolerance using trigram similarity | S |
| FR-015 | Search suggestions/autocomplete (accessible combobox pattern) | C |
| FR-016 | Search implemented behind a `SearchService` interface and `SearchIndexer` interface so Meilisearch/Algolia can replace Postgres | M |
| FR-017 | Product and category Draft/Published states; unpublish removes from all public surfaces | M |
| FR-018 | Availability states: Available, On request, Discontinued (discontinued shown with "request alternative" CTA, no Add to RFQ) | S |
| FR-019 | CSV bulk import: template, dry run, upsert by SKU, per-row error report, default Draft, chunked processing | M |
| FR-020 | CSV bulk export of products (round-trippable) | M |
| FR-021 | Roles: Admin, Catalogue Manager, Sales/RFQ Viewer with enforced collection/field access | M |
| FR-022 | Version history and restore for products/categories/pages | S |
| FR-023 | Document management: title, type (spec sheet, certificate, SDS, brochure, other), file, effective/expiry date, Draft/Published; type and size limits | M |

### 3.2 RFQ
| ID | Requirement | Priority |
|---|---|---|
| FR-030 | Buyer can add, edit quantity, and remove multiple SKUs in an RFQ list | M |
| FR-031 | RFQ list persisted client-side (localStorage), versioned schema, cross-tab sync, safe on corrupt data | M |
| FR-032 | General RFQ (no SKUs) with required description | M |
| FR-033 | Free-text line items for non-catalogue products | S |
| FR-034 | Fields: buyer name, organisation, facility/department, role, email, phone; items with quantity; needed-by date; delivery location/details; special instructions; attachments; privacy acknowledgement | M |
| FR-035 | Shared Zod schemas used client-side and server-side; server is authoritative | M |
| FR-036 | Cloudflare Turnstile verified server-side on submission | M |
| FR-037 | Rate limiting on RFQ submit and upload-URL endpoints (per IP hash and per email) | M |
| FR-038 | Attachments: allowed types, max size, max count, max total, server-side verification (extension, declared MIME, magic bytes) | M |
| FR-039 | Virus-scan hook (`AttachmentScanner` interface); attachments gated by scan status; concrete scanner provider selected with client | M (hook) / S (provider) |
| FR-040 | RFQ persisted to database with unique, non-guessable reference number (`RCQ-YYYYMM-XXXXXX`); line items store SKU/name snapshots | M |
| FR-041 | Notification email to sales inbox(es) via Resend | M |
| FR-042 | Confirmation email to buyer with reference number and summary | M |
| FR-043 | Recipient list configurable via env default and admin override | M |
| FR-044 | Admin RFQ list with search and filters (status, date, text) | M |
| FR-045 | Admin RFQ detail view with attachments (scan status, signed download) | M |
| FR-046 | RFQ status: New, In progress, Quoted, Closed | M |
| FR-047 | RFQ CSV export of filtered list | M |
| FR-048 | Configurable retention period; scheduled purge of RFQs and attachments past retention; purge is logged | M |
| FR-049 | Internal notes on RFQs | S |
| FR-050 | Status-change history (who/when/from/to) | S |
| FR-051 | Email delivery status tracking and automatic retry; sales can see "email failed" and resend | S |
| FR-052 | Assign RFQ to a sales user | C |
| FR-053 | Idempotent submission (double-click or retry does not create duplicates) | M |

### 3.3 Pages, SEO and content
| ID | Requirement | Priority |
|---|---|---|
| FR-060 | Pages: Home, Categories, Category listing, Product detail, Search results, RFQ, Services, About/Capability, Contact, Privacy, Accessibility statement, 404 | M |
| FR-061 | Home: value proposition, category entry points, search, featured products, credentials strip, RFQ call to action | M |
| FR-062 | Home content and static pages editable in CMS (rich text, limited block set) | M |
| FR-063 | `sitemap.xml` generated from published content, with lastmod | M |
| FR-064 | `robots.txt` blocking `/admin`, `/api`, RFQ thank-you and search-result permutations; referencing sitemap; environment-aware (preview deployments noindex) | M |
| FR-065 | Organization JSON-LD site-wide | M |
| FR-066 | Product JSON-LD (no price/Offer because no public pricing) and BreadcrumbList | M / S (breadcrumb) |
| FR-067 | Canonical URLs, unique titles/meta descriptions, Open Graph tags | M |
| FR-068 | 301 redirect map from old URLs (placeholder file until audit completes), tested in CI | M |
| FR-069 | Custom 404 with search box and category links, correct 404 status | M |
| FR-070 | Accessibility statement with conformance claim, known limitations, feedback contact and date | M |
| FR-071 | Display of business identifiers and certifications (UEI, CAGE, NAICS, small-business designations, contract vehicles) from admin-managed settings; each requires client verification | M |
| FR-072 | Downloadable capability statement PDF | S |
| FR-073 | Analytics: page views plus events `add_to_rfq`, `rfq_start`, `rfq_submit` (conversion), `search`, `document_download`; no PII | M |
| FR-074 | Consent/cookie notice behaviour appropriate to chosen analytics (Plausible cookieless needs none; GA4 may) | S |
| FR-075 | Contact page: phone, email, address, hours, link to RFQ | M |
| FR-076 | Contact form (general inquiry) | C |
| FR-080 | Payload admin at `/admin` with role-based access | M |
| FR-081 | Site Settings global: RFQ recipients, retention, contact details, identifiers, analytics toggles | M |
| FR-082 | Draft preview for authorised staff | S |

---

## 4. Non-functional requirements

| ID | Requirement | Priority |
|---|---|---|
| NFR-001 | WCAG 2.2 Level AA across the public site, including new 2.2 criteria: 2.4.11 Focus Not Obscured, 2.5.7 Dragging Movements, 2.5.8 Target Size (Minimum), 3.2.6 Consistent Help, 3.3.7 Redundant Entry, 3.3.8 Accessible Authentication | M |
| NFR-002 | Manual assistive-technology testing (NVDA + Firefox/Chrome, VoiceOver + Safari iOS/macOS, keyboard only, 400% zoom) before launch | M |
| NFR-003 | Section 508-aligned conformance documentation: ACR/VPAT draft | S |
| NFR-004 | Uploaded public PDFs: guidance and checks for tagged/accessible PDFs; alternative format available on request | S |
| NFR-010 | Core Web Vitals at p75 on mobile: LCP < 2.5 s, CLS < 0.1, INP < 200 ms | M |
| NFR-011 | Performance budget: <= 170 KB compressed JS on catalogue pages; images AVIF/WebP, responsive, lazy except LCP image; fonts self-hosted | M |
| NFR-012 | Catalogue pages statically generated/ISR with on-demand revalidation; search server-rendered; p95 search query < 300 ms at 10k SKUs | M |
| NFR-020 | HTTPS everywhere, HSTS, secure headers (CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors) | M |
| NFR-021 | Role-based admin access; login lockout; strong passwords; MFA path documented (see OPEN_QUESTIONS Q-26) | M / S (MFA) |
| NFR-022 | Input validation and output encoding everywhere; no raw HTML rendering of CMS rich text; CSV formula-injection protection | M |
| NFR-023 | Secrets only via environment variables; none committed; secret scanning enabled | M |
| NFR-024 | OWASP Top 10 review before launch; dependency audit in CI | M |
| NFR-025 | Attachments stored privately; never publicly addressable; access only via short-lived signed URLs after authorisation | M |
| NFR-026 | PII minimisation: IPs stored only as salted hashes; no PII in logs or analytics | M |
| NFR-030 | Backups: automated daily DB backup plus point-in-time recovery where the plan allows; object storage versioning; targets RPO <= 24 h, RTO <= 8 h (proposed) | M |
| NFR-031 | Documented and rehearsed restore process | M |
| NFR-032 | Availability target 99.9% (inherits platform SLAs); graceful degradation when email/Turnstile/search degrade | S |
| NFR-040 | SEO: server-rendered HTML, clean hierarchical URLs, structured data validated, no indexable duplicate filter URLs | M |
| NFR-050 | Maintainability: TypeScript strict, ESLint, Prettier, unit coverage >= 80% for domain logic (search, RFQ, CSV, validation), conventional folder structure, ADRs for key decisions | M |
| NFR-051 | Low lock-in: provider interfaces for search, storage, email, scanner, rate limiting; no Vercel-proprietary data services; Docker self-hosting path documented | M |
| NFR-060 | Documentation: README, environment variable reference, admin user guide, deployment guide, handover checklist | M |
| NFR-070 | Browser support: last 2 versions of Chrome, Edge, Firefox, Safari; iOS Safari 16+; graceful degradation without JavaScript for browse, search and contact (RFQ submit requires JS for Turnstile and uploads) | M |
| NFR-071 | Observability: structured server logs, error tracking (provider to be approved), uptime check | S |
| NFR-080 | Data retention and deletion policy implemented per FR-048 and reflected in the privacy policy | M |
| NFR-100 | Mobile-first responsive design from 320 px; reflow at 400% zoom | M |
| NFR-110 | Cost: stay within managed free/low tiers where possible; commercial-use plans where licences require (for example Vercel Pro) | S |

## 5. Constraints (from brief)
No cart/checkout/payments. Next.js App Router, TypeScript, Tailwind, Payload CMS 3 in the same project, PostgreSQL (Neon or Supabase), Postgres FTS behind an interface, R2 or Vercel Blob, Resend, Turnstile and rate limiting, React Hook Form and Zod, GA4 and/or Plausible, Vitest, Playwright, axe, Vercel with preview deployments. No substitutions without asking.
