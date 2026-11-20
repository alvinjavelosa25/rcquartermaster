# Handover checklist

Tick each item and record the date and the person. Items marked (client) need a client decision or access.

## Accounts and access
- [ ] GitHub repository owned by the client; developers invited with least privilege (client)
- [ ] Vercel team on a commercial plan, owned by the client (client)
- [ ] Neon project, Cloudflare (R2, Turnstile, DNS if used), Resend, GA4/Plausible owned by the client (client)
- [ ] All shared secrets stored in the client's password manager; developer access can be revoked
- [ ] Domain and DNS records documented; who can change them is named (client)

## Environments and configuration
- [ ] Production, Preview and local environment variables match docs/ENVIRONMENT.md
- [ ] `SITE_ENV=production`; preview sites are `noindex`
- [ ] Real Turnstile keys in production; test keys only in preview/dev
- [ ] Buckets private; CORS and lifecycle rules applied (docs/DEPLOYMENT.md 1.3)
- [ ] Cron jobs visible in Vercel and returning 200 (email-retry, retention, cleanup)
- [ ] Resend domain verified (SPF, DKIM, DMARC); test email delivered to a `.gov` or `.mil` recipient
- [ ] RFQ sales inbox(es) confirmed (client) and entered in Site settings

## Content and data
- [ ] Product data imported, reviewed and published by the client (client)
- [ ] Business identifiers and certifications entered and marked Verified only after client approval (client)
- [ ] About, Services, Contact details finalised (client)
- [ ] Privacy policy reviewed by legal and published (client)
- [ ] Accessibility statement reviewed; ACR/VPAT decision recorded (client)
- [ ] Retention period confirmed and set (client)
- [ ] Redirect map from the URL audit applied and tested; sitemap submitted
- [ ] No seed or sample data or users in production

## Quality gates
- [ ] CI green on `main` (lint, types, unit tests, build, Playwright with axe)
- [ ] Manual accessibility audit complete: keyboard, NVDA, VoiceOver, 400% zoom, forced colours; no open critical or serious issues
- [ ] Core Web Vitals checked on mobile (LCP < 2.5 s, CLS < 0.1)
- [ ] Security review complete: headers, CSP decision recorded, RBAC tests, dependency audit, attachment tests (docs/TEST_PLAN.md section 7)
- [ ] Scanner provider decision recorded (none, or provider configured and tested with the EICAR string)
- [ ] Test RFQ submitted end to end in production: record, both emails, attachment download

## Operations
- [ ] Backup workflow running; restore drill completed and timed (docs/BACKUP_RESTORE.md)
- [ ] Uptime monitor on `/api/health` and alert recipients named
- [ ] Error/log alerting decided (client)
- [ ] Admin training delivered; docs/ADMIN_GUIDE.md reviewed with the staff (record or notes)
- [ ] Maintainer named and given docs/DEPLOYMENT.md, docs/ARCHITECTURE.md and this checklist
- [ ] Dependency update process agreed (Dependabot PRs reviewed monthly; Next.js and Payload upgraded together)
- [ ] Open items and known limitations listed below

## Known limitations at handover
- CSP still allows inline scripts (nonce-based policy trades off static caching; decision recorded in ARCHITECTURE.md 7.2).
- No admin MFA (see OPEN_QUESTIONS Q-26).
- Virus scanning is a hook; without a provider attachments are marked `skipped`.
- Search is PostgreSQL full-text with trigram fallback (see ARCHITECTURE.md 6 for the upgrade path).

Signed off by: ____________________  Date: ____________
