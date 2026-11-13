# Public NAS bundle delivery through the existing site edge

User authorization: the November13 request to resolve remaining NAS transfer
latency and backup problems while retaining noon operations/SEO-GEO reporting.
This is a bounded change to the existing public bundle loading flow.

## Evidence and goal

The verified NAS origin serves the electric bundle in about0.02s. The browser
received public NAS content through Cloudflare LAX, while the existing site
CDN served cached resources through Vercel ICN. Static Brotli reduced all738
bundles from187324600 to135679151bytes, but catalog/TLS variation remains.
Use the existing site edge for versioned public bundles; verify actual cache
HIT, unchanged decoded JSON and real preparation screens before rollout.

## Contract

- Only GET/HEAD to `/question-bank-content/bundles/<code>.json.gz?v=<sha256>`
  may rewrite to the fixed `https://content.mypassmate.com/bundles/...` origin.
- Matcher covers only `/question-bank-content/`. Other routes skip middleware.
  Invalid filenames, digests, duplicate/unknown query keys, retry nonces and
  unsupported methods fail closed with no-store and noindex.
- Forward only public representation/validation headers. Never forward Cookie,
  Authorization, Referer, Origin, user/account headers or arbitrary x-* values.
  Browser cookies stay at the existing www boundary; do not relax WAF/auth.
- Honor the origin cache policy rather than force caching all statuses. Existing
  SHA versions, successful200/304 freshness and error/no-store policy remain.
  Rewriting streams the original representation without a Function body decoder.
- Only browser loads using the official content origin use the site edge.
  Server AI lookups, other content origins, legacy hashes, catalog and images
  continue to use NAS directly. Source data and private/AI/payment routes stay.
- Invalid data/404/5xx get the existing single direct NAS no-store nonce recovery;
  401/403/429/cancellation do not bypass access controls or retry indefinitely.
  Keep catalog freshness, four-entry LRU, coalescing and persisted learning IDs.
- Rollback is the prior web deployment. New clients hitting a rolled-back edge
  path recover through the existing direct-NAS path. No database migration,
  new account/service, subscription, credential or NAS network change is needed.

## Verification

Observe failing tests first. Exercise actual NextResponse rewrite request-header
overrides, path/method/query rejection, server/browser/legacy URL selection,
direct recovery and authentication/rate-limit non-retry. Run full existing
checks/types/Node22 build and independent review. Measure preview/production
rewrite cache MISS/HIT, decoded-body SHA, error cache and ICN region, plus actual
CBT preparation without starting/submitting an exam. READY alone is insufficient.
If caching or header separation cannot be verified, retain direct delivery.

Status: implementation/verification in progress; final deployment and observed
performance belong in the dated outer reports/nas-recovery-backup-20261113.
