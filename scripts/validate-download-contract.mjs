import fs from "node:fs";

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
  "../worker/passmate_worker/storage.py",
]) {
  if (!fs.existsSync(new URL(path, import.meta.url))) {
    throw new Error("Missing V5 implementation file: " + path);
  }
}

console.log("PASSMATE V5 private download contract OK");
