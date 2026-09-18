import fs from "node:fs";

const contract = JSON.parse(
  fs.readFileSync(
    new URL("../config/issuance-job-contract.json", import.meta.url),
    "utf8"
  )
);

if (contract.schema_version !== 1) {
  throw new Error("issuance contract: unsupported schema_version");
}

const statuses = new Set(contract.job.statuses);
for (const required of [
  "queued",
  "leased",
  "retry_wait",
  "succeeded",
  "dead_letter",
  "cancelled"
]) {
  if (!statuses.has(required)) {
    throw new Error(`issuance contract: missing status ${required}`);
  }
}

for (const terminal of contract.job.terminal) {
  if (!statuses.has(terminal)) {
    throw new Error(`issuance contract: unknown terminal status ${terminal}`);
  }
}

const lease = contract.lease;
if (
  lease.min_seconds < 30 ||
  lease.default_seconds < lease.min_seconds ||
  lease.default_seconds > lease.max_seconds ||
  lease.heartbeat_seconds >= lease.default_seconds
) {
  throw new Error("issuance contract: invalid lease configuration");
}

if (
  !Number.isInteger(contract.retry.max_attempts) ||
  contract.retry.max_attempts < 1
) {
  throw new Error("issuance contract: max_attempts must be positive");
}

if (
  contract.retry.backoff_seconds.length !==
  contract.retry.max_attempts - 1
) {
  throw new Error(
    "issuance contract: retry backoff count must equal max_attempts - 1"
  );
}

const requiredClaimFields = new Set(contract.claim_payload.required);
for (const field of [
  "job_id",
  "lease_token",
  "attempt",
  "order_id",
  "order_item_id",
  "product_code",
  "product_version"
]) {
  if (!requiredClaimFields.has(field)) {
    throw new Error(`issuance contract: claim payload missing ${field}`);
  }
}

const forbidden = new Set(contract.claim_payload.forbidden_personal_fields);
for (const field of ["email", "name", "phone", "address"]) {
  if (!forbidden.has(field)) {
    throw new Error(
      `issuance contract: PII guard must explicitly forbid ${field}`
    );
  }
}

for (const [code, definition] of Object.entries(contract.error_codes)) {
  if (typeof definition.retryable_default !== "boolean") {
    throw new Error(
      `issuance contract: error code ${code} has invalid retryable_default`
    );
  }
}

console.log("PASSMATE issuance job contract OK");
