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
