# NAS question-bank runtime

Qualification cards use the presentation-only grouping contract in
[QUESTION_BANK_GROUPING.md](QUESTION_BANK_GROUPING.md). Original source IDs and
bundles are retained; this does not rename the NAS corpus or migrate user state.

The public content origin is `https://content.mypassmate.com`. Vercel sets
`NEXT_PUBLIC_QUESTION_BANK_CONTENT_URL` for Production and Preview. This is a
public URL, not a credential. Changing it requires a new build.

The current `release-2026-10-02` catalog contains 727 qualifications, 15,767
exams, 979,863 playable questions, and 136,044 images. 21,068 questions are
excluded from that release. This is not proof of missing source questions:
the 2026-10-04 investigation found omitted choice images and text-only filtering
that compacted choice positions. Recovery is underway; the public release is
unchanged until full data QA and verified NAS activation finish.

The browser requests the catalog first, then only the selected qualification's
gzip bundle. It uses a bounded four-bundle in-memory cache keyed by release and
SHA, retries failed loads, validates release/counts, and loads images directly
from the content origin. Saved bookmarks and wrong notes retain their
qualification code so learning pages can hydrate the required bundles.

Question bodies and images are never imported into Supabase. Existing attempts
continue to use `question_bank_attempts`. The additive
`question_bank_user_question_state` table stores only owner-scoped bookmarks and
wrong notes keyed by the stable NAS question reference. RLS denies anonymous
and cross-user access. Existing UUID-based records and import tools remain intact.
The existing issue queue accepts either its legacy UUID or a NAS question reference.

The NAS publishes only catalog, bundle, image, health, and excluded-report routes
through Cloudflare Tunnel. NAS administration, credentials, source DB, and Docker
configuration are not published. NAS files are publicly downloadable, as approved
by the owner; hiding an URL or CORS does not make content private.

Validation: `npm run check:question-bank`, `npx tsc --noEmit`, and `npm run build`.
The NAS adapter check covers catalog-first loading, counts, image paths, lazy
loading, cache reuse, saved references, failed-load retry, and release mismatch.
The production RLS smoke test uses a rollback transaction and leaves no QA records.

Rollback: unset the public content URL and redeploy to use the original published
Supabase dataset. The additive state table and existing records should be retained.
No crawler, source master DB, or COMCBT process needs to change.

Reported-question corrections are sparse public patches in Supabase, not a corpus
import. The source NAS bundles remain immutable. Private audit events and report
memos are never included in public patches. See [QUESTION_REVIEW.md](QUESTION_REVIEW.md).

## Loading presentation — spinner and rotating guidance

The dataset flow stays catalog → selected qualification bundles → fresh
corrections. Catalog TTL is 60 seconds; the four-bundle LRU remains keyed by
content base/release/SHA. Corrections are read fresh outside those caches.

The loader shows a decorative 44px CSS spinner after 300ms, alongside guidance
that changes every 5 seconds, measured from first appearance. The interval is
defined once by LOADING_MESSAGE_INTERVAL_MS. Within the last 350ms of each
interval the current message fades out; at the boundary it is replaced in the
same text element and the next message fades in over 350ms. Messages never
overlap, and the spinner element/animation stays mounted across text changes.
There is no auxiliary guidance line. The message area reserves 48px: the longest
notice and a truncated long-name message each measured two 24px lines at a
360px viewport (294px text width). It displays no percentage,
received capacity or ETA. At 15 seconds the guidance becomes a fixed long-wait
notice and shows cancel/retry. All loader timers are disposed on unmount.
Reduced-motion disables the spinner animation and text fade; text changes
immediately at the same 5-second boundaries. The first three of the seven
messages appear before the fixed notice; the remaining four stay in the list.
Cancel/retry starts a new loader from the first message after its 300ms delay.

Display names come from the signed-in user's profiles.display_name, then the
explicit display_name/nickname/name/full_name metadata fields. Missing names
use 수험자. Email/phone fields and email prefixes are never used; email-like or
phone-like name values are rejected. Names are truncated at 10 graphemes and
rendered as escaped React text. The value is frozen when the loader first
appears; a late auth/profile response cannot change the visible first phrase.

The visual rotating messages are aria-hidden. The status region uses polite
announcements and aria-busy, with only the initial message and the 15-second
notice in its screen-reader text. Cancel/retry remain accessible outside that
live region. Text uses existing typography/colour tokens and reserved height.

qualifications[].uncompressedBytes remains supported as an optional catalog
field, but is not used by the current screen. Existing SHA/count/release/image
validation is retained; streaming UTF-8 reading and AbortSignal reader
cancellation remain. Presentation-only byte counting, Content-Length size
estimation, percentage/rolling-rate/EMA/ETA calculation and progress listeners
were removed.

In-flight requests still coalesce with per-caller AbortSignal subscriptions.
Cancelling one subscriber leaves other subscribers running; the last subscriber
leaving aborts the actual request. Cancelled/failed entries can be retried, and
an older failed request cannot clear a newer cache entry. HTTP failure UI and
the existing single transport retry stay in place.

Validation: npm run check:question-bank includes deterministic name/privacy,
message schedule/announcements/timer disposal, UTF-8, abort, shared cancellation,
fresh corrections and cache tests. Browser checks cover slow transfer/cancel/
retry, motion preference, cache hit, responsive layout and the exam flow.
No answering, grading, saving or submission handlers or NAS/proxy/CDN settings
are modified by this presentation change.

## Image-choice recovery — 2026-10-04 (not activated)

Choices now support optional `images: string[]` alongside text. Preserve every
source choice position: never filter empty text if an image represents the choice,
and never shift the registered answer. Missing assets or genuinely empty choices
remain explicit exclusions. Browser mapping validates every relative image path.
Practice, results and administrator review share an image renderer with an
accessible load-failure notice. OMR renders the actual choice count (including
five-choice source questions). The existing four-choice admin-edit/AI safety
contracts are not broadened by this repair.

The isolated CBTBANK repair uses saved HTML, not another page crawl. A verified
SQLite backup precedes additive positional references; question IDs, answers,
source hashes, canonical associations and original text remain unchanged.
Only newly discovered missing images are downloaded, with existing robots and
adaptive 3-to-7 rps safeguards. COMCBT is untouched.

Local checkpoint: `PASSMATE_CBTBANK_ALL_EXAMS/06_RECOVERY/2026-10-04-image-choices`.
`resume_image_choice_recovery.ps1` runs reparse → missing-image download → fresh
administrator export → new NAS release packaging → independent QA. It holds an
OS lock; never duplicate a live repair. Completed pages are checkpointed in
`image_choice_repair_pages`. A normal `status.json` is a stage snapshot, not a
live progress counter. Read `recovery-progress.log` and the checkpoint table.

The new release is `05_NAS_RELEASES/2026-10-04-image-choices`; neither this folder
nor a successful local QA automatically publishes files to NAS. Gate activation
on `QA.json`, hashes/counts, original HTML comparison, verified upload, administrator
RPC/Edge validation and preview E2E. Keep the old NAS release available for rollback.
Do not overwrite the master with its backup while any repair process is alive.

Validation so far: seven website suites, 25 crawler tests and production build
pass. Three real incident questions were independently compared to saved HTML;
all ten choice images loaded, registered positions ③/①/④ remained unchanged,
and a 360px local screen had no horizontal overflow or console errors. Temporary
QA routes were removed. This is sample validation, not completion of the full
corpus. Live administrator database preflight currently times out; no remote
migration, Edge update, NAS activation or production deployment has been made.
