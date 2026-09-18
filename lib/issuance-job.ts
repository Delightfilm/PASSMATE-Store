import contract from "@/config/issuance-job-contract.json";

export type IssuanceJobStatus =
  | "queued"
  | "leased"
  | "retry_wait"
  | "succeeded"
  | "dead_letter"
  | "cancelled";

export type IssuanceErrorCode =
  | "NETWORK_ERROR"
  | "STORAGE_UPLOAD_FAILED"
  | "PDF_PROCESS_FAILED"
  | "HASH_FAILED"
  | "MASTER_NOT_FOUND"
  | "MASTER_VERSION_MISMATCH"
  | "INVALID_JOB"
  | "LEASE_LOST"
  | "ORDER_NOT_PAID";

export type IssuanceClaim = {
  schema_version: 1;
  job_id: string;
  lease_token: string;
  attempt: number;
  generation: number;
  order_id: string;
  order_item_id: string;
  product_code: string;
  product_version: string;
  edition_year: number | null;
  artifact_code: string;
};

export type IssuanceCompletion = {
  job_id: string;
  lease_token: string;
  storage_key: string;
  sha256: string;
  size_bytes: number;
};

export type IssuanceFailure = {
  job_id: string;
  lease_token: string;
  error_code: IssuanceErrorCode;
  retryable: boolean;
  error_detail?: string;
};

export const ISSUANCE_SCHEMA_VERSION =
  contract.schema_version as IssuanceClaim["schema_version"];

export const ISSUANCE_JOB_STATUSES =
  contract.job.statuses as IssuanceJobStatus[];

export const ISSUANCE_LEASE_SECONDS = contract.lease.default_seconds;
export const ISSUANCE_HEARTBEAT_SECONDS = contract.lease.heartbeat_seconds;
export const ISSUANCE_MAX_ATTEMPTS = contract.retry.max_attempts;

export function defaultRetryability(code: IssuanceErrorCode): boolean {
  return contract.error_codes[code].retryable_default;
}

export function isValidSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}
