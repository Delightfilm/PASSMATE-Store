# SEO metadata and asset release gate — 2026-10-17

User approved A+B in outer `reports/seo-429-20261017/improvement-approval-report.md`, including a verified SEO-only PR merge and one production release. Based on main `12e5bffc`; preserve its admin/member dashboard, all authentication/data/analytics contracts and the paused store. WAF configuration and its separate draft PR #56 are not part of this app release.

## Change

- Next 15.5.24 HTML-limited bot pattern is retained in full, adding only `SEBot-WA`. A snapshot regression compares with the installed upstream pattern so Next upgrades cannot silently drop default bots. No private internal Next imports in product configuration. Ordinary Chrome/Safari remain outside this policy.
- Explicit `check:seo-delivery` fetches real raw HTML: 13 public priority URLs × SEBot-WA, Yeti, Google inspection and Bingbot; exactly one head title/description/canonical matching an independent per-page copy contract, correct canonical host/path, no public noindex. Seven private/store routes, including an inert exam URL, must retain noindex.
- Explicit `check:public-assets` checks HTML plus streamed Flight asset references. `SEO_NETWORK_LOG` mode independently validates actual browser JS/CSS response records, including dynamically loaded chunks, across all 13 pages. 4xx/5xx, wrong MIME/HTML checkpoints, missing coverage and disk/service-worker-only evidence fail. Static reference checks are not claimed as full browser proof.
- Neither command silently skips when its required target/evidence is absent. Network-dependent gates are separate from offline `npm run check`.

## Commands

After production build, start a local production server. In PowerShell set `$env:SEO_BASE_URL='http://localhost:3146'`, then run `npm run check:seo-delivery` and `npm run check:public-assets`. This local UA simulation does not prove actual production verified-bot access.

For actual production browser proof capture per-page `{url, documentStatus, resources:[{url,type,status,mimeType,body,fromDiskCache:false,fromServiceWorker:false}]}` with cache disabled in a dedicated inspection tab; include failed same-origin script/style loads with status 0. `body` is a captured response prefix sufficient to detect an HTML checkpoint, not a default empty string. Both cache flags must be explicitly false. JSON shape is `{origin,pages}`. Set `$env:SEO_NETWORK_LOG` to the saved JSON file and run `npm run check:public-assets`. Do not export cookies, auth headers, personal request bodies or unrelated origins. Restore temporary browser capture settings afterward.

Run after the production deployment completes; avoid a deployment while the final external audit is crawling. Compare new audit with old title warnings and transient chunk 404 observations. Do not treat tool scores or fetched/discovered URL counts as rankings or index counts.

## Evidence / status

- First bot-policy regression failed with missing SE blocking policy; then passed.
- Validator suite covers body-only/duplicate/wrong canonical metadata, private noindex, Flight imports, missing network page coverage, cached-only evidence, HTTP 404 and a 200 HTML checkpoint masquerading as JS.
- Production build and post-build TypeScript check passed. Local production HTTP checks passed: 59 raw responses and 23 unique HTML/Flight assets across 13 pages.
- Independent review passed after strengthening exact copy, response-body/cache evidence and exam noindex checks. Post-review public-content checks passed. Local normal-browser home and 390px qualification layout were visually checked; no exam was submitted.
- Production browser proof, deployment identity and final external audit: pending until verified in the outer runtime report. This document does not declare an unfinished release complete.

## Rollback

Revert only this app/configuration change or promote the previous verified production app deployment. Do not change or roll back live WAF, auth, learner records, analytics secrets or store availability. A failing asset check is evidence to investigate the exact file/response and deployment; do not mask missing files with an all-200 rewrite, dummy JS, a hardcoded replacement hash or indiscriminate CDN purge.
