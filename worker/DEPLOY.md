# PASSMATE NAS Worker Deployment Runbook

## Status

This Worker is currently a **reference integration implementation**.

It proves:

- Supabase outbound polling
- atomic job claim
- lease ownership
- heartbeat renewal
- typed failure reporting
- SHA-256 generation
- completion/retry flow
- Docker execution on the NAS

It does **not** yet implement the final customer PDF transformation or cloud download upload.

The reference processor is intentionally disabled by default.

---

## 1. Expected NAS layout

```text
/PASSMATE
├── 00_SYSTEM
│   └── temp
├── 01_MASTER
│   └── PM-C2
│       └── 2027-v1.0
│           └── master.pdf
└── 02_ISSUED
```

The Docker container mounts:

```text
/PASSMATE/01_MASTER       -> /data/master  (read-only)
/PASSMATE/00_SYSTEM/temp  -> /data/work
/PASSMATE/02_ISSUED       -> /data/output
```

MASTER is never mounted writable.

---

## 2. Required environment

Copy:

```text
worker/.env.example
```

to:

```text
worker/.env
```

Required secret values:

```env
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

The service-role key must never be committed to GitHub or exposed to the browser.

---

## 3. Worker identity

Example:

```env
PASSMATE_WORKER_ID=nas-passmate-01
```

Worker IDs are operational identifiers only.

If a second Worker is added later:

```text
nas-passmate-01
nas-passmate-02
```

Each Worker uses the same queue, while atomic claim prevents both from owning the same job.

---

## 4. Default timing

```env
PASSMATE_POLL_SECONDS=10
PASSMATE_LEASE_SECONDS=300
PASSMATE_HEARTBEAT_SECONDS=60
PASSMATE_REQUEST_TIMEOUT_SECONDS=30
```

Meaning:

- poll every 10 seconds
- job ownership lasts 300 seconds
- renew ownership every 60 seconds
- HTTP RPC timeout is 30 seconds

Heartbeat must always be shorter than the lease.

---

## 5. Reference-copy safety gate

Default:

```env
PASSMATE_ALLOW_REFERENCE_COPY=false
```

When false, the Worker refuses to turn a MASTER PDF into an issued artifact.

For controlled integration testing only:

```env
PASSMATE_ALLOW_REFERENCE_COPY=true
```

This simply copies:

```text
/data/master/{product_code}/{product_version}/master.pdf
```

to the issued output tree, then computes SHA-256.

**Do not use reference-copy mode for public sales.**

The final processor will replace this with customer-output generation and temporary download storage.

---

## 6. Preflight

Before starting the long-running Worker:

```bash
docker compose -f worker/docker-compose.yml build

docker compose -f worker/docker-compose.yml run --rm \
  passmate-worker \
  python -m passmate_worker.main --check-config
```

Expected outcome:

```text
configuration OK
```

No queue job is claimed in `--check-config` mode.

---

## 7. One-job integration test

After Supabase migrations 0001 through 0004 are applied and a test job exists:

```bash
docker compose -f worker/docker-compose.yml run --rm \
  passmate-worker \
  python -m passmate_worker.main --once
```

This processes at most one job and exits.

Use this before enabling continuous mode.

---

## 8. Continuous mode

```bash
docker compose -f worker/docker-compose.yml up -d --build
```

Logs:

```bash
docker compose -f worker/docker-compose.yml logs -f passmate-worker
```

Stop:

```bash
docker compose -f worker/docker-compose.yml down
```

No public Docker port is exposed.

---

## 9. File permissions

The image runs as non-root user:

```text
UID 10001
```

The NAS host directories for work/output must be writable by the container user or mapped with equivalent Docker permissions.

MASTER needs read permission only.

---

## 10. Failure behavior

### Missing MASTER

```text
MASTER_NOT_FOUND
retryable=false
```

Job goes to dead-letter according to the server contract.

### Network/RPC failure while polling

Worker logs the failure and does not fabricate a job result.

### Heartbeat failure

The Worker treats ownership as lost.

It must not complete the old job and discards any reference output produced after losing the lease.

### Completion rejected

Output is treated as orphaned/stale and removed by the reference processor.

---

## 11. Promotion gate before real sales

Reference Worker is not production-ready until all are complete:

1. PASSMATE Supabase project created
2. migrations 0001~0004 applied
3. SQL smoke tests passed
4. NAS `--check-config` passed
5. one-job integration test passed
6. lease-loss/reclaim test passed
7. final PDF processor implemented
8. temporary customer download storage implemented
9. real MASTER version manifest validation implemented
10. end-to-end paid order test passed

Until then, `PASSMATE_ALLOW_REFERENCE_COPY=false` remains the safe default.
