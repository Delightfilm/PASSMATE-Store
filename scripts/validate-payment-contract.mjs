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

console.log("PASSMATE V3 payment contract OK");
