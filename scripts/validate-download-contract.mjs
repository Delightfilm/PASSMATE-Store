import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const contract = JSON.parse(
  fs.readFileSync(
    new URL("../config/download-contract.json", import.meta.url),
    "utf8"
  )
);

if (contract.bucket_public !== false) {
  throw new Error("V5 artifact bucket must be private.");
}

if (contract.browser_direct_storage_read !== false) {
  throw new Error("Browser direct Storage reads are forbidden.");
}

if (contract.permanent_url_persisted !== false) {
  throw new Error("Permanent artifact URLs must not be persisted.");
}

if (contract.raw_signed_url_logged !== false) {
  throw new Error("Signed URLs must not be written to audit logs.");
}

if (
  !Number.isInteger(contract.signed_url_ttl_seconds) ||
  contract.signed_url_ttl_seconds < 30 ||
  contract.signed_url_ttl_seconds > 300
) {
  throw new Error("Signed URL TTL must stay between 30 and 300 seconds.");
}

const required = new Set(contract.download_requires);
for (const gate of [
  "authenticated_user",
  "active_entitlement",
  "paid_source_order",
  "ready_fulfillment",
  "succeeded_issuance_job",
]) {
  if (!required.has(gate)) {
    throw new Error("Missing V5 download gate: " + gate);
  }
}

for (const path of [
  "../supabase/functions/download-url/index.ts",
  "../components/download-button.tsx",
  "../components/library-client.tsx",
  "../lib/library-entitlements.ts",
  "../worker/passmate_worker/storage.py",
]) {
  if (!fs.existsSync(new URL(path, import.meta.url))) {
    throw new Error("Missing V5 implementation file: " + path);
  }
}

const libraryClient = fs.readFileSync(
  new URL("../components/library-client.tsx", import.meta.url),
  "utf8"
);

for (const selectionCall of [
  "selectPreferredLibraryGrants(entitlementRows, orderMap)",
  "isGrantDownloadReady(row, orders)",
]) {
  if (!libraryClient.includes(selectionCall)) {
    throw new Error("Library must use the tested grant selector: " + selectionCall);
  }
}

const selectorSource = fs.readFileSync(
  new URL("../lib/library-entitlements.ts", import.meta.url),
  "utf8"
);
const selectorJavaScript = ts.transpileModule(selectorSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const selectorModule = await import(
  "data:text/javascript;base64," +
    Buffer.from(selectorJavaScript).toString("base64")
);

const orders = {
  "order-old-ready": {
    id: "order-old-ready",
    status: "paid",
    fulfillment_status: "ready",
  },
  "order-new-processing": {
    id: "order-new-processing",
    status: "paid",
    fulfillment_status: "processing",
  },
  "order-new-ready": {
    id: "order-new-ready",
    status: "paid",
    fulfillment_status: "ready",
  },
  "order-pending-old": {
    id: "order-pending-old",
    status: "payment_pending",
    fulfillment_status: "not_started",
  },
  "order-pending-new": {
    id: "order-pending-new",
    status: "payment_pending",
    fulfillment_status: "not_started",
  },
};
const grants = [
  {
    id: "new-processing",
    status: "active",
    granted_at: "2026-09-18T02:00:00.000Z",
    product_id: "product-a",
    product_version_id: "version-1",
    source_order_id: "order-new-processing",
  },
  {
    id: "old-ready",
    status: "active",
    granted_at: "2026-09-18T01:00:00.000Z",
    product_id: "product-a",
    product_version_id: "version-1",
    source_order_id: "order-old-ready",
  },
  {
    id: "refunded-newer",
    status: "revoked",
    granted_at: "2026-09-18T03:00:00.000Z",
    product_id: "product-a",
    product_version_id: "version-1",
    source_order_id: "order-new-ready",
  },
  {
    id: "other-version",
    status: "active",
    granted_at: "2026-09-18T04:00:00.000Z",
    product_id: "product-a",
    product_version_id: "version-2",
    source_order_id: "order-new-ready",
  },
  {
    id: "pending-old",
    status: "active",
    granted_at: "2026-09-18T01:00:00.000Z",
    product_id: "product-b",
    product_version_id: "version-1",
    source_order_id: "order-pending-old",
  },
  {
    id: "pending-new",
    status: "active",
    granted_at: "2026-09-18T02:00:00.000Z",
    product_id: "product-b",
    product_version_id: "version-1",
    source_order_id: "order-pending-new",
  },
  {
    id: "ready-old",
    status: "active",
    granted_at: "2026-09-18T01:00:00.000Z",
    product_id: "product-c",
    product_version_id: "version-1",
    source_order_id: "order-old-ready",
  },
  {
    id: "ready-new",
    status: "active",
    granted_at: "2026-09-18T02:00:00.000Z",
    product_id: "product-c",
    product_version_id: "version-1",
    source_order_id: "order-new-ready",
  },
];

const selected = selectorModule.selectPreferredLibraryGrants(grants, orders);
assert.equal(selected.length, 4, "Library must render one card per product/version");
assert.equal(
  selected.find(
    (grant) =>
      grant.product_id === "product-a" &&
      grant.product_version_id === "version-1"
  )?.id,
  "old-ready",
  "An older downloadable grant must beat a newer preparing/refunded grant"
);
assert.equal(
  selected.find(
    (grant) =>
      grant.product_id === "product-b" &&
      grant.product_version_id === "version-1"
  )?.id,
  "pending-new",
  "The newest active grant must win when none is downloadable"
);
assert.equal(
  selected.find(
    (grant) =>
      grant.product_id === "product-c" &&
      grant.product_version_id === "version-1"
  )?.id,
  "ready-new",
  "The newest grant must win when multiple grants are downloadable"
);
assert.ok(
  selected.some((grant) => grant.product_version_id === "version-2"),
  "Different product versions must remain separate library cards"
);

console.log("PASSMATE V5 private download contract OK");
