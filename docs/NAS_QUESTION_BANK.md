# NAS question-bank runtime

The public content origin is `https://content.mypassmate.com`. Vercel sets
`NEXT_PUBLIC_QUESTION_BANK_CONTENT_URL` for Production and Preview. This is a
public URL, not a credential. Changing it requires a new build.

The current `release-2026-10-02` catalog contains 727 qualifications, 15,767
exams, 979,863 playable questions, and 136,044 images. 21,068 incomplete source
questions are excluded; they are not counted as playable questions.

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

## Download progress (local implementation, not deployed)

`question-bank-download.ts` counts decoded bytes from `response.body.getReader()`.
The UI uses the current file's progress, not artificial weights for the three
stages: catalog → qualification bundle → fresh corrections. Corrections remain
uncached and their lookup has no byte-based percentage or ETA.

An optional catalog entry field `uncompressedBytes` is the UTF-8 byte length of
the exact JSON before gzip, tied to the same release/hash as that bundle. This
field is supported by the client but has **not** been added to NAS data. Existing
`compressedBytes` is deliberately not used as a denominator: Fetch decodes gzip
and Brotli before yielding stream chunks. With no trustworthy size, the client
shows received capacity and stage only, with no percentage/ETA.

Fallback to Content-Length is allowed only for an uncompressed response. When
Content-Encoding is CORS-hidden, missing does not mean uncompressed; the client
uses capacity-only display. For a CORS response, explicit exposed `identity`
encoding can safely enable the uncompressed Content-Length fallback.

Header audit on 2026-10-03, GET with Origin `https://www.mypassmate.com`:

| Header | catalog.json | bundles/wc.json.gz |
|---|---|---|
| Content-Length | absent | 96030 (compressed) |
| Content-Encoding | br | gzip |
| Access-Control-Expose-Headers | absent | absent |
| Access-Control-Allow-Origin | * | * |
| Cache-Control | no-cache, max-age=0, must-revalidate | same |

NAS/proxy proposals only; no server settings or data files were changed:

- Add `qualifications[].uncompressedBytes` when publishing bundles, using
  `len(json_bytes)` **before** gzip of those same bytes. Do not re-serialize JSON
  differently for this measurement. Continue to retain `compressedBytes`.
- Expose `Content-Encoding, Content-Length, ETag` via
  `Access-Control-Expose-Headers` on catalog/bundle responses, including error
  responses. Content-Length is already a CORS-safelisted response header, while
  Content-Encoding is not. Exposing headers alone does not make compressed
  Content-Length usable for decoded progress.
- Preserve existing Cache-Control in this change. For the compressed catalog,
  capacity-only progress remains appropriate; do not disable compression merely
  to create a percentage. A same-origin proxy with verified uncompressed length
  is another future option, not part of this implementation.

UI details: wait 300ms before showing the loader; announce at roughly 5-second
intervals; after 15 seconds offer cancel/retry. The transfer meter uses a rolling
5-second rate and EMA (0.25), gated by 1 second of data and 5% received. Stale ETA
is hidden after 5 seconds without new data. There is no simulated bar animation.

Cache behavior is preserved: catalog TTL 60 seconds; four-bundle LRU by content
base/release/SHA; completed cache hits emit no transfer progress. In-flight
requests are shared with per-caller AbortSignal subscriptions; the last caller
leaving aborts the actual request. Cancelled/failed entries can be retried, and
an older failed request cannot clear a newer cache entry. HTTP failure UI and
the existing single transport retry remain in place.

Validation: `npm run check:question-bank` now includes deterministic stream,
size/ETA, abort, freshness, and cache tests. Slow browser fixtures and viewport
results are documented separately in the local verification report. No exam
answering, grading, saving or submission handlers were changed.
