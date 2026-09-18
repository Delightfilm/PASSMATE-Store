# PASSMATE NAS Worker

Reference implementation of the PASSMATE outbound NAS Worker.

## What is implemented

- Supabase RPC client using server-only service-role credentials
- atomic queue claim contract
- lease/heartbeat ownership
- typed retry/non-retry failure reporting
- stale completion rejection handling
- SHA-256 output verification
- reference copy processor guarded by an explicit safety flag
- Docker / docker-compose scaffold
- Python unit tests and GitHub Actions CI

## What is intentionally not production yet

The current processor does **not** apply final customer PDF transformation, watermarking, or temporary cloud-download upload.

`PASSMATE_ALLOW_REFERENCE_COPY` defaults to `false` so a MASTER PDF cannot accidentally be distributed unchanged.

## Run modes

Config preflight:

```bash
python -m passmate_worker.main --check-config
```

One queue item:

```bash
python -m passmate_worker.main --once
```

Continuous:

```bash
python -m passmate_worker.main
```

## Security boundary

- NAS exposes no public Worker port.
- Worker makes outbound calls only.
- MASTER mount is read-only.
- service-role key is server-only.
- queue payload excludes customer PII.
- lost lease means the Worker must abandon the result.

See:

- `docs/NAS_JOB_CONTRACT.md`
- `worker/DEPLOY.md`
