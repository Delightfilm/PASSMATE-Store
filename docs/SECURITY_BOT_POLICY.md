# Automated-access policy and firewall — updated 2026-10-17

## Scope and verified state

- The user authorized an automated collection/bot access clause and technical protection. `/terms/` now publishes only those clauses, clearly titled “이용약관 — 자동화 접근 및 콘텐츠 수집”, effective 2026-10-12. No unapproved full terms/privacy/refund/copyright text is fabricated. The strict legal check continues to flag the missing full terms and other policies.
- Static policy HTML comes from `content/legal/terms.md`, independently of login, NAS and prices. It contains paragraph/headings/numbered lists only; the dependency-free reader does not claim to implement arbitrary GFM. Future full documents/tables need the separately reviewed renderer described in the earlier legal plan.
- Footer and account/exam header menu link to the actual `/terms/` page. Business values remain in `lib/business-info.ts`. Terms are included in the existing sitemap; Naver verification and the SEO release are preserved.
- Vercel `cueits-projects/passmate-store` was inspected and has Hobby billing. No upgrade, payment setup, new credential, database migration, real payment or learner record mutation was made.
- Versioned desired configuration is `security/vercel-firewall.json`. The actual project configuration was reviewed before every publish. Existing automated DDoS protection was preserved.

## Live Vercel configuration

| Feature | Setting | Limit / boundary |
|---|---|---|
| Bot Protection | Challenge | Non-browser/suspicious automation; provider-verified bots such as Google/Naver are excluded by the managed ruleset |
| AI Bots | Deny | Vercel-recognized AI collectors; not proof that every custom scraper is detected |
| PASSMATE exploit probes | Deny | Requests for `.env`, `.git`, WordPress/PHP scanner targets. Does not match legitimate CBT/admin/login/download/SEO paths |
| PASSMATE CBT API burst | Fixed-window HTTP 429 | `/api/cbt/` only; 600 matching requests per IP per 60-second window; counters are per region. Static assets, login/OAuth callbacks and payment webhook paths are excluded |
| PASSMATE verified SE Ranking audit | Bypass, after both custom protections | All five conditions required: official 29-IP snapshot, exact `SEBot-WA`, host `www.mypassmate.com`, GET/HEAD, and public home/CBT/SEO/static paths, including separately approved `/terms/`, `/privacy/` (with/without trailing slash) and exact `/cbtmate-logo.png`. No nested policy paths or system-mitigation bypass |

No remote device MAC can be obtained from ordinary routed HTTP requests. No MAC collection, device-fingerprint blacklist or permanent/shared-network IP ban was implemented. IPs can change or be shared, so the initial automatic rate limit is temporary and deliberately generous. Known malicious IP/CIDR blocks can be added separately after observing evidence.

## Verification

### SE Ranking false positive — 2026-10-17

