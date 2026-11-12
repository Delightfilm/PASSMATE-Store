# Operations recovery — 2026-11-12

## Observed NAS failure and recovery

The public question-bank origin was stopped while the existing Cloudflare tunnel and AI cache remained running. Its restart policy was disabled. Logs showed graceful SIGQUIT and worker shutdown; the initiator of that stop remains unknown. Only `passmate-question-bank` was started.

The initial 502 became nginx 403. Local origin health returned 200. The protected public-static configuration trusted the tunnel's former peer `172.19.0.3`, but Docker DNS showed the current tunnel at `172.19.0.4` and origin itself at `.3`. After backing up the existing configuration, exactly the trusted real-IP peer and `/32` gate were updated to `.4`. `nginx -t` and reload succeeded. No subnet trust, authentication removal, release replacement or unrelated service restart was performed.

Public health/catalog, the catalog-selected `jo` bundle and an image returned 200. The bundle's compressed SHA-256 matched its catalog entry, with 3,420 questions and 57 exams. A browser loaded actual year/round selection. Catalog totals remained 738 source qualifications, 15,940 exams and 1,018,976 usable questions; release `2026-10-04-image-choices`, revision `official-presentation-v2-20261005`.

**Limitation:** automatic restart is confirmed disabled, not merely unverified. The project-managed NAS interface offers no applicable policy edit and existing SSH authentication was refused. Do not report that this policy is fixed. Tunnel recreation can change its exact peer again; revalidate that peer rather than trusting the entire network. Backups/host reboot behavior were not tested.

## Soft 404

Search Console reported 56 affected pages (report updated November 9; sample crawls November 9–11), including real archives such as 전기산업기사. Historical crawled HTML was unavailable. After the data recovery, Google's live test of 전기산업기사 at 16:15 KST reported that the URL can be indexed. This supports recovery of that sample; it does not prove all 56 issues cleared or establish the outage as the sole historical cause.

A separate reproducible route defect returned a successful client shell for nonexistent qualifications. The page now returns a real 404 for unknown/malformed values. Known source aliases redirect to their canonical qualification. Saved `/exam/[attemptId]` pages remain independent. Real affected qualifications retain their server-rendered title and archive counts, even without NAS access during rendering. Intentional private/store noindex remains unchanged.

## Security patches

- Next.js 15.5.24 → 15.5.29 and sharp 0.35.4 → 0.35.5: [official Next.js advisory](https://nextjs.org/blog/nextjs-security-update-october-14-2026).
- Compatible transitive undici, zod and source-map-js updates; Next 15's pinned PostCSS is overridden to same-major 8.5.32. Upstream [PostCSS advisory](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp) fixes the residual source-map issue at 8.5.23.
- Lockfile audit before patch: 1 critical, 5 high entries. After patch: zero reported vulnerabilities in full and production audits. This is an advisory-database check, not proof of absence of all vulnerabilities or of historical exploitation.

## Verification and release boundary

The invalid-route regression failed before the implementation and passed after it. Full `npm run check`, TypeScript and Node 22.23.5 production build passed. Local production delivery checked 59 bot/private metadata responses; real HTTP checks verified invalid route 404, valid archive 200 and known alias 308. An independent final review found no Important/Critical issue and verified current public catalog membership against the committed snapshot.

These code checks precede production deployment. Final deployment identity, live HTTP/browser results, Google validation status and unchanged daily 12:00 Asia/Seoul schedule are recorded in the operator workspace's `reports/operations-recovery-20261112/RESULT.md`; do not infer production success from this document's local checks alone.
