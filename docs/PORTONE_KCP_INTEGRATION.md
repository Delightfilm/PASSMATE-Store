# PASSMATE PortOne V2 + NHN KCP Integration

## Current decision

1차 결제 경로:

```text
PASSMATE → PortOne V2 → NHN KCP
```

## Required configuration

Browser-safe identifiers:

- `PORTONE_STORE_ID`
- `PORTONE_KCP_CHANNEL_KEY`

Server-only secrets:

- `PORTONE_API_SECRET`
- `PORTONE_WEBHOOK_SECRET`

Server-only values must never be exposed to browser code or committed to Git.

## payment-start Edge Function

JWT-required endpoint. The browser sends only product slug + logical idempotency key.

```text
JWT verify
→ provider config check
→ create_direct_checkout()
→ server catalog price/version
→ order + order_item + payment_attempt
→ persisted merchant paymentId returned
```

The DB serializes provider + idempotency key. HTTP/browser retry of the same logical checkout returns the original order, payment attempt, and paymentId.

## payment-sync Edge Function

JWT-required purchaser reconciliation endpoint.

```text
authenticated purchaser
→ paymentId ownership check
→ PortOne GET /payments/{paymentId}
→ paymentId / Store ID / KRW / amount verification
→ apply_payment_event()
→ own order state polling
```

Browser/redirect success is never sufficient to mark an order paid. This endpoint is the synchronous recovery path when webhook delivery is delayed.

## payment-webhook Edge Function

The PortOne webhook endpoint does not use Supabase JWT. It authenticates the provider request with PortOne Standard Webhooks signature verification.

```text
raw body + webhook headers
→ Standard Webhooks HMAC verify
→ expected Store ID gate
→ paymentId extract
→ PortOne GET /payments/{paymentId}
→ authoritative paymentId / Store ID / KRW / amount
→ apply_payment_event()
```

The raw webhook body is not stored. The DB stores only a SHA-256 fingerprint and normalized payment event metadata.

Partial cancellation is not auto-applied in the current launch contract; it is surfaced as manual review. V3 supports full refund only.

## Multi-source convergence

Browser reconciliation and webhook delivery may race. `apply_payment_event()` serializes the payment attempt/order and treats a separately identified verified event for an already-applied identical state as `already_applied`. Entitlement grant and issuance enqueue therefore remain single-effect.

## Live deployment state

As of 2026-09-18:

- `payment-start` v3 — ACTIVE, JWT required
- `payment-sync` v1 — ACTIVE, JWT required
- `payment-webhook` v3 — ACTIVE, gateway JWT disabled; custom PortOne signature verification required
- Payment idempotency and reconciliation migrations applied
- replay and sync/webhook convergence verification migrations passed
- Supabase Security Advisor: 0 findings

## Launch blocker

Before sandbox/public payment validation:

1. Confirm PortOne Store ID
2. Confirm NHN KCP Channel Key
3. Confirm PortOne V2 API Secret
4. Configure PortOne Webhook Secret in the Edge Function environment
5. Register the PASSMATE webhook URL in PortOne
6. Run success/failure/cancel/full-refund sandbox E2E
7. Confirm browser redirect + signed webhook races converge to one final DB state

Do not enable public sales until this external E2E passes.
