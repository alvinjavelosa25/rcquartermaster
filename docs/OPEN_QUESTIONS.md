# RC Quartermaster LLC: Open Questions

Status: **Stage 1 draft**. Each item has a proposed default so work can start; "Blocks" shows the first task affected. Please answer or confirm defaults.

Observation: fetching https://rcquartermaster.com during Stage 1 returned a redirect to a Google Maps embed for "402 King Farm Blvd Suite 125-1008, Rockville, MD 20850". This was not verified and no audit of the existing site has been done. Treat the address as unconfirmed (Q-15).

## A. Access and accounts
| ID | Question | Why it matters | Proposed default | Blocks |
|---|---|---|---|---|
| Q-01 | Who owns and can grant access to: GitHub org/repo, Vercel team (commercial-use plan), Neon or Supabase, Cloudflare (R2, Turnstile, DNS?), Resend, GA4/Plausible? Is there an existing CMS or hosting account for the current site? | Environments, previews, ownership at handover | Client owns all accounts; developer invited with least privilege | F-04 |
| Q-02 | Confirm Neon vs Supabase and R2 vs Vercel Blob. | Cost, lock-in, private bucket needs | Neon + Cloudflare R2 | F-03, C-03 |
| Q-03 | Brand assets: logo (vector), colours, fonts, photography, tone of voice, brand guidelines? Any competitor or reference sites you like? | Design system and wireframes | Neutral, high-contrast institutional palette until supplied | F-08 |
| Q-04 | Who controls the domain DNS and email DNS (SPF/DKIM/DMARC)? Is there existing email on this domain (for example Microsoft 365 or Google Workspace)? | Cutover, deliverability | Client IT adds records on request | H-09 |

## B. Catalogue data
| ID | Question | Why it matters | Proposed default | Blocks |
|---|---|---|---|---|
| Q-05 | What format is product data in today (Excel, ERP export, supplier files, none)? Provide a sample of at least 50 rows. How many SKUs at launch and in 2 years? | CSV template, import mapping, search sizing | CSV/XLSX export, under 5,000 SKUs | C-16 |
| Q-06 | Where do images and spec sheets/certificates come from (manufacturers, in-house)? Do you have rights to publish them? Are PDFs accessible (tagged)? | Content readiness, copyright, 508 | Client supplies; accessibility-on-request statement | H-07 |
| Q-07 | Who owns SKU assignment and rules (format, uniqueness, retirement)? Are SKUs RC-assigned or manufacturer part numbers? Is there a variant/size model (one SKU per variant)? | Data model | One record per SKU, no variants | C-04 |
| Q-24 | Provide the intended category tree (to 3-4 levels) and the key attributes buyers filter on (size, material, NSN, GSA/contract vehicle, etc.). | Taxonomy, facets | Draft tree proposed from the 4 seed categories | C-01, C-02 |
| Q-23 | Which product facts are permitted public: manufacturer, MPN, country of origin / TAA / Buy American status, NSN, UNSPSC, lead time, minimum order? Will prices ever be shown? | Compliance claims, data model | No prices; optional manufacturer, MPN, country of origin | C-04 |
| Q-09 | Approval model: may Catalogue Managers publish directly, or must an Admin approve ("approved information")? Should unpublished categories hide their products? | Workflow and access rules | Catalogue Managers publish; products stay reachable by search | C-05 |
| Q-31 | What happens to discontinued products: keep page with "request alternative", or unpublish? | UX and SEO | Keep with "request alternative" | C-11 |

## C. RFQ
| ID | Question | Why it matters | Proposed default | Blocks |
|---|---|---|---|---|
| Q-11 | Which sales inbox(es) receive RFQs? Do different categories route to different people? Who is on-call when the primary is away? | Notification config | One shared inbox (a mailbox, not a person) | R-12 |
| Q-08 | From address and domain for transactional email (for example rfq@rcquartermaster.com)? Reply-to? Who monitors replies? | Deliverability and SPF/DKIM | Verified sending subdomain, reply-to sales inbox | R-12 |
| Q-10 | Data retention for RFQs and attachments (months/years) and legal basis (contract record-keeping, FAR record rules, internal policy)? Delete or anonymise? | Retention job, privacy policy | 24 months (730 days), hard delete incl. attachments | R-15 |
| Q-19 | Attachment limits: types, size, count? Do buyers typically send drawings, spreadsheets, SOWs, solicitations (potentially large or zip files)? | Validation rules | PDF, DOC/DOCX, XLS/XLSX, CSV, TXT, PNG, JPG; 10 MB each, 5 files, 25 MB total; no zip/macros | R-08 |
| Q-18 | Virus-scan provider: ClamAV service you host, Cloudmersive, VirusTotal-type API, or none at launch? Should attachments be blocked until scanned clean? | Cost, security posture | Hook in place, block downloads unless `clean` (or `skipped` if no provider) | R-09 |
| Q-16 | Rate-limit thresholds acceptable? Do buyers submit from shared government NAT IPs (many users, one IP)? | False positives | 5/hour and 20/day per IP; 10/day per email | R-06 |
| Q-17 | Turnstile account owner and policy: is managed (non-interactive) mode acceptable? Phone/email fallback if blocked by buyers' networks? | Accessibility and reachability | Managed mode, fallback contact on error | R-05 |
| Q-32 | Required RFQ fields beyond the brief: solicitation number, contract vehicle (GSA, VA FSS), UEI/CAGE of buyer, ship-to POC, delivery date flexibility? Which are mandatory? | Form design | Optional "solicitation or contract number" field | R-04 |
| Q-33 | Do you need an SLA statement ("we respond within 1 business day")? Auto-reply wording and expected response times? | Confirmation copy | "We respond within 1 business day" pending confirmation | R-12 |
| Q-34 | Are RFQs ever expected to contain CUI or controlled information? | Hosting and scope | No; notice on form says do not submit CUI | R-04 |

