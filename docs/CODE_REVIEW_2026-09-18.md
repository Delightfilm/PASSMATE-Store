# PASSMATE Full Code Review — 2026-09-18

## Scope

Reviewed current `main` across:

- Next.js static storefront, Auth, Checkout, Library, Admin UI
- catalog/config/contract validators
- Supabase migrations 0001–0014
- live RLS policies, table/function privileges, Security/Performance Advisor state
- payment-start / payment-webhook / download-url / admin-data / admin-action Edge Functions
- NAS Worker queue/lease/heartbeat, MASTER manifest, PDF transformer, Storage adapter
- Worker and SQL runtime tests
- GitHub Build/Worker workflows
- current official Next.js, Supabase, PortOne, pypdf behavior relevant to the implementation

This review is pre-launch. Findings are prioritized by whether they can cause incorrect charging, loss of paid access, missing customer artifacts, privilege bypass, or non-reproducible production behavior.

## Release Blockers (P0)

### P0-1 — stale Worker can delete a successfully adopted artifact

Files:
- `worker/passmate_worker/final_processor.py`
- `worker/passmate_worker/storage.py`
- `worker/passmate_worker/worker.py`

Current production storage key is deterministic for the same job/generation.

A stale Worker uploads an object and, if it later detects lease loss or DB completion rejection, calls `discard()`. Production `discard()` deletes that deterministic final key.

Race:

```text
Worker A uploads K
A lease expires
Worker B reclaims same job
B sees K / verifies identical object
B completes DB job successfully
A gets stale completion or lost lease
A discard() deletes K
DB = succeeded/ready, Storage = missing
```

Impact: paid customer can have a ready order whose PDF no longer exists.

Required fix before public sales:
- never let a stale Worker delete the shared final key, or
- use attempt/lease-specific temporary keys with an explicit promote/finalize protocol.
- add a deterministic race regression test.

### P0-2 — entitlement model breaks repurchase/refund correctness

Files:
- `supabase/migrations/0001_v1_core.sql`
- `supabase/migrations/0007_v3_payment_contract.sql`
- `supabase/migrations/0008_v3_direct_checkout.sql`

`entitlements` currently has `unique(user_id, product_id)`.

A successful later purchase upserts the same row and overwrites `source_order_id`. If the later order is refunded, refund logic revokes the entitlement even when an earlier paid order still grants access.

The same model also cannot naturally preserve simultaneous access to multiple purchased yearly versions of one product.

Required fix:
- define entitlement semantics before V8.
- simplest launch-safe rule: block duplicate purchase of an already-owned product/version.
- preferably migrate grants to version/order-item-aware records and derive effective access without overwriting historical purchase grants.
- add repurchase → refund regression tests.

### P0-3 — Checkout can display one price/product and charge another

Files:
- `components/checkout-client.tsx`
- `lib/products.ts`
- `supabase/functions/payment-start/index.ts`

Checkout sidebar is hardcoded to PM-C2 / 6,900원 while `productSlug` comes from the URL and the final amount comes from live DB through `payment-start`.

If DB price changes without a storefront redeploy, or another product slug becomes purchasable, the payment window can receive a different server amount than the amount shown on the checkout page.

Required fix:
- make Checkout display the server-authoritative product/title/amount returned by a prepare step.
- require visible confirmation of the exact amount immediately before `requestPayment()`.
- do not hardcode product title/price in Checkout.

## High Priority (P1)

### P1-1 — payment idempotency is not end-to-end

Browser creates a random idempotency key per click. `payment-start` creates a new paymentId on every HTTP request.

Replaying the same idempotency key generates a different merchant/payment ID, and the DB correctly rejects that pair as identity reuse. Therefore network retry of the same logical request is not actually idempotent.

Fix:
- make paymentId deterministic/persisted for the idempotency key, or
- create/retrieve the attempt atomically by user + idempotency key and return the original paymentId on replay.

### P1-2 — successful browser return has no server reconciliation path

After PortOne Promise/redirect success, the completion page only polls PASSMATE order state. It does not call a server endpoint that re-fetches the payment.

If webhook delivery is delayed or exhausted, a real paid customer can remain `payment_pending`.

