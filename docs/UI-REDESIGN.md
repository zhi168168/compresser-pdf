# PDF workspace redesign — 2026-10-20

## Direction

Implement the user-approved white workspace, neutral light-gray canvas and forest-green primary action. Reference Tailark's restrained typography, shadcn/ui's control consistency and file-uploader interaction anatomy; no third-party source code or assets are copied. Preserve French-first routing, English alternatives, local-only PDF processing, supported compression modes and account behavior.

Image generation is unavailable in this session. There is no generated or accepted concept image; browser renders will be reviewed against this written specification, not claimed as image-to-code fidelity.

## Layout and components

- Compact 76px desktop navigation: existing brand, compression/how/privacy/FAQ links, language and account.
- Centered 48px task heading, one concise supporting paragraph. No eyebrow, marketing illustration, invented metrics or customer logos.
- A single white workspace, max-width 880px, 16px radius, neutral border and subtle shadow. Three numbered workflow stages: file, compression, download. Local processing status in the toolbar.
- Empty: a spacious dashed drop area, existing PDF icon, choose-file action and 100MB limit. Settings and disabled compression action are hidden until a valid file is selected.
- Selected: readable file row, three radio modes, mode explanation and primary compression action. Processing: file row, real progress and cancel. Result: file row, actual byte comparison, actual saving and download/restart actions. Errors retain a recoverable workflow.
- Below workspace: three-column factual compression comparison; concise three-step instructions; privacy band; quality guidance; FAQ; footer. Existing long-form explanations remain accurate.
- Mobile: 20px gutters, 34px title, 16px workspace padding, stacked mode options and sections, visible language control, no horizontal scrolling. Buttons >=44px, primary action 50px.

## Tokens

Canvas #f6f7f8; surface #ffffff; ink #18251f; secondary #59655e; border #e1e6e3; accent #174f3b; selected #f1f7f3. System sans-serif; headings 48/32/22px, body 16px, controls 15px, supporting labels 13px. Radius 8px controls / 16px workspace. Spacing 4/8/12/16/24/32/48/72px. SVG outline icons use consistent 1.6–2px strokes.

## Allowed copy changes

Shorten the hero to “Compresser un PDF” / “Compress PDF”; keep truthful local-processing and no-account messaging. Replace promotional section headings with descriptive compression, instructions, privacy, quality and FAQ headings. Add localized stage labels, compression-mode comparison and a link to that comparison. Preserve actual technical limits, errors and result calculations.

## Verification

Check French and English desktop/mobile renders, empty/selected/progress/success/original-kept/error/reset states, keyboard navigation, account dialog, real compression/download and unchanged no-upload behavior. Run existing frontend tests and production build. Record observed evidence and limitations after verification.

### Completed verification

- Built-in browser inspected the actual French desktop home, 390px mobile selected-file/settings/result flow, 320px home/account dialog, and 768px home. Temporary viewport override reset afterward. Screenshots from automated regression cover 1440×1000 and 390×844 in both languages.
- Production build succeeds. All 17 existing frontend tests pass, including real browser compression/download, re-compression through the new adjust action, French/English workflow, account registration/deletion UX, worker rejection/abort, health, account proxy and SEO.
- Photo fixture: 3,030,157 → 808,996 bytes in recommended mode (73.3% smaller). Native text, page count and image dimensions verified; lossless mode preserves encoded image bytes; stronger mode produces a smaller result for this fixture. No document POST/PUT/PATCH requests.
- `view_image` inspected saved desktop home/result and mobile full-page screenshots. Current saved evidence: `docs/screenshots/desktop.png`, `desktop-result.png`, `french-desktop.png`, `french-mobile.png`, `mobile.png`.

### Visual review ledger

| Check | Observed result / correction |
| --- | --- |
| Layout | One centered 880px workspace; main file action visible on normal desktop and mobile first screens. |
| Typography | 48px desktop / 34px mobile title; 15px primary controls; readable mode rows and explanatory copy. |
| Palette | True white workspace, #f6f7f8 surrounding canvas, #174f3b action; no decorative imagery or gradients. |
| Controls and states | Settings appear only after selection; real progress/cancel, result/download, adjust and restart paths remain functional. |
| Mobile | Corrected uneven workflow-label wrapping with vertically aligned step markers; corrected 320px header wrapping by simplifying the account button. No horizontal document overflow at inspected widths. |
| Navigation and account | Language links remain visible; compact responsive header; account dialog padding and close target adjusted for mobile. |
| Copy | Above-the-fold additions match the localized copy list in this specification; promotional title removed, privacy/limits retained. No fabricated figures, endorsements or tools added. |
| Lower page | Full mobile render reviewed for mode comparison, instructions, privacy, quality guidance, FAQ and footer. |

No accepted raster concept exists because Image Gen is unavailable, so image-to-concept/native-concept fidelity is not claimed. Implementation was visually verified against the user-approved direction and written specification. Browser emulation is not physical-device testing. This change has not been deployed to production.

## Download sign-in update

Guests can select a PDF, compress and compare actual sizes and reduction bars. The download action requires a freshly verified account session. The sign-in dialog explains that the current file and result remain available. Same-page email login unlocks the action without replacing the workspace. Google redirects and email callback links carry an opaque resume ID; original/result blobs, file name and selected mode stay in local IndexedDB and are restored without recompression. Saved resume records are valid for one hour, cleared on reset/replacement/adjustment and pruned on later use. Browser-storage failure prevents redirect navigation while preserving same-page email login and the current result. PDF processing stays entirely local.

All 20 frontend tests pass, including email login in both languages, login dismissal/reload, exact byte restoration after simulated Google redirect, original-file re-compression, tab isolation, stale-session download rejection and blocked-storage recovery. Real Google credentials/identity-provider login were not exercised. The local dev account service is unconfigured; the production account service must be configured for real downloads. Desktop/mobile comparison and sign-in chrome were checked in IAB; saved screenshots are `download-gate-desktop.png` and `download-gate-mobile.png`.
