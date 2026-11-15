# Public favicon recovery — 2026-11-15

The daily check found Naver's one restricted URL was `/favicon.ico`, recorded
on October14. A fresh ordinary-browser request and the existing local production
build both returned404 HTML. The repository contained no favicon file or icon
metadata, so this was a missing public asset rather than a NAS data failure.

The user authorized confirmed operations/SEO defects to be repaired and verified
within the existing daily check. Reuse the three paths from `PassmateLogo` in
`components/logo.tsx`, resolving `--blue`, `--logo-ink` and `--cover-line` from
`app/tokens.css`. Preserve their shapes/colors; do not invent a new logo.

`public/favicon.svg` is the maintainable vector source. The existing sharp
dependency and `scripts/generate-favicon.mjs` generate a small ICO containing
16/32/48/64px square PNG frames. `app/favicon.ico` uses Next's file metadata
convention to serve the exact conventional URL and add its link to HTML. No
request rewrite, new dependency, user data or source-corpus change is needed.

The regression first failed against the old production build's404. Verify each
ICO frame decodes with the declared dimensions/alpha, then check actual GET/HEAD
200, image MIME, canonical icon link, existing checks/types and Node22 build.
Verify main/production identity, browser response/body and existing public404,
sitemap, NAS bundle and preparation behavior before reporting release success.
Naver's historical restriction remains pending until its own report updates;
HTTP200 alone is not proof that Naver has cleared the finding.

Deployment and daily evidence: outer `reports/daily-operations/2026-11-15-noon/`.
Rollback is the preceding web deployment `dpl_JBYT1LfBMD5Km38AXDzVBFqkcFXQ`.