Fix:
- add `payment-sync` / completion Edge Function that accepts paymentId from the authenticated purchaser, re-fetches PortOne, and idempotently applies the authoritative state.
- keep webhook as the asynchronous safety path.

### P1-3 — webhook hardening incomplete

Current webhook correctly re-fetches PortOne and does not trust the body status, which is a good baseline.

Still missing for production:
- Standard Webhooks signature verification
- expected Store ID validation
- authoritative currency validation (`KRW`) in addition to amount
- explicit handling/alerting for partial cancellation and unexpected terminal states
- request throttling/abuse control

PortOne documents both server re-fetch and signature verification strategies. Use both for defense in depth.

### P1-4 — authenticated admin retains broad direct table DML

Live grants/policies allow an authenticated user with `profiles.role=admin` to directly INSERT/UPDATE/DELETE:
- products
- product_versions
- orders
- order_items
- entitlements

This bypasses the V7 Edge Function action allowlist and the stated Release Gate policy. In particular an admin browser JWT can mutate product status/price or hard-delete operational records via the Data API even though the UI intentionally does not expose those actions.

Fix:
- remove direct authenticated DML for sensitive operational tables.
- keep customer read policies.
- route all admin mutations through narrow service-backed RPC/Edge actions with audit and invariants.

### P1-5 — hard delete can erase financial/issuance audit history

Order-related tables use cascading deletes in several places, including payment/issuance/audit records. Combined with direct admin DELETE, an order can lose most of its historical evidence.

Fix:
- prohibit hard deletion of financial orders in normal operations.
- use soft-delete/archive semantics where needed.
- make audit/event retention independent from mutable operational parent deletion where investigation/history matters.

### P1-6 — Supabase legacy server keys are on a deprecation path

Browser code already uses a modern publishable key, which is correct.

However Edge Functions and NAS Worker still depend on:
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Supabase currently documents legacy anon/service_role deprecation by the end of 2026 and recommends publishable/secret keys.

Fix before V8/production hardening:
- Edge user client → modern publishable key
- Edge admin + NAS Worker → scoped modern secret keys
- use a separate secret key per backend component when practical
- rotate/deactivate legacy keys only after usage is zero

### P1-7 — catalog fallback semantics can defeat an operational kill switch

`getProducts()` returns local catalog when Supabase returns zero active products.

If all DB products are intentionally deactivated, the storefront can still show the local PM-C2 product. Server checkout remains protected by the DB active check, but storefront truth becomes misleading.

Also network exceptions around `fetch()` are not caught, so some outages fail the build rather than taking the documented fallback.

Fix:
- use local fallback only under an explicit dev/build fallback flag.
- production empty catalog should stay empty/fail closed.
- catch network exceptions deliberately and define production behavior.

### P1-8 — immutable MASTER versioning is not enforced by the registration tool

`master_tool init` can overwrite `master.pdf` and regenerate `manifest.json` in an existing product/version directory.

This allows the meaning of `PM-C2/2027-v1.0` to change in place.

Fix:
- refuse overwrite when a version directory already contains a registered MASTER.
- require a new product version for changed bytes, with an explicit exceptional recovery path if truly needed.

## Medium Priority (P2)

### P2-1 — runtime dependencies are not fully reproducible

- root has no `package-lock.json`
- GitHub Build and Vercel use `npm install`
- Edge Functions import `npm:@supabase/supabase-js@2`, not an exact version
- PortOne Browser SDK is loaded from a mutable CDN URL at runtime

Top-level web package versions are exact, but transitive/Edge/browser dependency bytes are not fully pinned.

Fix:
- commit a lockfile and use `npm ci`
- pin Edge supabase-js version
- prefer pinned `@portone/browser-sdk` package over runtime CDN

### P2-2 — CSP/security headers are not explicitly defined

The static storefront has no project-defined Content-Security-Policy or related hardening headers.

Because client-only Auth stores tokens in browser storage and checkout currently loads a third-party runtime script, XSS/supply-chain protection is especially important.

Fix:
- bundle/pin PortOne SDK first
- define a restrictive CSP compatible with Supabase/PortOne
- add other headers suitable for the static site.

### P2-3 — V6 integrity mismatch does not quarantine customer download

