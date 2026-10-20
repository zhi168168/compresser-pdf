# Brand assets

The original transparent artwork is `logo.png` at the project root. Keep it as the source; do not replace it with a resized export. Run `pnpm assets:brand` after changing the source. The generator removes transparent margins and near-invisible export noise, and extracts the standalone symbol from the empty column before the wordmark. Review this crop if the artwork layout changes.

| Use | Public asset | Dimensions / format |
| --- | --- | --- |
| Headers and footers, all 12 French/English pages | `/brand/logo.png`, `/brand/logo-640.webp`, `/brand/logo-1280.webp` | 1280×282 PNG fallback; 640×141 and 1280×282 transparent WebP |
| Google Search favicon and browser tabs | `/favicon-48.png`, `/favicon-96.png`, `/favicon-144.png` | Square PNG, multiples of 48 |
| Browser/Windows compatibility | `/favicon.ico` | 16×16, 32×32, 48×48 frames |
| iOS home screen / bookmarks | `/apple-touch-icon.png` | 180×180 PNG, white background |
| Web app manifest | `/icon-192.png`, `/icon-512.png`, `/site.webmanifest` | 192×192 and 512×512 PNG, white background; standard browser display, no offline claim |
| Structured brand logo | `/brand/logo-square.png` | 512×512 PNG, white background for legibility |
| Reusable transparent symbol | `/brand/mark-512.png` | 512×512 PNG |
| French/English link previews | `/social-fr.png`, `/social-en.png` | 1200×630 PNG with the supplied wordmark |

`scripts/seo.mjs` adds the brand publisher and `Organization.logo` to the two homepages. The maintainer remains the original `Person` author, and the brand does not claim a registered legal entity or additional legal/contact details. Other pages reference the same publisher ID. Production URLs derive from `SITE_URL`, never a preview hostname.

Production requires `SITE_URL=https://compresser-pdf.com` and a production environment. Existing canonical URLs, translations, robots and sitemap generation remain in place. Preview and unconfigured builds intentionally remain non-indexable. All brand images are public static assets without authentication. Keep favicon URLs stable.

Validation: `pnpm build`, `node --test tests/seo.test.mjs`. A local production-mode build and checks are not a production deployment. After publishing, verify the public favicon/logo URLs and request homepage recrawling in Google Search Console. Google controls the timing and appearance of favicon/logo updates; these assets do not guarantee indexing, rankings or a special search result.
