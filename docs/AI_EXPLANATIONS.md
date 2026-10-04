# On-demand AI explanations

## Bounded answer-grounded repair — 2026-10-05

- Owner requested a revision when answer/evidence verification refuses an explanation. Drafts still use the immutable registered answer. The blind verifier now returns concrete factual/consistency feedback. On rejection, the writer can revise once using that feedback, then a fresh blind check must approve and independently support the registered answer. Unsupported drafts and local format/contradiction failures can also use this single revision. Unreadable images stop immediately.
- At most two drafts and two verifier calls per job, within a shared 105-second generation deadline. Provider/transport failures retain `maxRetries: 0`; failure is persisted and does not start a paid retry loop. All completed calls contribute to stored usage, including refused drafts.
- Successful existing cache entries retain their keys and verification requirements. A previously stored refusal without `answer-repair-v1` can be upgraded only after an explicit click. Its new job key is SHA-256 of `<original fingerprint>:answer-repair-v1`; the original paid refusal remains intact. Atomic NAS claims, existing quotas, and persistence bound this upgrade to one job shared across callers. Reads/polls do not generate; repeated clicks reuse the upgrade result, including refusal/failure.
- The UI distinguishes old eligible refusals (`해설 보완 생성`) from a final refusal after revision. Error reporting remains the fallback when the revised explanation still lacks valid evidence. This does not certify every registered answer or force a false explanation to pass.
- Mock checks cover successful revision, persistent contradiction/alternative answers, unreadable images, malformed drafts, complete usage, blind recheck without the answer key, provider failure without retry, concurrent upgrade claims, and read-only/repeated-click no billing. Full local build and repository checks passed. Live verification is pending.

## Claim transport recovery — 2026-10-04

The production rolling-master exam request at 21:11 KST committed its NAS claim
but lost the HTTP response at the previous 12-second timeout, before any AI call.
The orphaned claim then blocked all subsequent attempts as an expired generation.
NAS now accepts a caller-generated lease, returns the same claim for an identical
transport retry, and accepts an identical completion idempotently. Independent
requests cannot obtain another job's lease. Cache transport and correction reads
have one bounded retry; paid draft/verifier calls still have `maxRetries: 0`.

Only a confirmed failure before the model call may carry stored `retryable: true`.
The newer repair route may expose this flag on an old refusal when a separate,
bounded upgrade job is still missing; it never marks the paid refusal itself retryable.
Read-only requests never reclaim it; an explicit click can reclaim that same row.
Paid/unknown failures and old expired jobs remain blocked. The identified
`caj20180331` question 1 claim was backed up and marked retryable using its exact
key, timestamp, state and null payload; unrelated cache records were preserved.
Local full build, route/model transport regression checks and seven NAS SQLite/
HTTP tests passed. PR #22 merged as `205e7bc`; production deployment `dpl_GYPRyH3JgcXte1LQj9b4RhxNx8ac` was READY. The original claim recovered and reached a semantic refusal rather than the timeout. Information-processing engineer 2022 second exam question 6 generated a ready ERD explanation and read it back unchanged from NAS. This confirms the transport repair, not that the refused rolling question had valid AI evidence.

Status (2026-10-04, Asia/Seoul): production deployment confirmed. PR #19 merged as `9704f5c`; Vercel `passmate-store-80ztd9lxv` is Production READY and serves `mypassmate.com` and `www.mypassmate.com`. The live wrong-answer screen showed the exact inaccuracy notice and the identical NAS-stored question 2 explanation. No mandatory human approval is imposed. Fresh image questions 37 and 42 were refused by the automated check; their paid claims remain stored and no retry was made. These are verified safe refusals, not successful image explanations. Release retains the guard and does not promise that every image question can receive an explanation.

## Live verification checkpoint (2026-10-04)

- Production UI -> `/api/cbt/explanations/` -> private NAS cache -> stored explanation rendering passed without a logged-in account or another model generation. Application build succeeded; sampled production error logs returned no error rows. The independent Supabase Preview check reported remote migration versions missing locally; no migration repair or production DB mutation was attempted in this rollout. This is an integration-history issue to investigate separately, not evidence that every CI check passed.
- Logged-in Preview, information-processing engineer 2022 second exam: text question 1 generated an answer-locked explanation and reused identical NAS content as `저장된 해설`. The generation made draft/verifier calls; repeating the read added no Gateway request.
- NAS SQLite `quick_check` returned `ok`; three ready entries were present (the owner also exercised two questions). No user-created explanations were deleted.
- Image question 22 (`6dfe85175f11f060cb44`, binary search for 14) failed. Two near-simultaneous UI requests shared a single persisted failed state, with no automatic regeneration. This is not a successful vision/concurrency acceptance test.
- The Gateway log view initially had a fixed end time. After reloading it, the first two failed image jobs each showed a successful draft model call (263 and approximately 1.1K output tokens), with no verifier call. These jobs may be billed even though nothing was displayed; keep their failed claims. The earlier absence of visible logs was not evidence of no call or no charge.
- Use current SDK `file`/`data` image parts with base64 PNG data; route diagnostics log only stage, allowlisted error class, HTTP status, and exact known validation reason codes. Never log raw errors/provider payloads, question content, account IDs, tokens, or credentials. Encoding tests pass, but a transport change alone is not established as the cause of the earlier failures.
- Image question 10 (`c80f0df42d3c54818ac0`, scope/interface question) generated once across two simultaneous first clicks: one UI showed new and the other stored explanation. Gateway recorded exactly two new draft/verifier calls (772 combined input, 261 output). However its summary supported Constraint while the registered answer was Interface, and the verifier incorrectly approved it. This is a failed factual QA gate, not a production-ready result.
- The new verifier receives neither the answer key nor draft correctAnswer. It separately returns its solved answer and the answer actually supported by the explanation. Both must match the registered answer and approved must be true; alternatives remain internal and only cause refusal. This reduces risk, not a guarantee that a cheap model cannot hallucinate.
- Cache keys are unchanged. Prior ready entries without `answer-blind-v2` verification metadata return a safety refusal, with no text exposure, deletion, overwrite or automatic model call. This also withholds the earlier good text samples; no mandatory human approval is imposed on new explanations that pass the automated check.
- Fresh question 2 (MOM): NAS status `ready`, `answer-blind-v2`, registered/solved/explanation answer all zero-index 0, 1,382 input and 372 output tokens. UI showed both new and stored identical explanation. Fresh image questions 37 (tree traversal) and 42 (transaction property) persisted `refused` with no ready text exposure, no failed exception and no automatic retry. This is bounded live verification, not a general factual-accuracy certification or a positive vision acceptance test.
- Owner reports paid credit purchased; text requests succeeded. Gateway still displayed an incomplete billing-address notice. Do not fill personal billing details or enable automatic top-up on the owner's behalf.

