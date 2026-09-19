import fs from "node:fs";

const contract = JSON.parse(
  fs.readFileSync(
    new URL("../config/payment-contract.json", import.meta.url),
    "utf8"
  )
);

if (contract.schema_version !== 1) {
  throw new Error("payment contract: unsupported schema version");
}

const events = new Set(contract.events.types);
for (const event of ["paid", "failed", "cancelled", "refunded"]) {
  if (!events.has(event)) {
    throw new Error(`payment contract: missing event ${event}`);
  }
}

if (contract.events.store_raw_payload !== false) {
  throw new Error("payment contract: raw webhook payload must not be persisted");
}

if (contract.security.browser_can_mark_paid !== false) {
  throw new Error("payment contract: browser must never be able to mark an order paid");
}

if (contract.security.rpc_role !== "service_role") {
  throw new Error("payment contract: payment RPC must be service-role only");
}

if (contract.security.direct_order_requires_user !== true) {
  throw new Error("payment contract: direct checkout must require an authenticated user");
}

const sideEffects = new Set(contract.paid_side_effects);
for (const required of [
  "order_paid",
  "entitlement_grant_if_user",
  "issuance_enqueue",
]) {
  if (!sideEffects.has(required)) {
    throw new Error(`payment contract: paid side effect missing: ${required}`);
  }
}

const idempotencyMigration = fs.readFileSync(
  new URL(
    "../supabase/migrations/20260918125429_payment_p1_idempotent_checkout.sql",
    import.meta.url
  ),
  "utf8"
);
const reconciliationMigration = fs.readFileSync(
  new URL(
    "../supabase/migrations/20260918125922_payment_p1_reconciliation.sql",
    import.meta.url
  ),
  "utf8"
);
const paymentStart = fs.readFileSync(
  new URL("../supabase/functions/payment-start/index.ts", import.meta.url),
  "utf8"
);
const paymentSync = fs
  .readFileSync(
    new URL("../supabase/functions/payment-sync/index.ts", import.meta.url),
    "utf8"
  )
  .replaceAll("\r\n", "\n");
const paymentWebhook = fs.readFileSync(
  new URL("../supabase/functions/payment-webhook/index.ts", import.meta.url),
  "utf8"
);
const checkout = fs.readFileSync(
  new URL("../components/checkout-client.tsx", import.meta.url),
  "utf8"
);

for (const required of [
  "pg_advisory_xact_lock",
  "idempotency key reused by another user",
  "idempotency key reused for different product",
]) {
  if (!idempotencyMigration.includes(required)) {
    throw new Error(`payment idempotency hardening missing: ${required}`);
  }
}

if (
  !paymentStart.includes('select("id,merchant_order_id")') ||
  !paymentStart.includes("paymentId: attempt.merchant_order_id")
) {
  throw new Error("payment-start must return the persisted merchant payment id on replay");
}

if (
  !checkout.includes("useRef<string | null>(null)") ||
  !checkout.includes("checkoutIdempotencyKey.current ??= crypto.randomUUID()") ||
  !checkout.includes("idempotencyKey: checkoutIdempotencyKey.current")
) {
  throw new Error("checkout must reuse one logical idempotency key across preparation retries");
}

if (!reconciliationMigration.includes("return 'already_applied'")) {
  throw new Error("payment events must converge across sync/webhook sources");
}

for (const required of [
  'Deno.env.get("PORTONE_STORE_ID")',
  'payment.currency !== "KRW"',
  "payment.amount.total !== attempt.amount_krw",
  'admin.rpc(\n    "apply_payment_event"',
]) {
  if (!paymentSync.includes(required)) {
    throw new Error(`payment-sync hardening missing: ${required}`);
  }
}

if (paymentWebhook.includes("isUnrecognizedWebhook")) {
  throw new Error("payment webhook must not assume Webhook.verify returns a decoded payload");
}

for (const required of [
  'jsr:@portone/server-sdk@0.19.0',
  "PortOne.Webhook.verify",
  "Object.fromEntries(req.headers.entries())",
  "JSON.parse(rawBody)",
  'Deno.env.get("PORTONE_WEBHOOK_SECRET")',
  'webhook.data?.storeId !== expectedStoreId',
  'payment.currency !== "KRW"',
  "payment.amount.total !== attempt.amount_krw",
  "partial_cancellation_not_supported",
]) {
  if (!paymentWebhook.includes(required)) {
    throw new Error(`payment webhook hardening missing: ${required}`);
  }
}

console.log("PASSMATE V3 payment contract OK");
