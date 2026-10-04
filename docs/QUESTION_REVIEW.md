# Reported question editing

The admin question-bank workspace supports editing a reported question's stem,
four choices, correct answer and explanation. A reason is required for edits.
`수정 저장` keeps the report open; `저장 후 검수 완료` edits and resolves it in
one transaction. Standalone `검수 완료` does not modify the question.

Resolved reports leave the open queue but are never deleted. Private
`question_bank_review_events` records report/question references, actor account ID,
timestamp, reason, and before/after content. The workspace shows the latest 100
events; the full database history is retained. Reads use the admin Edge Function,
not a browser table query. Logs are not available to ordinary users.

NAS and legacy UUID references use sparse `question_bank_question_corrections`.
Only edited text/choices/answer/explanation are public. No reporter memo or actor
identity is published. NAS source bundles/images/IDs remain read-only and original
Supabase imported rows are retained. The runtime applies fresh corrections after
loading either source, outside the NAS bundle cache, keyed by reference and source
hash. Existing open exams keep their loaded version; a subsequent load reflects
the correction. Historical stored scores are not retroactively recalculated.

The service-only `review_question_bank_report` RPC asserts the designated admin,
locks the report and question, checks the expected correction version, and writes
correction/resolution plus audit events atomically. Missing/stale/resolved reports
cannot silently overwrite another edit. Repeated resolution is idempotent.

The Edge Function obtains original content itself (fixed NAS origin and catalog
allowlist, or legacy source row). New reports include qualification code.
For older NAS reports it uses the reporter's synced attempt; if unavailable the
admin selects a qualification and the server verifies actual question membership.
It never accepts client-supplied source content or fetches arbitrary URLs.

Validation: `npm run check:question-bank`, `npx tsc --noEmit`, `npm run build`,
and rollback-only live SQL checks for audit writes, answer validation, conflict,
idempotent completion, designated admin and anonymous access rejection.

Rollback: keep the additive tables/reports/history, revert UI/runtime/Edge together.
Reverting the runtime hides corrections but does not destroy their history.

Image-choice repair (prepared, not deployed): original choice images are copied
from the server-loaded source, never from submitted edit URLs. Image-only choices
can retain empty text; invalid/private URLs are rejected. Sparse corrections saved
before recovery retain the newly recovered original images by source position.
Migration `20261004012604_image_choice_review.sql` preserves service-only execute,
admin assertion, version checks and atomic audit events. Live validation and
deployment remain pending database connectivity; existing reports are untouched.
