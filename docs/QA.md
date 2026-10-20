# Verification — 2026-10-19

## Operations update — 2026-10-20

Root suite **17/17** and account suite **12/12** passed, including bilingual mobile deletion confirmation, protected email-token deletion against actual PostgreSQL, all-session invalidation, optional health authorization, private error logs, transient auth startup recovery, encrypted backup integrity and transactional restore refusal. Production build and six-page static SEO/link checks passed. No production user was deleted and no real deletion email was sent by these tests.

A real read-only Neon account snapshot was encrypted locally, then decrypted only in memory and restored into an isolated temporary PGlite PostgreSQL instance using matching migrations. All user/account fields matched (timestamp representations normalized to equivalent instants); session/verification data was excluded. The source account data was not modified. A dedicated SELECT-only backup role was then provisioned without changing website credentials. The cloud backup using that role succeeded in [run 39358643071](https://github.com/zhi168168/compresser-pdf/actions/runs/39358643071), its encrypted artifact was downloaded and independently restored in the same isolated manner. This proves cloud artifact recovery into local PostgreSQL, not a live Neon failover. The downloaded drill copies were removed; local backup files and separate key configuration remain in Git-ignored paths.

GitHub daily backup and 15-minute availability schedule variables are enabled. The availability workflow passed in [run 39358807079](https://github.com/zhi168168/compresser-pdf/actions/runs/39358807079), and the deployed health endpoint returned 200 with status ok. Production capability discovery reports accountDeletion true; privacy pages show the approved contact. GitHub Actions email notification preferences and actual failure-email receipt still require operator verification. GitHub scheduling is best-effort and no continuous uptime or alert-delivery guarantee is claimed.

French and English privacy notices now identify Vercel/Neon/Brevo, explain deletion and conditional backup retention, and provide the user-authorized contact zhihaosong168@gmail.com. Mobile deletion/privacy layouts were checked for overflow. The new health endpoint must be checked on the deployed domain after release.

## Vercel + Neon deployment preparation

The default account endpoint now runs directly in a Vercel Node Function, with a lazy shared PostgreSQL pool and no upstream account server requirement. Root tests **9/9** and account tests **9/9** passed. The new adapter checks include a real Better Auth register → verify → login → session → password reset → logout lifecycle, French/English captured mail, secure cookies, origin/body restrictions and warm-runtime reuse. The existing PostgreSQL-over-TCP migration/lifecycle test also passed. Production static build and six-page SEO validation passed. Live Neon, Vercel, Google OAuth and SMTP still require deployment configuration; these tests do not claim those external services were deployed.

## French-first bilingual update

The default website is now French, with complete English equivalents under `/en/`: six static pages in total. Root tests **9/9 passed**, account tests **7/7 passed** (16 total). Original compression, proxy and account lifecycle checks remain; new coverage includes French results/errors/units, explicit language switching without browser-language redirects, request-scoped French/English mail, per-page language metadata, reciprocal alternates and six-page sitemap. The French workflow passed again against built production assets, including the bundled worker.

Fresh French-homepage Lighthouse audit at localhost:4178, timestamp `2026-10-19T08:55:52.565Z`: **Performance 100, Accessibility 100, Best Practices 100, SEO 100**. The temporary `https://seo-audit.invalid` fixture enables production metadata for this local audit only; safe noindex output is restored afterward. No live Google ranking or field performance is claimed.

IAB verified French → English → French navigation and the French account dialog. Chrome screenshots `docs/screenshots/french-desktop.png` and `french-mobile.png` cover the final French layout. Six pages were checked at widths 360/390/768/1024/1440: no horizontal overflow, language links remain visible, and mode labels fit. Reading-page language styles use external CSS compatible with the deployed CSP. A joined mobile FAQ heading was repaired. The existing palette, hierarchy and component design are preserved; no new image concept was required for localization. The primary agent inspected final screenshots with `view_image`.

Production credentials/deployment limitations listed below still apply. French is a language target for francophone regions, not a France-only geolocation restriction. Regional Trends scores supplied by the user are relative interest, not absolute volume.

## Original English-version baseline

- Production build passed with Vite 7.3.7. Root `pnpm install --frozen-lockfile` passed.
- Root suite: **8/8 tests passed**. Covers real browser PDF selection/compression/download, all three modes, native text extraction, lossless image-byte preservation, image dimensions, output size, no compression upload requests, invalid/signed PDF rejection, pre-start and running cancellation, mobile overflow, account dialog, proxy safeguards/cookies, static SEO and isolated domain/preview configuration.
- Account suite: **5/5 tests passed**, including actual Better Auth, PostgreSQL PGlite over TCP with the production `pg` driver, migration and HTTP register → email verification → login → session → reset → invalidated session → logout. SMTP was captured in tests; it was not sent to a real mailbox.
- A generated photo-and-text PDF shrank from **3,030,157 to 808,998 bytes (73.3%)** in High quality. Native searchable text, one-page count and 1,200×900 embedded image dimensions were preserved. This fixture demonstrates one case, not a universal ratio or a visual-losslessness guarantee.
- Google Lighthouse 13.5.0, production assets at localhost:4178, mobile audit: **Performance 100, Accessibility 100, Best Practices 100, SEO 100**. Final audit timestamp: `2026-10-19T08:37:22.976Z`. The local audit temporarily used `https://seo-audit.invalid` solely as a domain fixture. Build output was then restored to safe noindex because no actual domain has been supplied. These scores do not claim deployed field performance or Google ranking.

## Browser and visual checks

IAB was used first to inspect the real page and the optional account dialog at desktop and 390-pixel mobile sizes. The account panel accurately disables unconfigured features and does not block compression. IAB viewport-override screenshots appeared downsampled, so installed Chrome with Playwright supplied sharp saved screenshots and repeatable network/PDF assertions. The production bundle's worker workflow was also tested separately from Vite source development.

Saved final screenshots: `docs/screenshots/desktop.png`, `mobile.png`, `desktop-result.png`. The primary agent inspected desktop/mobile screenshots using `view_image`. Checked: exact hero/CTA/navigation copy, white/forest/mint palette, typography hierarchy, two-column desktop composition, mobile single-column flow, panel spacing, control legibility, FAQ links and selected states. Fixed small control text, contrast of numbered labels, drop-area accessible name, mobile title spacing, and compression-button visibility after changing settings. No remaining known material visual mismatch with the documented design.

No Image Gen tool was available, so no image-generated accepted concept exists and no concept-image comparison is claimed. The source design specification and fidelity ledger are in `docs/DESIGN.md`. Code-native typography, SVG functional icons and layout are intentional. No image-model API or paid external provider was called.

## Deployment limits still requiring real configuration

The code is complete locally; it has not been published. Native production PostgreSQL/Compose was not launched because this machine has no Docker CLI. Real Google OAuth consent/callback, SMTP delivery, production HTTPS cookie/proxy behavior, domain DNS, Vercel deployment, Search Console ownership and real-device memory behavior need the operator's credentials/environment. PGlite tests and browser emulation do not substitute for those checks.

PDF compatibility is deliberately conservative: eligible images only, no full-page rasterization, no promised visual identity. The engine parses output and checks page count; it does not automatically render and compare every PDF page. No PDF content, preview, or filename is sent to account APIs.
