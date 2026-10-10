# Store / CBT interactions — 2026-10-10

User approved implementation, inspection and deployment of the next proposals after the six account interactions. One release bundle; no dependency, schema, auth, payment, download, grading or persistence protocol change.

## Scope

| Store | Behavior |
| --- | --- |
| Cards | 160ms / 2px fine-pointer hover, touch background, focus outline, expanded actual product link; retry buttons remain above the link |
| Package choice | Reserved check slot and 150ms border emphasis; same CORE/PASS SKU, initial/live price, disabled refresh and checkout path |
| Below-fold sections | First entry only, 12px / 240ms; first viewport and focused content stay immediate |
| Gallery | Fixed cover-sized frame and 150ms crossfade after the next real image loads; keyboard/reduced motion immediate; failed image returns to cover |
| Description guide | Existing `product-overview` / `product-package` anchors, sticky below actual header, active position; no duplicate purchase bar |
| Cover | At most ±2° in >=768px fine-mouse environment; resets on leave, breakpoint/pointer change, reduced motion and unmount |

No public product currently passes sample pages to `ProductGallery`. Do not fabricate sample images or empty preview links. The gallery capability is verified with clearly synthetic local probe assets. The probe route is removed before the release build.

| CBT | Behavior |
| --- | --- |
| Qualification cards/search | Border/background, arrow 3px / 150ms, literal escaped search highlighting. Aliases/initials still match but do not fabricate text matches |
| Answer selection | 120ms border/background and selected icon; selection stays immediate, pre-submit grading is withheld by existing mode logic |
| Result bars | Actual per-subject rates, 250ms scale reveal once, 0% stays empty, reduced motion static |
| Current question | Existing aria-current plus 120ms side marker; no automatic question change |
| Save feedback | Only existing boolean local-write success earns a check; failure leaves editable controls/retry and shows no success. Labels explicitly mean this browser, not server sync completion |
| NAS loading | Real account/catalog/bundle/download/JSON parse/correction stages. Percentage only for valid measured decoded bytes and matching known total; compressed Content-Length alone is excluded |

## Preserved contracts

- `saveStore`, `writeLocalStore`, `syncAccountStore`, record/submit payloads and SQL are unchanged. Callback types forward the already existing boolean local result to presentation. No server-sync success is invented.
- Download progress callbacks are optional observers. Abort/coalescing, cache keys, TTL/LRU, transient retry, source IDs, fresh corrections, JSON bytes and schema checks remain intact. Coalesced observers unsubscribe independently and never cancel another subscriber.
- `validate-store-price-binding` adds only the reveal wrapper to its explicit presentation dependency map. Deliberately non-default prices, both SKUs, missing price invalidation and refresh disabling assertions remain intact.
- Grouping/CBT UI tests compile the two actual new presentation components; grouping, source ownership, radio/selection and saved-history assertions remain intact.
- The loading test replaces the former blanket progressbar prohibition with known/unknown/invalid size and real stream/coalescing/cancellation tests. Rotating-message/privacy/timer/corrections tests remain intact.

## Evidence and release

Outer workspace evidence: `reports/store-cbt-interactions-20261010/`. Baseline: parent commit `8d578f7`, local production build, six screens per width. Final matrix adds the learning root: Edge Chromium and Playwright WebKit, widths 360/390/430/768/1280; root, store, product list/detail, qualification list, exam and result. Guest synthetic personal/problem/price responses, intercepted statistics API, no real DB/paid AI/payment writes.

`npm run check`, `npx tsc --noEmit` and `npx next build` passed. Each production-build browser engine passed 35 captures + 35 feature checks and eight edges: storage failure, price failure/retry/skeleton, reveal once, reduced motion, instant grade, zero-score bars, NAS unknown-size stages and NAS failure/retry. Overflow 0, inspected touch targets >=44px, added text contrast >=6.70:1. Four synthetic gallery/progress probe widths per engine also passed; no probe route remains in the release build manifest.

The WebKit harness initially navigated into product detail then immediately hard-loaded the same detail route again, interrupting an initializing price fetch. It now captures the already reached route without duplicate navigation; errors are still asserted empty. No price fetch implementation was changed. The contract loading suite covers hidden CORS encoding and gzip URLs to avoid displaying compressed Content-Length as decoded progress.

Final deployment ID/READY/commit/aliases and production-browser checks are recorded in the outer `RESULT.md` after deployment. Crossfade frame stability is asserted in the local probe; this does not claim a zero-CLS initial render on every live route. WebKit does not expose a Layout Shift measurement here.

Rollback is a single `git revert` of this release commit then validated main push. No DB restoration or NAS replacement; the preceding account release remains intact.

Actual iOS Safari/VoiceOver and authenticated cloud sync are separate manual checks. Existing missing approved legal Markdown, phone and support-hours warnings are preserved.
