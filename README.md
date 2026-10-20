# compresser pdf

A French-first PDF compressor with a complete English alternative at `/en/` and a browser-only document pipeline. No PDF upload API, external fonts, or AI document service. Google Analytics 4 (G-LH7981PXLL) measures website usage on all French and English pages; no custom PDF or account data is sent to analytics. Guests can compress and compare results; downloading requires a verified account session. Account requests remain separate from document processing.

Before a sign-in redirect, the browser temporarily saves the original PDF, output PDF, selected mode and comparison metadata in IndexedDB. A random resume ID restores the same workspace after Google sign-in or email verification/recovery callbacks, including same-browser links opened in a new tab. Saved workspaces expire after one hour and are removed when replaced/reset or during later cleanup. PDF bytes and names are never included in account requests. If browser storage is blocked, redirect sign-in is stopped to preserve the in-memory result; same-page email login remains available. A signed-in session is rechecked before every download. This is a client-side product gate, not server-side control over locally processed bytes.

French is the default for the tool, guides, privacy policy, account interface, and account emails. English pages have independent URLs under `/en/`. Users switch languages explicitly; browser settings and IP addresses never force a redirect. Each translated page keeps its own canonical with reciprocal `fr`, `en`, and `x-default` language links on a production-domain build. Numeric formatting uses French decimal commas and o/Ko/Mo units on French pages.

## Google Analytics button events

Both languages send the same GA4 event names to `G-LH7981PXLL`:

| Button | Event name |
| --- | --- |
| Choose PDF | `choose_pdf_click` |
| Compress PDF | `compress_pdf_click` |
| Download PDF / Sign in to download | `download_pdf_click` |

The only custom parameter is `language` (`fr` or `en`). Choosing a PDF counts opening the picker by mouse or keyboard, even if the visitor cancels; dragging a file does not count as a button click. Download counts the button activation before checking sign-in, not a successful download. No filename, PDF content or account identifier is sent. Analytics failure does not block the tool.

In GA4, use Reports > Engagement > Events (or Explore with Event name as rows) and compare **Event count** with **Total users**. Event count measures repeated clicks; Total users measures distinct GA-observed users per event, not identifiable people. Events start after deployment and may take 24–48 hours to populate standard reports; Realtime can help verify collection sooner. These events do not need to be marked as key events to count clicks.

## Run locally

Node.js 22+ and pnpm are required.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:5178. Compression works immediately. The account panel clearly reports that accounts are unconfigured until you connect the account service. To develop accounts, start `server/` as described in [docs/AUTH.md](docs/AUTH.md), set `ACCOUNT_DEV_PROXY=http://127.0.0.1:3001` in your shell, and restart the Vite dev server. The account server's `PUBLIC_SITE_URL` must be `http://localhost:5178`.

```sh
pnpm build
pnpm preview
pnpm test
pnpm --dir server install --frozen-lockfile --ignore-workspace
pnpm --dir server test
```

Frontend browser tests use installed Windows Chrome by default. Set `CHROME_PATH` for another Chromium executable and `TEST_URL` if the dev server is not on port 5178. Run `pnpm dev` before the browser tests. Worker rejection tests use source module imports, so they target the dev server. Account tests use a temporary PGlite PostgreSQL engine, not any production database.

## Deploy on Vercel

