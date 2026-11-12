# SEO / GEO public-learning pilot — 2026-11-12

## Approved brief

The user approved the proposed SEO/GEO strategy and requested execution. Goal: qualified Korean search traffic → actual practice → review and return visits. Scope is a bounded extension of existing public qualification content: three learning guides and nine original worked examples for 전기기능사, 지게차운전기능사, 무대음향3급, linked to existing practice. Existing compact qualification pages and collapsed study guidance remain intact. No paid AI generation, account/learning data mutation, purchase, fake review, invented exam count or copied third-party question.

## Implementation and verification

1. Capture the authenticated Search Console baseline (28-day performance plus known Soft404 validation). Tool integration is unconnected; browser access is a separate source. Unknown metrics remain unknown, never zero.
2. Add three server-rendered `/cbt/[certSlug]/guide/` pages, backed by explicit authored content. Unsupported guide paths return404. Each has unique metadata/canonical, real practice navigation, archive scope and honest reference/review information. Register exactly these guides in the existing XML/TXT sitemap source and link from the three qualification pages. Preserve private/store noindex and saved exam routes.
3. Explain self-contained original conceptual examples with explicit assumptions, derivation, common mistakes and references. Do not label them official past exam questions or claim a human/external expert reviewed them. Check numerical examples and units independently; record source limits. Do not offer equipment operation or live electrical work instructions.
4. Separate AI training crawlers from AI search/assistant traffic using the provider's category feature if supported; retain bot challenge, exploit denial, auth gates, API rate limits and DDoS. Prefer category control over a broad custom bypass. Validate the exact draft and rollback before publishing to the same PASSMATE project.
5. Regression tests first, full contract check/type/build, desktop/mobile browser and network verification, final independent review, one code rollout. READY alone is insufficient. Keep the daily12:00 Asia/Seoul monitor and Soft404 completion follow-up active; add the three guide pages to appropriate checks.

## Measurement and limits

Reuse the October13–15 Korean keyword research as dated estimates rather than buy it again within30days. Current click/impression data determines the baseline. Measure Google/Naver indexing separately; fixed AI prompts are experiments, not guaranteed citations. Do not promise ranking or traffic gains. Track the three guides/qualification families over30/60/90days using existing privacy/consent boundaries. The user has authorized the implementation, not publication of messages to third-party communities.

## Recovery record update

The final operator report `reports/operations-recovery-20261112/RESULT.md` supersedes the earlier predeployment limitations: security/404 patch deployed at main91ed4e7, NAS origin automatic restart enabled, Google Soft404 validation started November12 for56 URLs. Fresh results, not this historical note, determine present health.

## Rollback

Code: retain production dpl_GSRRLS7nimWCugg4obi33CnP2H1D (91ed4e7). Firewall: preserve active version6 before any change, stage only category differences, do not overwrite another operator's draft. Restore prior category policy on a verified false-positive or access expansion.

## Ledger

- [x] Reused isolated clean worktree on new branch codex/seo-geo-pilot-20261112 from current main91ed4e7.
- [x] Reused dated OpenSEO reports without new keyword spend. Tool Search Console connection remains unavailable; authenticated browser is available.
- [x] Search performance baseline: Google web2026-10-14–11-10, 17clicks/808impressions/CTR2.1%/position17.7. Authenticated rendered tables54query/44page/28day rows. Google generative-AI report75impressions for same period, a distinct metric, not ChatGPT citations. Soft40456 still Started.
- [x] Verified original examples against linked OpenStax/Analog Devices primary materials. Nine results recomputed independently; source assumptions/limits and original authorship explicit, no official-question/external-expert claim.
- [x] RED → GREEN guide/page/sitemap/robots/analytics regression. Three valid guides200, unknown guide404, exactly507unique XML entries and three new guides, explicit search/training robots rules, consent-gated sanitized analytics.
- [x] Published category-only firewall change after tool-required human approval. Active version6→7; AI assistants allowed, training crawlers denied, bot challenge retained. SHA256 of full existing custom-rule list before/after identical:2f50b765c99b0801ff3517ef181e107480af63f2916e4755a3c3c131335f4df1. All three existing rules including verified SE Ranking audit exception preserved, no new bypass.
- [x] Full contract check, TypeScript, Node22.23.5 build, local SEO59responses and nine numerical/unit checks passed. Final independent review found no Important/Critical issue. Scoped text selection and44px breadcrumb targets incorporated after minor review.
- [x] Actual Edge layout checks on all3guides at360/390/430/1280width settings: no horizontal overflow; observed main navigation targets44px; example count3 per guide. Viewport override reset. Screenshots and metrics in operator reports/seo-geo-pilot-20261112.
- [ ] Production deployment/live identity and scheduled performance follow-up; final outcome recorded in operator report, not inferred from build or policy configuration alone.
