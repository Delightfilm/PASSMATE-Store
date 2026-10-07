# Manual question editing and report review

No automatic corpus inspection is scheduled or implemented. Error report intake
stays open. The designated administrator can manually browse NAS qualifications,
sessions and existing published DB questions, including questions without reports.
The editor supports stem/explanation text, 2–10 choices (including five), stem/choice
images and accepted-answer checkboxes. Any one checked alternative counts correct;
this is not an exam requiring multiple selections. A reason is required for edits.
`수정 저장` keeps the report open; `저장 후 검수 완료` edits and resolves it in
one transaction. Standalone `검수 완료` does not modify the question.

Resolved reports leave the open queue but are never deleted. Private
`question_bank_review_events` records report/question references, actor account ID,
timestamp, reason, and before/after content. The workspace shows the latest 100
events; the full database history is retained. Reads use the admin Edge Function,
not a browser table query. Logs are not available to ordinary users.

NAS and legacy UUID references use `question_bank_question_corrections`.
Only editable content is public. No reporter memo or actor
identity is published. NAS source bundles/images/IDs remain read-only and original
Supabase imported rows are retained. The runtime applies fresh corrections after
loading either source, outside the NAS bundle cache, keyed by reference and source
hash. Existing open exams keep their loaded version; a subsequent load reflects
the correction. Historical stored scores are not retroactively recalculated.

The service-only `save_question_bank_edit` RPC asserts the designated admin,
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

Manual audit events have null report references; report-related history is retained.
Version 2 corrections explicitly own media and accepted answers. Legacy sparse edits
retain source images by position and their corrected single answer. Text/media/answer
set changes invalidate AI fingerprints; unchanged single-answer questions retain
exactly the previous fingerprint and previously paid cache reuse. Unsupported AI
choice/answer configurations still refuse safely. No paid AI call is made by editing.

## Edited photos

Vercel `/api/admin/question-images/` requires a designated-admin session. Crop URLs
are allowlisted and checked against source/current/registered images. Uploads accept
PNG/JPEG/WEBP/GIF up to 4 MB and 4 million pixels; SVG is rejected. Sharp re-encodes
oriented static PNGs and strips metadata. Image activity locks saving/switching;
stable keys and abort/unmount guards prevent late writes to another choice.

Dedicated `nas/question-edits` is additive, with no published management port and no
source-bank/AI-cache mount. A narrow server-only token authorizes writes. nginx only
publishes immutable `/admin-images/<sha256>.png` and authenticated asset PUT.
No secrets, original DB, private logs or directory listings are exposed. Crop/replace
creates a new SHA-addressed PNG atomically, never overwriting shared originals.
Unlink removes only a question reference. Upload alone does not change live content
until its correction is saved.

## Release / rollback

Release evidence is recorded in `docs/MANUAL_QUESTION_EDITOR_RELEASE.md`.
Before any version 2 save, prior Vercel/Edge can be restored while keeping additive
tables. After modern saves exist, retain the new correction readers and disable only
the editor/write paths: older four-choice readers may reject modern content.
Preserve corrections/audit/assets and learner data. Never recalculate old scores.

Legacy image-choice repair: original choice images are copied
from the server-loaded source, never from submitted edit URLs. Image-only choices
can retain empty text; invalid/private URLs are rejected. Sparse corrections saved
before recovery retain the newly recovered original images by source position.
Migration `20261004012604_image_choice_review.sql` preserves service-only execute,
admin assertion, version checks and atomic audit events. Live validation and
deployment observations must be reverified in the release evidence; reports are retained.
