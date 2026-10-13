# Qualification SEO implementation

User authorized implementation, production reflection and search submissions on 2026-10-13.
Bounded scope: server-rendered public introductions and study guides for the existing CBT routes; ordinary links from the home/hub to electric, forklift and all nine stage grade pages. Keep personal exam routes private and preserve security, storage, grading and store availability.

1. Add a cold-render test for actual route HTML: named heading, historical coverage, working canonical qualification links, grade separation, invalid-slug handling. Run red before implementation.
2. Add `lib/cbt-public-content.ts` for verified coverage and topic copy; `components/cbt-public-content.tsx` for semantic public introduction, guide and navigation. No new duplicate keyword routes.
3. Integrate server content in `app/cbt/page.tsx`, `app/cbt/[certSlug]/page.tsx`; add priority navigation to `components/learning-home.tsx`. Adjust existing public tool headings to avoid duplicate H1. Preserve loading/error/cancel interactions.
4. Run cold-render tests, complete build/contracts, then inspect real desktop/mobile layout and question selection. Review diff for unrelated changes.
5. Create/attach PR, validate checks and production HTML/canonical/robots/sitemap. Submit improved canonical pages in Google and Naver. Record accepted requests separately from actual indexing.

Review focus: initial loading without JavaScript; malformed/missing slug; old electric/forklift coverage; grade-specific stage links; mobile wrapping; private attempt URLs.

Evidence: live content catalog and 11 actual bundles fetched 2026-10-13. Electric 57/3420 (2002–2016), forklift 32/1920 (2004–2011). Each stage grade 19/1915 (2008–2026); subjects: 공연장 안전 및 관련 법규, 무대기술일반, respective stage field. Counts come from catalog, coverage from bundles. No changes to underlying question data.