V6 correctly records `mismatch` / `unavailable`, but V5 download authorization intentionally ignores V6 integrity status.

That is a policy decision, but it means a known-mismatched artifact can still be signed for download while the entitlement/order/job gates remain valid.

Decision required:
- either keep V6 informational only, or
- make `mismatch` an operational quarantine that blocks new signed links until repaired.

### P2-4 — integrity verification loads the complete PDF into Edge memory

Admin integrity action uses `object.arrayBuffer()` before hashing. The bucket allows up to 50 MiB.

Fine for early small PDFs, but use streaming hash/size or a tighter artifact size ceiling if products grow.

### P2-5 — trigger-function execute grants should be tightened

Live privilege inspection shows new private trigger functions have default EXECUTE grants visible to anon/authenticated, although PostgreSQL trigger functions cannot be meaningfully invoked as normal functions.

Revoke direct EXECUTE anyway for least privilege.

### P2-6 — broad wildcard CORS on JWT Edge Functions

Authenticated Edge Functions return `Access-Control-Allow-Origin: *`.

Authorization tokens still protect the endpoints, so this is not an immediate authorization bypass. Restrict production origins for defense in depth.

### P2-7 — missing concurrency/recovery/browser E2E coverage

Current SQL runtime tests and Worker unit tests are useful, but launch-critical gaps include:
- two-Worker lease-loss/storage race
- duplicate purchase/refund
- payment HTTP replay/idempotency
- webhook + browser reconciliation race
- real Auth own-row RLS
- real admin/customer separation
- real browser payment redirect flow
- fresh database migration from 0001 through latest
- Edge Function unit/contract tests

## Low Priority / Documentation (P3)

- README still describes Supabase/Auth/payment/storage as unconnected.
- STATUS V3 says actual PG is not selected while V3.1 correctly records PortOne V2 + NHN KCP.
- Checkout/product pre-launch copy is intentionally stale but must be normalized before V8.
- Worker Storage User-Agent still says `passmate-nas-worker/0.2` while Worker version is `0.4.0`.
- UUID regex validation in some Edge Functions is permissive rather than canonical.

## What is already strong

### Database/security
- latest Supabase Security Advisor: 0 findings
- queue/payment/admin/download RPCs are service-role-only
- customer issuance/payment/internal tables are directly denied
- profile role self-escalation is blocked with column-level privilege
- customer order/item/entitlement RLS is scoped to the owner
- private Storage bucket and short signed-download flow are correctly separated

### State/queue design
- order status and fulfillment status are separate
- illegal transitions are enforced in DB
- atomic claim + lease + heartbeat + retry/dead-letter are solid foundations
- stale DB completion is rejected
- admin reissue uses a new generation and latest-generation aggregation
- V6 lifecycle correctly tracks active/superseded/revoked

### Payment design
- browser cannot mark an order paid
- authoritative provider re-fetch exists
- amount is verified server-side
- payment event dedupe exists
- payment success, entitlement grant, and issuance enqueue share a DB transaction boundary

### Dependencies
- Next.js `15.5.24` is on the patched Maintenance LTS release for the August 2026 critical fixes.
- pypdf `6.19.0` includes the latest published security hardening as of this review.
- browser Supabase config uses a publishable key, not a server secret.

## Recommended fix order

1. P0 stale Worker delete race
2. P0 entitlement/repurchase/refund model
3. P0 Checkout server-authoritative amount display
4. payment idempotency + authenticated reconciliation endpoint
5. webhook signature/currency/store validation
6. remove direct authenticated admin DML + hard-delete path
7. migrate server components to Supabase secret keys
8. catalog fail-closed semantics
9. enforce immutable MASTER versions
10. lock/pin dependencies + CSP
11. add launch concurrency/E2E test suite
12. clean documentation drift

## Release recommendation

Do not open the V8 public sale button before all P0 items and payment/admin P1 items are closed and the real end-to-end path has passed:

```text
real account
→ sandbox/realistic payment
→ paid
→ entitlement
→ NAS worker
→ private Storage
→ V6 registry
→ ready
→ signed download
→ refund/revoke
```
## P0 Resolution — 2026-09-18

