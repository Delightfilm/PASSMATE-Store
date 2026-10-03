# On-demand AI explanations

Status (2026-10-03): implementation and isolated tests complete; NAS/Vercel deployment and live paid text/vision/cache verification still required. Do not describe the live feature as enabled before these pass.

## User flow

- Wrong-answer feedback, result details and the wrong-note explanation dialog offer `해설보기` when no registered explanation exists.
- Wrong answer selection, page load and opening the dialog never call the AI automatically.
- The first explicit click generates one shared explanation for all four choices. Later users/selected choices read the same NAS entry.
- Existing registered/admin-reviewed explanations always take precedence.
- New generation requires Supabase login; cached results do not. No account details, chosen answer or user notes are sent to the model.
- AI text is labeled unreviewed; the displayed answer is always the registered answer, not model text. The existing question error-report action remains available.

## Model and answer safety

Selected from the live Vercel catalog on 2026-10-03: `alibaba/qwen3.7-flash`, image input and structured output. Price at <=32K input: USD 0.03/M input, 0.13/M output ([official model page](https://vercel.com/ai-gateway/models/qwen3.7-flash)). Higher input tiers can cost more; do not promise fixed per-image cost.

No expensive model fallback; SDK retries disabled. One draft call (up to 1,600 output tokens), then one separate verifier call (up to 250). Verifier is also the same inexpensive model. That is **two model calls per accepted new explanation**, not two cache generations. This is a risk reduction, not proof of correctness or independent expert review.

The server fetches the source question and fresh sparse admin correction. Browser-submitted question/answer/image URLs are never trusted. The answer is fixed in the output schema and runtime validator; explicit alternative-answer claims are rejected; negative question wording is accounted for. The verifier must approve factual support, image readability and no answer contradiction. Refused/failed results are also persisted, with no automatic billable retry.

Allowlisted image paths only: HTTPS `content.mypassmate.com/images/<prefix>/<sha256>.<format>` and the verified legacy `https://img.comcbt.com/cbt/data/<code>/<exam>/<file>.<format>` source. No redirects/query/credentials/private-IP fetch. Maximum four images, 2 MB source each, 4M pixels each. GIF first-frame diagrams become native-resolution PNG. Animated/malformed/oversized/unavailable images are refused before billing. Complex/unclear images still need human review. No access restrictions are bypassed; failures are saved for operator review.

## Persistent NAS cache and deduplication

NAS path: `/volume2/PASSMATE/question-bank/ai-explanations/data/explanations.sqlite3` (separate from immutable source releases).

Cache key = SHA-256 of version, model, question ID, qualification, original source hash, **effective** stem/choices/answer/images/registered explanation. No selected answer/user ID. Admin edits change the key, so outdated text is not reused.

SQLite WAL + `BEGIN IMMEDIATE` gives an atomic, durable claim before the paid request. Completion uses a lease compare-and-set. Process crashes, API timeouts or lost responses do not release/reclaim a paid job. Entries still generating after 180 seconds return `failed` pending operator investigation; the original owner can still finish if it returns late. Browser polling is read-only. Only an operator, after examining Gateway logs and backing up the NAS cache, may decide to retry an ambiguous job. There is intentionally no public reset/delete endpoint.

NAS stores summary, four reasons, state, timestamps, token usage and a token-salted account hash for quotas. No large explanation bodies go into Supabase. Default limits: 200 new jobs/day overall, 500/month, 30/day/account, four active jobs. Refused/failed jobs count toward limits because they may have been billed. Cache hits bypass limits. Limits are request counts, **not a guaranteed dollar ceiling**. Keep AI Gateway auto-top-up disabled; free-credit exhaustion should fail safely. Purchase/auto-top-up changes need the owner's explicit approval.

## Deployment checklist

1. Back up the existing nginx config. Do not change COMCBT, master data, source release files, tunnel token, or NAS administrator exposure.
2. Upload `nas/ai-explanations/server.py` and compose into the separate `ai-explanations` directory. Create `data` writable only by container UID 1000/GID 10. Never use chmod 777.
3. Generate a 32-byte random cache token. Save it only in the NAS private compose/env and Vercel **server-only** `PASSMATE_AI_CACHE_TOKEN`, never `NEXT_PUBLIC_*`, Git or the public release. This creates limited service-to-service write access and needs action-time approval if configured through UI.
4. Start `passmate-ai-cache` on the existing `passmate-question-bank` Docker network. No published ports, root filesystem read-only, no capabilities, no source-data mount.
5. Add the location in `nas/ai-explanations/nginx-location.conf` inside the existing nginx server block. Preserve all public content routes. Check `nginx -t` then reload nginx only.
6. Vercel: `PASSMATE_AI_CACHE_URL=https://content.mypassmate.com/ai-cache` and the matching sensitive token. AI Gateway uses Vercel OIDC; no browser/provider secret needed. Verify available credits and auto-top-up is off. Never accept new billing/terms or create broad credentials silently.
7. Push one grouped change, test preview, then production. Verify unauthorized private cache requests get 401 and content/catalog/images still work.
8. Authenticated live test: one text question and one diagram question -> ready -> repeat read yields identical stored result and no additional model trace. Exercise two simultaneous first requests. Inspect durable NAS state and Gateway token usage; check wrong-answer UI on desktop/mobile. Do not seed fake explanations into production.

## Tests

`npm run build` runs existing regression contracts plus `scripts/validate-ai-explanations.mjs` (mocked model/route, no API spend). `npm run check:ai-nas` uses temporary SQLite and a localhost HTTP server: concurrency, restart persistence, quotas, leases, stale claims, authentication and traversal denial. Production code must not contain a test/model bypass.

Rollback: remove the two Vercel cache env vars to stop generation safely; revert the site commit if needed. Leave the NAS SQLite/complete explanations intact. Removing the nginx AI-only location and stopping only `passmate-ai-cache` does not affect public questions or existing crawler processes.
