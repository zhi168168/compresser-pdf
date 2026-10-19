# SEO implementation and open-source research

## Research record

GitHub REST API queried live on **2026-10-19 (Asia/Shanghai)**. Star counts below are a dated snapshot, not proof of Google ranking. Read each project's actual README; selected by relevance first, then community adoption. No third-party website template or content was copied.

| Repository | Stars at query | Fit for this project | Decision |
| --- | ---: | --- | --- |
| [Front-End-Checklist](https://github.com/thedaviddias/Front-End-Checklist) | 74,508 | High: actionable semantic HTML, accessibility, SEO, performance, and privacy checklist, including a dedicated SEO category | Main launch checklist |
| [GoogleChrome/lighthouse](https://github.com/GoogleChrome/lighthouse) | 30,906 | High: Google's open-source, repeatable SEO/performance/accessibility auditing tool | Audit standard; no promise that a score guarantees rankings |
| [joshbuchea/HEAD](https://github.com/joshbuchea/HEAD) | 30,267 | High: detailed title, description, canonical, robots, Open Graph and JSON-LD examples for any HTML architecture | Head metadata standard |
| [vercel/next.js](https://github.com/vercel/next.js) | 143,086 | Medium: strong full-stack framework, but requires framework migration and offers no automatic ranking advantage over crawlable static HTML | Reviewed, not adopted for this static tool |
| [withastro/astro](https://github.com/withastro/astro) | 63,316 | Medium: lightweight static output and sitemap integration are relevant, but unnecessary framework migration for this small static site | Reviewed, keep static-output principle |

Reviewed source snapshots:

- [HEAD README](https://github.com/joshbuchea/HEAD/blob/de1304eeb62feb6bec90c28fc78fe29d2500d606/README.md): Recommended Minimum, Recommended Order, Meta, Link, Open Graph, Google JSON-LD Schema.
- [Lighthouse README](https://github.com/GoogleChrome/lighthouse/blob/d8617feba207eebd46ae17fb4d6b137b71723010/readme.md): browser audit workflow and `--only-categories=performance,seo`; use the full accessibility and best-practices categories too.
- [Front-End-Checklist README](https://github.com/thedaviddias/Front-End-Checklist/blob/e8d14d049010e2ce25afcd5e8609dfcbbe63e47e/README.md): HTML semantics, SEO rules, performance, privacy, mobile testing, crawl/index controls and accessible input guidance.

This implements applicable standards instead of blindly inheriting every suggestion. For example, no invented ratings, fake Organization contact details, meaningless geo tags, keyword stuffing, or FAQ rich-result promises. HEAD is a collection of possibilities, not a requirement to add every tag. Structured data does not guarantee a Google rich result.

## Search intent and language

- Primary market and language: **French**, targeting the natural search phrase **compresser PDF**. The user-supplied Trends regional screenshot supports French-language intent; its normalized regional interest values are not absolute search volumes or market shares.
- French tool, privacy page, and quality guide live at `/`, `/privacy.html`, and `/guides/compress-pdf-without-losing-quality.html`. Complete English counterparts live under `/en/`; English wording uses **Compress PDF**, **PDF compressor**, and **reduce PDF file size** naturally.
- Primary page answers the tool intent immediately, with a usable, no-sign-in-required local compressor.
- The guide answers the quality-preservation question and explains real limits rather than claiming every file can shrink without quality loss.
- Every translated pair publishes reciprocal `hreflang="fr"`, `hreflang="en"`, and `hreflang="x-default"` (French fallback). Each page keeps its own canonical; English pages are not canonicalized to French. Users can switch languages explicitly; no forced IP redirects.
- Validate actual search demand, country distribution and conversions in Search Console after launch. French-language priority does not imply a country-specific France-only service.
- Public content is served as HTML, not generated only after JavaScript executes. Account dialogs and compression work stay client-side.

## Build and domain configuration

Recommended script:

```json
{ "build": "vite build && node scripts/seo.mjs" }
```

Set Vercel **Production** environment variable `SITE_URL` to the final HTTPS origin, for example your actual custom domain. Do not use the example literally. No path, query string, credentials, or fragment. Vercel Preview builds are noindex even if this variable is inherited. Missing `SITE_URL` deliberately produces noindex, a `Disallow: /` robots file, no canonical/OG URL, and no sitemap. This prevents accidentally publishing a fabricated domain. It must be configured before a public SEO launch.

The postbuild script reads all six built HTML pages, checks the expected French or English language, a translated counterpart, a single H1, title and description, then writes:

- Unique absolute canonical per page, based on its deployed URL.
- Reciprocal French/English/x-default alternate links on each translated pair.
- Robots metadata and robots.txt with correct production/preview behavior.
- Open Graph and Twitter text metadata, with `fr_FR`/`en_US` locale and alternate locale.
- Homepage WebSite/WebApplication JSON-LD and WebPage data for other pages, with corresponding `inLanguage`; the shared WebSite lists both languages, and each homepage app uses its own URL and ID. No fabricated ratings or organizations.
- XML sitemap of the six actual built HTML pages, including language alternate links. No fake dates or keyword pages.

`public/social.svg` is a source illustration, deliberately not advertised as an OG image because social parsers do not consistently accept SVG. Add a real exported PNG before using `og:image`; the current text-only social metadata is intentional. No external font or image request is required by the reading pages.

## Launch acceptance

1. Build with real `SITE_URL`; inspect canonical, robots, sitemap, unique title/description, and JSON-LD in the built HTML. Build preview separately and verify noindex.
2. Deploy the static `dist` directory on Vercel. Verify HTTPS, `/robots.txt`, `/sitemap.xml`, guide and privacy page return actual 200 responses, not SPA fallback HTML. Missing URLs must return 404. Check preferred apex/www redirects.
3. Run Lighthouse on the deployed production site: `npx lighthouse https://YOUR-ACTUAL-DOMAIN --only-categories=performance,accessibility,best-practices,seo --output=html --output-path=./lighthouse.html`. This command is a launch instruction, not a claim that a deployed audit has run.
4. Test desktop/mobile rendering, keyboard-only file selection and dialogs, heading order, link labels, and color contrast. Emulation cannot substitute for actual iOS/Android memory testing.
5. In browser network tools, select, compress, preview and download a PDF; confirm file bytes/names/previews are never sent. Login traffic is separately permitted identity traffic. Avoid analytics/error logging that captures document data.
6. Add the domain to Google Search Console, verify ownership, submit sitemap, inspect important URLs, and monitor real Core Web Vitals/indexing over time. No credentials or domain were supplied, so these account actions require the operator after deployment.

SEO technical hygiene improves discovery and usability; ranking depends on demand, relevance, competition, reputation and real-world performance. No ranking outcome is guaranteed.

## Verification record

Fresh French-first local production-configured audit on 2026-10-19, Lighthouse 13.5.0 (`2026-10-19T08:55:52.565Z`): Performance 100, Accessibility 100, Best Practices 100, SEO 100. All six-page SEO tests pass. This audit uses localhost assets with a temporary `.invalid` production-domain fixture, then restores safe noindex; it is not an online ranking or real-user performance result.

Automated checks: `node --test tests/seo.test.mjs` (run after build). Covers all six static pages, unique metadata, expected French/English language, single H1, resolvable internal links/assets/fragment IDs, self-canonical URLs, reciprocal language alternates, localized Open Graph and JSON-LD, sitemap alternates, repeated-build idempotence, preview/missing-domain noindex behavior, and rejection of an insecure domain or mismatched page language. Configuration mutations run only in a temporary copy; the actual `dist` is not modified by tests.

Unconfigured-domain builds intentionally use noindex; Lighthouse flags this and lowers the SEO score. The indexable production configuration was audited locally using a `.invalid` domain fixture; safe noindex output was restored afterward. The fixture is never the deployment canonical. The actual results follow.

Historical English-only local production-configured audit completed 2026-10-19 (Lighthouse 13.5.0): Performance 100, Accessibility 100, Best Practices 100, SEO 100. It used a temporary .invalid domain fixture and localhost production assets, then restored noindex. These scores predate the bilingual changes and are not a fresh bilingual audit, deployed ranking or field-performance claim. See docs/QA.md for scope and timestamp.
