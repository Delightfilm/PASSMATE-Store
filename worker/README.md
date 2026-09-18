# PASSMATE NAS Worker

This directory documents the NAS-side execution contract.

## Security boundary

- NAS is not exposed as a public web server.
- Worker only makes outbound requests to Supabase/storage.
- Worker credentials are server-only and never shipped to the browser.
- Claim payload intentionally excludes customer PII.
- MASTER directory is read-only to the Worker.
- Issued/temp directories are writable.

## Runtime loop

1. Reap expired jobs that exhausted attempts.
2. Claim exactly one job using the atomic claim RPC.
3. Verify local MASTER for `product_code/product_version`.
4. Heartbeat the lease every 60 seconds.
5. Produce the requested artifact.
6. Compute SHA-256.
7. Upload/store output.
8. Complete with storage key/hash/size.
9. On error, report typed failure and let the server decide retry/dead-letter.

## Important rule

If heartbeat/complete reports that the lease is lost, the Worker must abandon that result. Never force-complete a job without the current lease token.

See `docs/NAS_JOB_CONTRACT.md`.
