# CBT topic cards refinement — 2026-10-13

User requested natural qualification cards and less visually intrusive SEO copy. Preserve the existing white/blue palette, 12px card radius and qualification navigation.

Changes: two individual skill cards with real archived exam counts; three stage field cards with grade-specific links. Remove repeated visible `기출문제·CBT` suffixes and redundant overview sentences. Shorten qualification H1 to its real name. Keep archived coverage visible; move introductions, subject scope and study guidance into native, initially closed `details`/`summary` that users can open. No search-only hidden keyword blocks.

Preserved: all 11 canonical qualification links on home and hub, metadata/canonicals/robots/sitemap, question loading, grading, personal learning records, store availability and security controls.

Verification plan: existing cold-render test updated to check concise H1, closed accessible guidance, grade link labels and preservation of all canonical links. Run full build/contracts and one batched desktop/mobile/browser pass including keyboard disclosure and actual grade navigation. Production status and screenshots belong in outer `output/seo-cards-20261013/RESULT.md` after release.

Local browser results: 11 links retained; 360/390/430px DOM checks showed no horizontal overflow and links at least 44px high. At 390px mobile CSS was confirmed active. Keyboard Enter opened the guidance, Space closed it; the real stage audio 3rd-grade route loaded the correct archived exams. One layout correction removed the nested home container so topic cards align with existing quick cards. The mechanical design detector found four existing correct/incorrect-answer accent styles outside the changed area; no new topic-card finding. Desktop/mobile screenshots are stored in the outer output directory. Browser emulation is not real-device validation.

Rollback: revert this refinement commit/PR and redeploy the previous main revision. No data migration or state rollback is required.