All three release blockers are resolved:

1. **Worker artifact race:** stale lease-loss and rejected-completion paths no longer delete the deterministic published Storage key; the Worker and final processor tests cover the successor-Worker race.
2. **Entitlement history:** the migration makes grants order/version scoped and backfills paid/refunded history. Duplicate webhooks are idempotent; repurchase and refund tests confirm an earlier paid grant survives a later-order refund. The Library selects the effective ready grant without hiding an older valid purchase.
3. **Checkout authority:** `payment-start` rejects client amount/title fields and returns the current catalog code, version, title, and amount. The UI renders those fields and requires an explicit amount confirmation before PortOne.

Local verification passed (`npm run build`, 28 Worker tests, Deno type check). Live Supabase verification passed after applying the three P0 migrations; fixtures were cleaned up, the payment-start v2 function is active with JWT verification, and Security Advisor reports zero findings.

The P0 findings above remain in the historical sections for traceability. The remaining release gate is authenticated NAS/PortOne/Auth E2E plus the listed P1 payment and admin hardening items.

## Payment P1 Resolution — 2026-09-18

Payment P1 code and live database/function hardening are implemented. Real PortOne sandbox traffic remains the external verification gate.

1. **End-to-end idempotency:** `create_direct_checkout()` serializes the logical provider/idempotency key with a transaction advisory lock. Replays return the original order, payment attempt, and persisted merchant payment ID instead of creating another pending order. Cross-user/product key reuse is rejected. Live regression migration passed.
2. **Authenticated browser reconciliation:** new JWT-protected `payment-sync` binds the merchant payment ID to the authenticated purchaser, re-fetches PortOne, validates payment/store/currency/amount, then applies the same DB payment event path used by webhooks.
3. **Webhook hardening:** `payment-webhook` v3 verifies PortOne Standard Webhooks signatures against the raw body, validates expected Store ID, re-fetches the authoritative payment, requires KRW and exact amount, and sends partial/unexpected cancellation states to manual review instead of guessing.
4. **Race convergence:** separate verified sync/webhook deliveries for the same paid/refunded state return `already_applied`; entitlement and issuance side effects do not run twice. Live convergence verification passed.
5. **Security:** post-migration Supabase Security Advisor reports 0 findings.

Remaining operational gate:
- configure/confirm `PORTONE_STORE_ID`, `PORTONE_KCP_CHANNEL_KEY`, `PORTONE_API_SECRET`, and `PORTONE_WEBHOOK_SECRET`;
- register the webhook URL in PortOne;
- run authenticated sandbox success/failure/cancel/refund E2E, including browser redirect and signed webhook delivery.

The historical P1 findings above remain for traceability.

## Remaining P1 Resolution — 2026-09-18

The remaining repository-review P1 code findings are now addressed.

1. **Authenticated admin direct DML removed:** browser-authenticated admins no longer have direct INSERT/UPDATE/DELETE paths for catalog/order/entitlement records. Mutations must use audited service-side RPC/Edge paths. Live privilege/policy verification passed.
2. **Hard-delete blocked:** service-role DELETE/TRUNCATE privileges were revoked from commercial/payment/issuance/audit records and runtime API DELETE/TRUNCATE triggers reject destructive request contexts. Migration/maintenance SQL outside request context remains available for deliberate fixture cleanup. Live verification passed.
3. **Modern Supabase keys:** all six Edge Functions now use pinned `@supabase/server@1.7.0` and no longer read legacy anon/service-role environment variables. The live functions were redeployed successfully. The NAS Worker supports `sb_secret_...` via `apikey` only and refuses legacy service-role credentials in production mode.
4. **Catalog fail-closed:** runtime catalog failures and zero active products no longer fall back to local sale inventory by default. The local JSON escape hatch is explicit and off by default.
5. **Immutable MASTER registration:** the same product/version directory cannot be initialized twice; changed bytes require a new product version. Regression tests preserve the original PDF and manifest after a rejected overwrite.

Remaining operational tasks are not repository P1 fixes: provision the modern secret on the NAS without exposing it in Git/chat, reconnect the missing Vercel PASSMATE project, and complete real Auth/PortOne/NAS end-to-end testing.
