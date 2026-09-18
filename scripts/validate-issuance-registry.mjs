import fs from "node:fs";

const contract = JSON.parse(
  fs.readFileSync(
    new URL("../config/issuance-registry-contract.json", import.meta.url),
    "utf8"
  )
);

if (contract.customer_ui_exposed !== false) {
  throw new Error("V6 issuance registry must remain hidden from customer UI.");
}

if (contract.stores_customer_pii !== false) {
  throw new Error("V6 issuance registry must not store customer PII.");
}

if (contract.storage_verification?.creates_signed_url !== false) {
  throw new Error("V6 admin integrity check must not mint a download URL.");
}

for (const status of ["active", "superseded", "revoked"]) {
  if (!contract.lifecycle_statuses.includes(status)) {
    throw new Error("Missing V6 artifact lifecycle status: " + status);
  }
}

for (const status of ["unchecked", "verified", "mismatch", "unavailable"]) {
  if (!contract.integrity_statuses.includes(status)) {
    throw new Error("Missing V6 integrity status: " + status);
  }
}

for (const path of [
  "../supabase/migrations/0013_v6_issuance_registry.sql",
  "../supabase/functions/admin-data/index.ts",
  "../supabase/functions/admin-action/index.ts",
  "../components/admin-client.tsx",
]) {
  if (!fs.existsSync(new URL(path, import.meta.url))) {
    throw new Error("Missing V6 implementation file: " + path);
  }
}

const customerLibrary = fs.readFileSync(
  new URL("../components/library-client.tsx", import.meta.url),
  "utf8"
);
const customerDownload = fs.readFileSync(
  new URL("../components/download-button.tsx", import.meta.url),
  "utf8"
);

for (const source of [customerLibrary, customerDownload]) {
  if (/issuance_artifacts|internal_ref|integrity_status/.test(source)) {
    throw new Error("V6 internal issuance registry leaked into customer UI code.");
  }
}

console.log("PASSMATE V6 internal issuance registry contract OK");