Import [zhi168168/compresser-pdf](https://github.com/zhi168168/compresser-pdf) into Vercel. The recommended architecture is Vercel static assets + a same-origin Better Auth Vercel Function + Neon PostgreSQL. No separate virtual machine is needed. PDF selection, reading, compression and download run in the browser; only account requests use the backend.

Set these **server-only Vercel environment variables**:

| Variable | Purpose |
| --- | --- |
| `SITE_URL` | Final HTTPS frontend origin; enables production canonical URLs, indexing and sitemap. No trailing path. |
| `PUBLIC_SITE_URL` | Same exact HTTPS origin as `SITE_URL`, used by authentication and email links. |
| `DATABASE_URL` | Neon pooled PostgreSQL connection string, with TLS enabled. |
| `BETTER_AUTH_SECRET` | Cryptographically random secret of at least 32 characters; preserve across deployments. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Real mail provider; required for verified email registration and password recovery. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google OAuth Web client credentials; configure both together. |

Never expose secrets with a `VITE_` prefix. Do not point preview deployments at production accounts. Missing `SITE_URL` intentionally produces **noindex**, including the local build; Vercel Preview stays noindex even if it inherits a domain. Change production environment variables and rebuild when the real domain is ready.

Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the complete Chinese deployment guide and [docs/AUTH.md](docs/AUTH.md) for authentication details. Neon has a quota-limited Free plan, not a guarantee of permanently free or unlimited capacity. Vercel Hobby is for personal non-commercial use: use a plan permitting commercial usage before charging or running this as a commercial service. Verify current provider pricing before launch. Google/SMTP/database credentials exist only in server-side environment variables. The browser never connects directly to PostgreSQL.

The independent Node service and [server/compose.yml](server/compose.yml) remain an optional self-hosted alternative. They are not required for the recommended Vercel + Neon setup.

## Operations

Footer badges can be managed at `/admin/badges.html` with a dedicated administrator password, without a frontend deployment. Paste a badge snippet, preview it, then save to publish across all French and English pages. Ordering, visibility, editing, deletion, image uploads, JSON export/import and password changes are supported. Run `node --env-file=.env.local scripts/init-badges.mjs` explicitly once to initialize the separate badge tables and import the existing five badges; it never overwrites existing settings. See [BADGES.md](docs/BADGES.md) for access, caching, backups and recovery behavior.

Users can delete their account after typed confirmation and a one-hour emailed verification link while signed in. The active profile, linked sign-ins and all sessions are removed; PDFs stay local. Privacy/contact information is available in both languages. The app emits only fixed error events, random IDs and timestamps.

`GET /api/health` checks actual database connectivity without returning account data. [MONITORING.md](docs/MONITORING.md) explains external alert setup; it is not automatically provisioned. [OPERATIONS.md](docs/OPERATIONS.md) explains AES-256-GCM account backups, seven-day artifacts, explicit schedule activation and restoration into an empty isolated database. Configure Actions secrets and run a successful backup before enabling the schedule. No PDF, session or verification token is included in these backups. New billing tables will require an expanded backup strategy.

## Compression behavior

- **Lossless:** PDF structural rewrite with object streams. No deliberate image pixel changes. This is not byte-identical output or a guarantee that metadata is removed.
- **High quality:** recompresses eligible simple 8-bit RGB JPEG images at quality 0.88, keeping their dimensions. Native text and vector graphics are preserved. Image detail may change; this is not mathematically lossless.
- **Smaller file:** quality 0.72, with a 2,000-pixel longest-edge limit; also handles eligible plain/Flate RGB rasters. Rasterized charts/text may lose detail.

Masks, custom/CMYK/ICC color spaces, decode arrays and predictors are deliberately left untouched. Files containing detected signatures, encryption or XFA forms are rejected. Images above 24 megapixels are left intact to limit memory use. Maximum input is 100 MB; actual device memory may impose a lower limit. Work runs in a cancellable worker with a three-minute timeout. A larger result is never offered as an improvement: the original is kept. Page-count parsing validates basic output structure, not visual equivalence. Review the download before sharing important documents.

This first release does not provide pixel-difference preview, batch compression, offline installation, or guaranteed support for every PDF extension. It never flattens complete pages into images. The result panel reports actual byte counts, with no promised compression percentage.

## SEO and verification

[docs/SEO.md](docs/SEO.md) records live GitHub relevance/star research and the adopted HEAD, Front-End Checklist and Lighthouse standards. Static French-first HTML, complete English alternatives, guide/privacy pages, canonical URLs, JSON-LD and production sitemap are implemented; no ranking is promised.

[docs/QA.md](docs/QA.md) records the actual test scope, local audit scores and production checks that still require your credentials. [docs/DESIGN.md](docs/DESIGN.md) records the visual design and browser verification.