## Verified deployment checkpoint

- NAS `passmate-ai-cache` runs as UID 1000/GID 10, with no published ports and no source-release mount. Its persistent SQLite `quick_check` returned `ok`.
- `https://content.mypassmate.com/ai-cache/health` returned 200. A private `/v1/<key>` request without authorization returned 401; the matching private token returned 200 with `status: missing` without creating a job.
- The original nginx configuration is preserved at `question-bank/default.conf.pre-ai.template` and `PASSMATE/04_BACKUP/default.conf.template`. `default.conf.with-ai.template` contains the verified complete public configuration plus the private proxy location.
- The candidate passed `nginx -t` inside the existing nginx container before activation. Only `passmate-question-bank` was restarted to remount the replaced config; the tunnel, source releases and COMCBT were not changed.
- The public catalog returned 200 before and after the change with identical SHA-256 `c6e3439930511704593398183b3363b63ae14e58e13ec9b0508b618dd747e1a1`. The `wc` bundle and one referenced image both returned 200; the image bytes matched its SHA-256 filename.
- Vercel project `cueits-projects/passmate-store` has `PASSMATE_AI_CACHE_TOKEN` stored as a sensitive server-only secret and matching `PASSMATE_AI_CACHE_URL`. Preview scope is limited to the AI branch; environment changes apply to new deployments only.
- AI Gateway onboarding showed paid credit `$0.00`, free-credit onboarding not completed, and `Auto-reload is disabled`. No credit purchase, card verification, provider key creation, or billable model request was made. The owner must resolve Gateway credit availability before live generation tests. No fake explanations were seeded.

## User flow

- Owner decision (2026-10-04): no mandatory human approval before serving a newly generated explanation that passes the automated answer-safety checks. Display exactly `AI가 생성한 해설로, 부정확한 내용이 포함될 수 있습니다.` for both new and stored AI explanations. Keep error reporting, the immutable registered answer, blind consistency checks, durable caching and no automatic paid retries. The notice accepts residual AI inaccuracy; it does not disable those guards or guarantee factual correctness.
- Wrong-answer feedback, result details and the wrong-note explanation dialog offer `해설보기` when no registered explanation exists.
- Wrong answer selection, page load and opening the dialog never call the AI automatically.
- The first explicit click generates one shared explanation for all four choices. Later users/selected choices read the same NAS entry.
- Existing registered/admin-reviewed explanations always take precedence.
- Owner decision (2026-10-04): allow new generation without login. After 10 successfully created new explanations in the same browser profile, show a non-blocking signup invitation; do not force authentication at the threshold. Cache reads, polls and refused/failed results do not count. This browser-local invitation counter survives reloads and is shared across tabs, but clearing site data, private mode or a different browser can reset it; it is not hardware identification or an abuse-prevention quota. No account details, chosen answer or user notes are sent to the model.
- Guest claims use a signed, HttpOnly, SameSite browser cookie and a separately salted quota identity, while authenticated claims keep server-validated Supabase identity. The existing NAS/global/day/month/concurrency limits remain unchanged. Cookie deletion can reset the guest daily identity, so the durable global limits remain the spending safeguard. Require same-origin JSON requests to avoid cross-site browser generation. No NAS schema or source-content change is required.
- AI text uses the owner's exact inaccuracy notice, not a mandatory administrator-review label; the displayed answer is always the registered answer, not model text. The existing question error-report action remains available.

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

Guest rollout verification (2026-10-04): mocked route tests exercised anonymous signed-cookie identity, cookie reuse/tamper denial, verified bearer identity, JSON/same-origin restrictions, global quota refusal, cache hits without identity/billing, and concurrent claims. Browser-local counter tests covered fresh-success-only counting, duplicate exclusion, reload persistence and the 9/10 boundary. A temporary localhost-only UI harness confirmed no invitation at 9, invitation at 10, persistence after reload, working signup links back to the current route, and continued explanation rendering without signup. All harness responses were mock-only (no paid calls, NAS writes or fake production entries); the harness was removed before Git push. Full regression build passed before this harness was added. Live guest generation must be checked separately after deployment.

Rollback: remove the two Vercel cache env vars to stop generation safely; revert the site commit if needed. Leave the NAS SQLite/complete explanations intact. Removing the nginx AI-only location and stopping only `passmate-ai-cache` does not affect public questions or existing crawler processes.
