# Store pause and CBT launch audit — 2026-10-11

## Implemented scope

- `lib/store-availability.ts` exports `STORE_ENABLED = false`. The existing store implementation is preserved behind this presentation switch.
- Store tabs and footer links remain `/store/`; the destination says “스토어는 준비중이에요!” and links to `/cbt/`.
- `/store/`, `/products/`, `/products/[slug]/`, `/cart/` and `/checkout/` return the preparation component before product/price reads or checkout SDK rendering.
- Product/cart navigation and the root home store promotion are hidden. Existing `/library/`, download APIs, `/checkout/complete/`, payment callbacks and purchase history are preserved.
- This is a storefront UI pause, not an API authorization or payment kill switch. Authentication, payment, downloads, grading, persistence and SQL/Edge functions have no changes.
- Scoped CSS uses existing tokens; the only new responsive breakpoint is `max-width: 767px`.

## Verification

- `npm run check`, `npx tsc --noEmit`, `npx next build`: passed. Existing legal warnings remain: four approved policy documents are not supplied; phone/support hours are unconfirmed.
- New `scripts/test-store-availability.mjs` verifies both flag states, no closed-state product/price reads, metadata lookup suppression, restored checkout SDK in the open state and preserved library/completion paths. It is included in the existing check chain.
- Local production Chromium/WebKit: 35 route/width captures and five store-tab round trips per engine; widths 360/390/430/768/1280. Zero page overflow, execution errors or external mutations. Existing logo/CBT text issues are reported separately, not silently fixed.
- CBT fixture audit: 50 screen captures and 12 flow/edge checks per engine. Public read-only audit: 12 real pages per engine (home, catalog, searched qualification at 360/390/430/1280). All non-read requests were blocked.
- Detailed captures, reproduction scripts, measurements and release evidence are in outer workspace `reports/cbt-launch-audit-20261011/RESULT.md`.

## CBT findings — report only

1. High: guest final submission ignores a failed local save and leaves `finishedIds` set. After storage recovers, a second submission still does nothing. Reproduced in both browsers; `components/question-bank-client.tsx:247-281`.
2. High: result retry ignores a failed local save, then routes to a new attempt that does not exist. “응시 기록을 찾을 수 없습니다.” is displayed. Reproduced in both browsers; the same component's `retry` function.
3. Medium, conditional: historic `attempt.score` and current-answer subject rates use different versions of correctness. A synthetic historical score of zero with current 9/12 correct answers produces 0 points and 50%/100% subject bars. This is a demonstrated code path, not an observed production user's result; lines 358-368.
4. Medium: several CBT auxiliary labels/descriptions are 13px, below the requested 14px. Header logo targets can be 40×44px; breadcrumb/login text links are approximately 20px tall, below the project 44px target. No page overflow/header overlap was found. Decorative Google logo contrast is excluded from body-text findings.
5. Launch follow-up: supplied policy Markdown is absent and the footer has no policy links. Real account sync, iOS hardware/address-bar behavior and NAS load under a marketing burst were not tested.

No CBT corrections, account personalization, new onboarding motion or public counter was implemented. Resolve findings 1 and 2 before a marketing launch.

## Rollback

- Revert this isolated `feat(store): pause storefront with reversible availability flag` commit and redeploy. Earlier store/account/CBT interaction commits remain intact.
- Alternatively change only `STORE_ENABLED` to `true`, rerun checks/build and deploy; original catalog, prices, cart and checkout render paths return. This is a build-time code flag, not an instant runtime toggle.
- No DB rollback, data deletion or cart/local-storage clearing is needed. Payment APIs and previously completed purchases are unchanged.

## Proposals

The detailed report contains account personalization, root onboarding motion and cumulative guest-inclusive statistics proposals. Existing statistics count browser identities and deduplicated attempt/question/revision responses, not exact people or unique questions. Public counts require a separately reviewed aggregate endpoint; no production DB change was made.
