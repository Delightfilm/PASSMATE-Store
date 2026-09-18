# PASSMATE NAS Worker Deployment Runbook

## Status

V4 production wiring is implemented.

The Worker supports explicit modes:

- `production`: validated MASTER → pypdf rewrite → private Supabase Storage
- `reference`: controlled queue/lease integration test only

The default is `disabled`, so a new NAS environment cannot claim jobs until the operator explicitly enables a processor mode.

No public Docker port is exposed.

## 1. NAS layout

```text
/PASSMATE
├── 00_SYSTEM
│   └── temp
├── 01_MASTER
│   └── PM-C2
│       └── 2027-v1.0
│           ├── master.pdf
│           └── manifest.json
└── 02_ISSUED
```

Container mounts:

```text
/PASSMATE/01_MASTER       -> /data/master  (read-only)
/PASSMATE/00_SYSTEM/temp  -> /data/work
/PASSMATE/02_ISSUED       -> /data/output
```

Production artifacts upload to private Supabase Storage. `/data/output` remains for reference integration mode.

## 2. MASTER registration

```bash
python -m passmate_worker.master_tool init \
  --master-root /data/master \
  --source /incoming/final.pdf \
  --product-code PM-C2 \
  --product-version 2027-v1.0 \
  --edition-year 2027
```

Verify:

```bash
python -m passmate_worker.master_tool verify \
  --directory /data/master/PM-C2/2027-v1.0
```

The long-running Worker mounts MASTER read-only.

## 3. Environment

Required server-only values:

```env
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Initial safe state:

```env
PASSMATE_PROCESSOR_MODE=disabled
PASSMATE_ALLOW_REFERENCE_COPY=false
```

Production after preflight:

```env
PASSMATE_PROCESSOR_MODE=production
PASSMATE_STORAGE_BUCKET=passmate-artifacts
PASSMATE_ALLOW_REFERENCE_COPY=false
```

## 4. Production PDF transform

V4 uses pypdf to clone/rewrite the validated MASTER into a fresh PDF.

- manifest SHA-256 must match
- encrypted MASTER rejected
- zero-page MASTER rejected
- output must parse
- page count must match
- output cannot be byte-identical to MASTER
- no buyer-specific identifiers are added in V4
- private Storage upload only

V6 can layer internal issuance controls later without changing the V4 queue/storage interface.

## 5. Preflight

```bash
docker compose -f worker/docker-compose.yml build

docker compose -f worker/docker-compose.yml run --rm \
  passmate-worker \
  python -m passmate_worker.main --check-config
```

`--check-config` never claims a queue job.

## 6. One-job production test

After MASTER verify and a paid test order:

```env
PASSMATE_PROCESSOR_MODE=production
```

```bash
docker compose -f worker/docker-compose.yml run --rm \
  passmate-worker \
  python -m passmate_worker.main --once
```

Expected:

```text
queued → leased → private Storage upload → succeeded → ready
```

Then verify V5 signed download.

## 7. Continuous mode

```bash
docker compose -f worker/docker-compose.yml up -d --build
docker compose -f worker/docker-compose.yml logs -f passmate-worker
```

## 8. Runtime hardening

- non-root UID 10001
- read-only container root filesystem
- MASTER read-only
- writable work/output mounts only
- tmpfs /tmp
- all Linux capabilities dropped
- no-new-privileges
- no inbound ports
- outbound HTTPS to Supabase only

## 9. Worker heartbeat

Each Worker reports worker ID, random process instance ID, mode, version, last-seen time, and current leased job.

`report_worker_node()` is service-role only. Operational heartbeat failure does not invalidate a healthy issuance lease.

## 10. Reference mode

```env
PASSMATE_PROCESSOR_MODE=reference
PASSMATE_ALLOW_REFERENCE_COPY=true
```

Never use reference mode for public sales.

## 11. Remaining V4 exit gate

1. real NAS `--check-config`
2. real PM-C2 MASTER manifest verify
3. one paid test order
4. Worker `--once`
5. private Storage artifact hash/size confirmation
6. V5 signed download confirmation
7. lease-loss/reclaim test
8. continuous-mode soak test