## D. Content and credentials
| ID | Question | Why it matters | Proposed default | Blocks |
|---|---|---|---|---|
| Q-12 | Business identifiers and certifications to display and their exact wording: legal name, UEI, CAGE, NAICS codes, DUNS, SAM.gov status, small/veteran-owned or other socio-economic designations, GSA schedule/VA FSS contract numbers, insurance, quality certifications. Who verifies them? | Legal accuracy; false claims carry risk | Nothing displayed until client marks each item verified | C-13 |
| Q-14 | Who writes and approves copy for Home, Services, About/Capability statement, Privacy policy and Accessibility statement? Is there an existing capability statement PDF? Is legal review available for the privacy policy? | Content readiness | Developer drafts structure; client supplies copy | C-13 |
| Q-15 | Official contact details: phone, email, mailing/physical address, hours. Is the address a real facility or a mailing address? Map shown? | Contact page, JSON-LD | Details in Site Settings; no embedded map (privacy, weight) | C-13 |
| Q-35 | Which services are offered (list) and do they need individual pages? | IA | Single Services page | C-13 |

## E. Migration and SEO
| ID | Question | Why it matters | Proposed default | Blocks |
|---|---|---|---|---|
| Q-13 | Access to the current site (CMS login, sitemap, Search Console, analytics) to audit URLs and traffic? Which URLs matter (top landing pages, backlinks)? | Redirect map | Placeholder `redirects.ts` until audit | H-06 |
| Q-36 | Existing Google Search Console / Bing Webmaster verification and Google Business Profile? | Launch monitoring | Client adds developer as user | H-06 |

## F. Compliance, analytics, operations
| ID | Question | Why it matters | Proposed default | Blocks |
|---|---|---|---|---|
| Q-20 | GA4, Plausible or both? Who owns the properties and sees reports? Do buyers' networks block GA (consider Plausible)? | Conversion tracking | Plausible primary, GA4 optional behind toggle | F-12 |
| Q-21 | Cookie/consent approach: any contractual or policy requirement for a consent banner? | Legal, UX | Cookieless Plausible needs no banner; GA4 only after consent | F-12 |
| Q-22 | Will buyers ask for an ACR/VPAT, FedRAMP, SOC 2 or specific hosting location (US-only data)? Is a third-party accessibility audit expected? | Procurement credibility | Self-assessed ACR draft; US regions for DB and storage | H-02 |
| Q-26 | Admin MFA: required? Payload has no built-in MFA, options are custom TOTP strategy, or an access layer such as Cloudflare Access/SSO in front of `/admin`. | Security for staff accounts | Strong passwords + lockout at launch, MFA planned (P-06) | H-04 |
| Q-27 | Error tracking and uptime monitoring tools (Sentry, Better Stack, etc.) and who receives alerts? | Operations | Vercel logs and a free uptime monitor | H-09 |
| Q-28 | Who maintains the site after handover (in-house developer, agency, vendor) and what is their skill level? Support/SLA expectations? | Documentation depth, hypercare | Any competent TypeScript developer | H-08 |
| Q-37 | Backup targets: RPO 24 h and RTO 8 h acceptable? Where may backups be stored? | Backup design | As stated, encrypted copy in a separate R2 bucket | H-05 |

## G. Commercial
| ID | Question | Why it matters | Proposed default | Blocks |
|---|---|---|---|---|
| Q-25 | Budget range and monthly running-cost ceiling? Approval for the dependencies and services listed in ARCHITECTURE.md section 11 (AWS S3 SDK, CSV library, `file-type`, Lighthouse CI, Upstash, error tracker, scanner)? | Scope, vendor choices | Use only the approved stack and the first six "needs approval" items marked as required | F-01 |
| Q-29 | Target launch date and any fixed deadlines (contract renewals, trade events, solicitations)? Who is the single decision-maker for approvals? | Sequencing | No fixed date | Planning |
| Q-30 | Success metrics: RFQs per month, target categories, search terms that matter? | Prioritisation, analytics | RFQ submissions per month as primary KPI | F-12 |