- A plain HTTP request to home, robots.txt and sitemap.txt returned HTTP 429 with `x-vercel-mitigated: challenge` and Vercel Security Checkpoint HTML. Vercel's Bot Protection aggregate showed 23 SEBot-WA requests, and SE Ranking's error capture showed the checkpoint. This was a browser challenge, not the `/api/cbt/` request limit.
- The observed `178.63.105.151` matches the [official audit crawler list](https://help.seranking.com/hc/en-us/articles/16335355751196-Verifying-SE-Ranking-Crawler-FAQ); reverse DNS `site-audit-crawler-01.sr-srv.net` resolves forward to that IP. The list is a reviewed snapshot and must be rechecked before future additions.
- The user specifically approved activation. The five-condition rule was published through the actual project UI, ID `rule_passmate_verified_se_ranking_audit_2PK6uC`. Reopening the saved rule confirmed all conditions. Existing exploit/API rules remain first, Bot Protection remains Challenge, AI Bots remains Deny, and no system bypass was added. WAF changes apply independently of app deployment.
- The first manual SE Ranking audit completed its configured 500-page limit: 495 responses in 2xx, five in 4xx, no 5xx, score 82. After separate action-time approval, only `/terms/`, `/privacy/` and `/cbtmate-logo.png` were added and published. The second audit completed 500 pages with score 86 and removed the repeated logo-image 4xx issue. Policy paths initially still failed: the request-path matcher required the normalized forms without a final slash. Changing only those two alternatives to `terms/?$|privacy/?$` made **both** policy single-URL rechecks return 200 with their actual metadata. The remaining excluded library/store/analytics-settings rows retain 429. Overview still displays the pre-recheck five-code aggregate; do not report it as recomputed or claim zero sitewide 429s. Evidence: outer `reports/seo-429-20261017/diagnosis.md`. Admin/API paths remain excluded, and Vercel independently confirmed real matching official crawler traffic including stage qualification paths.
- Google Search Console actual URL tests and Naver URL inspections each passed home, `/cbt/`, electrical, forklift and stage-mechanics level 2. These current fetch tests do not certify every URL's index inclusion. Google sitemap.txt remains successful, 504 discovered pages, last read October 15; discovered count is not indexed count.
- After the final WAF publication, Google's home live test passed again at 04:12 KST. Naver home passed; electrical's literal Korean URL input failed twice, while the same standard percent-encoded URL returned 200, crawl/index permission and the correct title/description without further WAF changes. Use encoded Korean path segments in manual Naver URL inspections; do not classify that checker input difference as a confirmed HTTP 429 or sitewide Naver block.
- The source regression test first failed because the exception was absent, then passed with the exact scoped rule. It exercises allowed paths and negative private/traversal paths, method, hostname, IP and UA mismatches; it is a configuration check, not an emulator of Vercel's mitigation engine.

### Original protection release — 2026-10-12

- A first failing security-policy test confirmed the configuration was missing. The added configuration then passed probe-positive and legitimate-route-negative tests; these are included in `npm run check`.
- `npm run check`, `npx tsc --noEmit`, `npx next build` passed. The policy route is static. Legal warnings remain explicit rather than suppressed.
- Local Chromium/WebKit at 360/390/430/768/1280: five policy captures and navigation round trips per engine; body 16px, auxiliary >=14px, links >=44px, page overflow zero, no customer/API writes.
- Initial WAF log mode was published and observations reviewed. A temporary rate-limit condition targeted only a nonexistent, isolated `/api/cbt/_security_probe/` path at 20 requests/10s. Thirty read requests yielded 20 HTTP 404 and ten HTTP 429; ordinary home still returned 200. The probe condition was then removed and the final 600/60s CBT API condition activated.
- Without operator bypass, Chromium loaded the home and 500-card public catalog. A GPTBot-labelled request returned 403; a browser UA sent from a non-browser client returned 429.
- Automated WebKit encounters the browser checkpoint. The test initially blocked its verification POST; permitting only the genuine same-origin Vercel verification POST still yielded checkpoint failure, so ordinary WebKit/iOS access is not declared verified. UI verification can use the existing, owner-authorized automation credential, sent only to the exact project origin and never stored or printed. This does not prove public Safari access. Real-device Safari remains a follow-up.
- Source diff excludes auth/payment/download/CBT grading/persistence APIs and Supabase schemas. Store remains paused.

## NAS boundary — not deployed

The browser retrieves the catalog directly from `https://content.mypassmate.com/catalog.json` through the existing Cloudflare Tunnel. Main-site Vercel WAF does not govern that origin. An existing local SSH key could not authenticate for the observed NAS target; no password guessing, SSH/account changes, NAS nginx/tunnel replacement or container restart was performed.

Origin-specific protection remains required: obtain confirmed operator access, back up the exact active nginx configuration, identify and trust only the actual tunnel proxy for client IP extraction, then separately rate-limit public JSON and images to avoid penalizing ordinary exams. Validate with `nginx -t`, test CORS/normal catalog+bundle+images and 429 recovery, reload only the affected service, and retain a configuration rollback. Do not enable an HTML browser challenge blindly on cross-origin JSON fetches. A stronger origin-secret/proxy design is separate work; CORS/robots.txt/user-agent strings alone are not access control.

## Rollback

Code and WAF are independent. Reverting a configuration commit does **not** revert Vercel WAF. To roll back the October 17 exception, disable only `PASSMATE verified SE Ranking audit`, review and publish; preserve the two earlier rules, Bot Protection=Challenge, AI Bots=Deny and system DDoS protection. For other suspected false positives, inspect the specific owned rule before proposing a separate change. No DB rollback or learner-data deletion is needed.

Detailed release/capture evidence: outer workspace `reports/bot-security-20261012/RESULT.md`.

Sources: [Vercel Bot Management](https://vercel.com/docs/bot-management), [WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting), [Authorized automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation), [RFC 826](https://www.rfc-editor.org/info/rfc826/).
