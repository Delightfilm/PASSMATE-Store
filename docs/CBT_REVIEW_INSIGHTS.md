# CBT review, private notes and response statistics

Owner request (2026-10-05): make live answer feedback, AI explanations and answer-sheet guidance easier to scan; add personal notes below explanations and collect question response rates including guests.

## Reading and notes

Live feedback uses a white card, a concise answer header, green correct choices and rose selected wrong choices with explicit text labels. AI content separates a main explanation from the four choice reasons. Correct and selected wrong reasons share the same colors as the answer choices. Keep the exact AI inaccuracy notice and existing answer-safety gates, prefetch and loading behavior. The answer-sheet legend uses labeled dots for selected answer, current question, correct and wrong.

Wrong-answer explanations in live feedback, result details and the wrong-note dialog have a private memo editor (2,000 characters, explicit save). Reuse `wrongNotes.memo`, the local browser store and existing account-scoped tables/RLS. Guests retain notes in this browser; logged-in changes use existing account synchronization. This does not publish notes or send them to the AI/statistics backend. Instant grading records personal wrong notes immediately. `reviewedQuestionIds` on each attempt prevents final submission from counting the same personal error twice; retries clear this list. Existing attempts without it retain the prior finalization behavior.

## First-response statistics

- Collect only selected answers: instant grading records the locked answer; submit grading records final answers after submission. Unanswered questions are excluded. Lookup and failed collection never block answering or submitting.
- Same-origin Next endpoint `/api/cbt/question-stats/` validates question identifiers and revisions and fetches trusted source questions with fresh corrections. It computes correctness; browser correctness/answer keys are never accepted. The revision includes effective stem, choices, images, answer and source hash, isolating statistics after corrections.
- A signed HttpOnly, SameSite guest cookie is used for both guests and logged-in browsers. Store a salted visitor hash, question reference/revision and correctness only. No account/email, IP, device fingerprint, memo, raw question text or selected-answer text is stored in the statistics tables.
- One first response per browser/question/revision. Atomic inserts and aggregate updates make retries and concurrent writes idempotent. Bound write batches to 100 and a visitor to 3,000 new samples/day. Clearing cookies or using another browser can create another identity; this is a browser-response count, not a verified unique-person count or a foolproof anti-bot system.
- Display actual correctness percent and `응답 N개 중 M개 오답`. At zero responses show a collection state. Below 20 responses show `아직 표본이 적어요`; at 20+, correctness <=30% is `많이 틀리는 문제`, <=60% is `주의해서 풀어보세요`, otherwise `정답률이 높은 문제`. These are response labels, not a factual measure of confusion. No historical backfill or synthetic production samples are seeded.
- The Edge backend `question-bank-stats` implements custom server-token authentication before reading/writing responses. JWT verification is off because guest requests reach it only through the Next proxy; direct calls without the private token return 401. `PASSMATE_CBT_STATS_TOKEN` is sensitive and server-only in Vercel. Supabase stores only its SHA-256 verifier in a private RLS table. The existing pinned modern-key adapter supplies the admin context; no legacy service-role key is added to Vercel.
- All three statistics tables have RLS and deny anon/authenticated reads/writes; the atomic invoker RPC is callable only by service_role. Public browsers receive only aggregate counts. The security advisor's INFO `RLS Enabled No Policy` is intentional for these server-only tables ([advisor documentation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)). Existing unrelated policies/advisories remain untouched.

## Verification checkpoint

Local full build/type checking and existing contracts passed. New executable checks cover memo preservation, instant-review dedup, thresholds, correction revisions, authoritative grading, stable anonymous identity and cross-origin rejection. A live SQL transaction recorded one wrong first response, retried it as correct, then recorded a second visitor's correct response: totals were 2/1, and rollback left zero test samples. Live grants confirm anon/authenticated cannot read the three new tables; direct unauthenticated Edge calls return 401.

Migration `20261005084944_cbt_question_answer_statistics` and Edge function version 1 are live. Main/frontend production acceptance remains pending until the feature PR is merged and the deployment is READY.
