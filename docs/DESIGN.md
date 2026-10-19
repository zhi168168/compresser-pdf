# Design specification

French-first update: French is the default; English lives at `/en/`. All static sections, compression status/errors/results and account UI are localized. A language selector stays visible on narrow screens. The primary French heading is “Compresser un PDF — Gardez l’essentiel.” French long copy uses the existing system without shrinking controls. Final desktop/mobile renders were inspected; header spacing, title wraps, French accents, selection controls and language links remain readable. Account interfaces use request-language email templates and French fallback. The mobile FAQ title has explicit whitespace around its hidden line break. Final screenshots: `docs/screenshots/french-desktop.png` and `french-mobile.png`.

The Image Gen capability was unavailable in this session. The implementation therefore uses a documented code-native design instead of presenting an ungenerated concept as accepted artwork.

## Direction and tokens

Editorial utility: pure white canvas, forest green `#174f3b`, dark ink `#192c24`, muted green-gray `#64746b`, mint `#eff8f1`, restrained borders `#dce5de`. System sans-serif typography avoids third-party font requests. Desktop headings 72px, mobile 43px. Max content width 1180px, generous open sections, 12px tool radius. Iconography is consistent inline outline SVG, with one solid folded-page brand mark. No raster illustration or external media is needed for this document utility.

## Information architecture

Header → editorial headline + functional PDF tool → numbered three-step workflow → mint privacy band → open quality explanation → accessible FAQ disclosures → footer. The tool is usable without an account. Header login uses the auth module and is independent of compression.

## Tool states

Empty/drop target, chosen file, processing/progress/cancel, success/download/repeat, original-kept result, error. All selected file names are assigned via textContent. Object URLs are revoked on replacement and pagehide. Busy state disables file and profile changes. Input has a 100 MB cap and PDF-header validation.

## Content and responsive constraints

H1: “Compress PDF. Keep the good stuff.” Default mode retains image dimensions but may change image detail. Lossless optimizes structure. Smaller file can resize supported images. No absolute visual-losslessness or guaranteed reduction claims. Native text and vector graphics remain native. Privacy copy distinguishes local PDFs from server-based account details.

Desktop hero uses open copy on the left and the tool on the right. At 700px and below, it stacks and the header keeps branding and login. Tool modes use three columns on wide screens and become three horizontal rows at 450px and below. Reduced-motion preference removes animation. Native details, clear focus indicators, associated radio labels, progress status, error alerts, and skip link provide accessibility.

## QA ledger

Review the actual browser screenshots for five concrete points: heading rhythm and wrap; white/forest/mint color lock; tool/upload and radio state geometry; open section spacing and hierarchy; mobile flow and no horizontal overflow. Concept-image comparison is blocked by unavailable Image Gen, and must not be claimed as performed.

Actual Playwright screenshots `docs/screenshots/desktop.png` (1440px viewport) and `docs/screenshots/mobile.png` were inspected with view_image. The implementation has the specified white canvas and forest/mint palette, deliberate three-line hero wrapping, clear tool geometry and selection state, varied open/mint section rhythm, and a single-column mobile flow without clipped content. A mobile issue was found where hidden line-break elements joined adjacent heading sentences; whitespace was added between those sentences. Lighthouse additionally identified low contrast in the three quality-note numbers and an upload region whose accessible label omitted its visible text. The numbers now use `#5d7565`; the drop target obtains its accessible name directly from its visible descendants. No generated/accepted concept image exists, so concept fidelity verification remains unavailable.

Readability follow-up raises mode titles to 12px, subtitles to 11px, tool help to 12px, local/file/footer copy to 11px, the fieldset legend to 13px, and progress/result support copy to at least 12px. At widths up to 450px, profiles become three full-width horizontal rows with title left and description right, preserving legibility instead of shrinking their type. The tool heading can wrap its local-processing indicator when needed.
