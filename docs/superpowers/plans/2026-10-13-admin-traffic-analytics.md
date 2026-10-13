# PASSMATE Admin Traffic Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 GA4의 유입·참여·종목·학습 이용 집계를 PASSMATE 안에서 조회하도록 구현한다.

**Architecture:** 공개 페이지의 동의 기반 수집기를 기존 Next.js 앱에 연결한다. 관리자 전용 Supabase Edge Function이 GA4 Data API를 읽고 서버 전용 집계 캐시를 사용한다. 관리자 메뉴는 독립 패널을 필요할 때만 로드하며 연결 전·실제 0·지연·오류를 구분한다.

**Tech Stack:** Next.js 15.5.24, React 19.1.0, TypeScript, Supabase Edge Functions/Postgres, GA4 gtag.js/Data API, Web Crypto, 기존 Node 테스트 방식. 새 분석·차트·테스트 프레임워크를 도입하지 않는다.

**Spec:** `docs/superpowers/specs/2026-10-13-admin-traffic-analytics-design.md` (사용자 승인, 설계 커밋 `44fb243`). 작업 위치는 `passmate-seo-qualification-pages`, 브랜치는 `codex/admin-traffic-analytics`.

## Global Constraints

- 기본 기간은 최근 30일, 선택은 7일·30일·90일 및 직접 지정이다.
- 날짜와 집계 기준은 GA4 속성의 시간대에 맞추고 화면에 표시한다. 연결 설정의 운영 기준은 `Asia/Seoul`이다.
- 일반 보고서는 최대 15분, 실시간은 최대 60초 캐시한다. 실시간 자동 갱신은 60초보다 짧게 하지 않는다.
- 비필수 분석은 방문자의 동의 전에는 GA4 스크립트를 로드하거나 요청하지 않는 방식으로 설계한다.
- 이름, 이메일, 회원 식별자, `user_id`, IP, 계정 토큰, 메모, 문항 본문, 선택 답안, 원점수, 개별 시험 시도 ID, 자유 입력값을 분석 이벤트에 넣지 않는다.
- 관리자·인증 콜백·개인정보 화면·API 등 비공개 경로에서는 측정하지 않는다.
- 광고 기능, Google Signals, 광고 개인화는 기본 비활성화다. 운영 화면에 가짜 방문자·전환 수치를 채우지 않는다.
- 기존 결제·스토어·NAS·AI 해설·문항 통계 수집 계약도 변경하지 않는다. 기존 미추적 방문 기록을 복원했다고 주장하지 않는다.
- 개별 페이지 방문자 수를 합산하지 않는다. 이벤트 횟수를 순서가 검증된 퍼널이나 가입 전환율로 표현하지 않는다.
- 새 Google 접근 권한·약관·지속 자격 증명 생성은 실제 연결 단계의 확인 대상이다. 유료 서비스 가입·광고 구매는 하지 않는다.

## Review Focus

1. 태그가 로드되는 중 거절하거나 비공개 화면으로 이동하면 늦게 도착한 로드 콜백도 수집을 시작하지 않아야 한다. → Task 2의 경합 테스트.
2. 깨진 URL 인코딩·민감한 쿼리·리퍼러·시도 ID가 있어도 원문을 전송하거나 화면을 깨뜨리지 않아야 한다. → Task 1의 정제 테스트.
3. 두 탭·재제출·결과 재방문은 새 풀이 완료로 집계하지 않고, 저장 실패도 성공 이벤트를 보내지 않아야 한다. → Task 3의 학습 전환 테스트.
4. 기간·필터가 바뀌는 동안 이전 조회가 늦게 끝나도 새 화면에 과거 조건의 숫자를 덮어쓰지 않아야 한다. → Task 5의 요청 경쟁 테스트.
5. API 권한 오류·미등록 커스텀 정의·보고서 임계값·불완전한 당일은 정상 0과 구분하고 최신 데이터처럼 표시하지 않아야 한다. → Task 4/5의 보고서 상태 테스트.

## 파일 구조와 인터페이스

| 파일 | 역할 |
| --- | --- |
| `lib/analytics-policy.mjs`, `.d.mts` | 공개 경로·이벤트·UTM/리퍼러 정제, 동의 값, 안전한 페이지명 |
| `lib/analytics-collector.mjs`, `.d.mts` | 주입 가능한 태그 로더와 동의·경로·중복 전송 제어 |
| `lib/analytics.ts` | 앱이 쓰는 수집기 인스턴스와 학습 이벤트 연결 함수 |
| `components/analytics-provider.tsx`, `analytics-consent.tsx` | Next 경로 연결, 선택 UI와 설정 변경 |
| `supabase/functions/_shared/analytics-contract.mjs`, `.d.mts` | 서버 요청 검증·공유 응답 계약·캐시 키 |
| `supabase/functions/_shared/analytics-google.mjs`, `.d.mts` | 읽기 인증, GA4 보고서 구성·정규화 |
| `supabase/functions/_shared/analytics-handler.mjs`, `.d.mts` | 관리자 요청·캐시·오류 처리, 의존성 주입 |
| `supabase/functions/admin-analytics/index.ts` | 기존 사용자 JWT/관리자 검증과 서버 환경·DB 연결 |
| `supabase/migrations/20261013090000_admin_analytics_cache.sql` | 서버 전용 집계 캐시만 추가 |
| `components/admin-analytics.tsx`, `lib/admin-analytics-view.mjs`, `.d.mts` | 관리자 패널과 표·차트·CSV·표시용 계산 |
| `app/analytics.css` | 방문 분석/동의 UI 전용 스타일 |
| `scripts/test-analytics-policy.mjs`, `test-analytics-collector.mjs`, `test-analytics-learning.mjs`, `test-analytics-server.mjs`, `test-admin-analytics.mjs` | 실제 동작을 검증하는 Node 테스트 |
| `docs/ANALYTICS.md`, `docs/ANALYTICS_PRIVACY_DRAFT.md` | 연결·운영·측정 범위·초안·되돌리기 |

수집·서버·표시 모듈의 `.mjs`는 기존 프로젝트의 순수 모듈 방식에 맞춰 Node와 Deno에서 검증하고, `.d.mts`로 앱의 타입 검사를 유지한다. 관리자 UI에 데이터 수집이나 Google 인증 코드를 넣지 않는다.

**공유 계약** (`analytics-contract.d.mts`에 선언, `.mjs`에서 검증):

- `ReportKind = 'overview' | 'acquisition' | 'pages' | 'qualifications' | 'environment' | 'realtime'`.
- `AnalyticsRequest = { report: ReportKind; startDate?: string; endDate?: string; sourceMedium?: string; qualificationSlug?: string; device?: 'desktop'|'mobile'|'tablet'; groupBy?: 'channel'|'source'|'campaign'|'landing'|'page'|'country'|'city'|'device'|'browser' }`.
- `AnalyticsRow = { dimensions: Record<string,string>; metrics: Record<string,number> }`. 서버의 고정 지표 목록만 사용한다.
- `ReportData = { rows: AnalyticsRow[]; totals: Record<string,number>; previousTotals?: Record<string,number> }`.
- 지표 키는 `totalUsers`, `sessions`, `screenPageViews`, `userEngagementDuration`, `qualification_view`, `exam_start`, `exam_complete`, `sign_up`만 사용한다. 차원 키는 아래 보고서 표의 GA4 차원명을 유지한다. 여러 이벤트 보고서는 같은 차원 키로 병합하되, 수집 미지원 이벤트를 숫자 0으로 만들지 않는다.
- 이벤트 파라미터는 `qualification_slug`, `qualification_field`, `qualification_grade`, `learning_method`, `question_count_bucket`와 가입의 `method`만 허용한다. 공개 카탈로그에서 확인된 값만 사용한다. 문항 수 구간은 `1-20`, `21-40`, `41-60`, `61-plus`이고 0문항은 시작 이벤트가 아니다.
- `AnalyticsServerConfig = { propertyId:string; serviceAccount:{client_email:string;private_key:string}; timezone:string; measurementStartedAt:string|null; customDimensionsReady:boolean; signupSupported:boolean }`. 기능이 꺼져 있거나 필수 연결 정보가 없으면 설정 조회는 null을 반환한다.
- `AnalyticsResponse = { status: 'ok'|'notConfigured'|'noData'|'stale'|'error'; report: ReportKind; data: ReportData|null; meta: { fetchedAt: string|null; timezone: string; measurementStartedAt: string|null; thresholded: boolean; dataLossFromOtherRow: boolean; customDimensionsReady: boolean; signupSupported: boolean; partialToday: boolean; rowLimit: number; unfilteredRealtime: boolean }; errorCode?: 'permission'|'quota'|'network'|'configuration'|'incompatible' }`.
- HTTP 400/401/403/405는 입력·인증 오류다. 관리자의 유효한 요청에서 미연결·외부 API 오류는 위 응답 타입으로 반환한다. Google 원본 응답·인증 정보는 반환하지 않는다.

## Task 1: 안전한 수집·보고서 계약

**Files:** Create `lib/analytics-policy.mjs`, `.d.mts`; `supabase/functions/_shared/analytics-contract.mjs`, `.d.mts`; `scripts/test-analytics-policy.mjs`.

**Interfaces:** `sanitizePage(rawUrl: string, publicQualifications: {slug:string;title:string}[]): {location:string;title:string;qualificationSlug?:string}|null`; `sanitizeReferrer(raw: string): string`; `sanitizeCampaign(rawUrl: string): Record<string,string>`; `sanitizeEvent(name: string, params: unknown): {name:string;params:Record<string,string>}|null`; `validateAnalyticsRequest(input: unknown, now: Date, timezone: string): AnalyticsRequest`; `makeCacheKey(propertyId: string, request: AnalyticsRequest): string`.

- [ ] Write `policy_private_paths_and_malformed_urls`, `policy_attempt_ids_and_secrets`, `event_unknown_and_pii_fields`, `request_bounds_and_property_injection` tests. Assert `/admin/`, `/account/oauth-callback/`, `/api/`, bookmarks/history/wrong-notes return null; broken percent encoding never throws; known exam paths normalize to `/cbt/<encoded slug>/exam/` without attempt ID. Unknown qualification paths return null.

```js
assert.equal(sanitizePage('https://www.mypassmate.com/admin/?token=secret', catalog), null);
assert.equal(sanitizePage(`https://www.mypassmate.com/cbt/${encodeURIComponent('전기기능사')}/exam/attempt-secret/?email=test@example.com`, catalog).location, `https://www.mypassmate.com/cbt/${encodeURIComponent('전기기능사')}/exam/`);
assert.equal(sanitizeEvent('exam_start', { qualification_slug:'전기기능사', email:'test@example.com' }), null);
```
- [ ] Run `node --test scripts/test-analytics-policy.mjs`; expect failure before implementation.
- [ ] Implement only `/`, `/cbt/`, catalog-known qualification and normalized exam paths. Drop query/hash; allow `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` only as bounded campaign tokens (1–100 Unicode letters/digits/`_-.`, reject email/URL/free text and phone-like digit strings); external referrer reduces to HTTP(S) origin, internal referrer becomes empty. Event params allow only public catalog slug, fixed method, field/grade and count buckets; reject extra keys rather than spreading input. Server dates must be real `YYYY-MM-DD`, ordered, not future, at most 90 calendar days; source max 100, slug max 200 with Korean/letters/digits/hyphen only; reject arbitrary property/metrics/dimensions. Realtime rejects date/filter fields.
- [ ] Re-run test; expect all assertions pass. Ensure encoded/unencoded identical paths yield one canonical location and equivalent requests yield the same cache key.
- [ ] Commit only Task 1 files: `test/feat: define safe analytics contracts`.

## Task 2: 방문자 선택과 공개 페이지 측정

**Files:** Create `lib/analytics-collector.mjs`, `.d.mts`, `lib/analytics.ts`, `components/analytics-provider.tsx`, `components/analytics-consent.tsx`, `app/analytics.css`, `scripts/test-analytics-collector.mjs`; modify `app/layout.tsx`, `components/site-footer.tsx`, `.env.example`, `package.json`.

**Interfaces:** `createAnalyticsCollector(deps: {loadTag:()=>Promise<void>; send:(command:unknown[])=>void; setDisabled:(value:boolean)=>void; storage:Storage|null}, options: {enabled:boolean;measurementId:string;publicQualifications:{slug:string;title:string}[]}): {setConsent(value:'granted'|'denied'):void; visit(rawUrl:string, referrer:string):void; track(name:string,params:unknown,dedupeKey?:string):boolean; dispose():void}`; app exports `setAnalyticsConsent(value)` and `trackAnalyticsEvent(name,params,dedupeKey?)`.

- [ ] Write `consent_no_tag_before_grant`, `revoke_during_tag_load`, `private_route_during_tag_load`, `strict_mode_pageview_once`, `blocked_storage_no_product_failure`. Use deferred fake loader: grant → visit public → revoke/private → resolve loader; assert zero emitted events. Denied/disabled states assert zero script loads.

```js
collector.setConsent('denied'); collector.visit('https://www.mypassmate.com/', '');
assert.equal(loads.length, 0); assert.equal(events.length, 0);
collector.setConsent('granted'); collector.setConsent('denied'); resolveTag();
await Promise.resolve(); await Promise.resolve(); assert.equal(events.length, 0);
```
- [ ] Run `node --test scripts/test-analytics-collector.mjs`; expect failure before implementation.
- [ ] Implement one collector per document. `NEXT_PUBLIC_ANALYTICS_ENABLED` defaults false; measurement ID must match `G-[A-Z0-9]+`. `NEXT_PUBLIC_ANALYTICS_NOTICE_READY` also defaults false. Both and a valid ID are required to offer collection. Persist choice as versioned `passmate.analytics.consent.v1` only; failure to save never breaks CBT. Render equal allow/deny controls and footer “분석 설정” with keyboard focus restoration. Reject means no tag load, no retrospective replay. Consent change invalidates pending async work and clears event queue.
- [ ] Connect `usePathname` inside existing Suspense boundary and sanitized public catalog metadata. Before initialization set safe `page_location`, `page_title`, `page_referrer`, disable ads personalization/signals, `send_page_view:false`; send manual pageview on committed public navigation. Set `window['ga-disable-'+id]` on denied/private states, clear stale queued commands, prevent automatic/private-route transmission. Disable GA enhanced history/page/scroll/outbound/form measurements in the property at activation. If a real SPA transition still sends private-page requests, use full-document navigation at that boundary before activation instead of accepting leakage.
- [ ] Re-run tests and `npm run check:browser-storage`; expect pass. Inspect consent UI at mobile/desktop, Escape/click-close/focus restore; private route rejection must apply even after the tag was previously loaded. Add `check:analytics` to the existing `check` chain and document only public env names in `.env.example`.
- [ ] Commit Task 2 files: `feat: add consent based public analytics`.

## Task 3: 실제 문제풀이 이벤트

**Files:** Modify `lib/analytics.ts`, `components/question-bank-client.tsx`; create `scripts/test-analytics-learning.mjs`. Signup UI remains unchanged unless a deterministic new-account success signal is found.

**Interfaces:** app adds `recordLearningTransition(input: {kind:'start'|'complete';qualificationSlug:string;method:'past'|'mock'|'custom'|'retry';count:number;localAttemptKey:string;persisted:boolean;alreadySubmitted?:boolean}): boolean`. `localAttemptKey` is for in-browser deduplication only and never enters GA params. Qualification-view uses Task 2's `trackAnalyticsEvent` and public catalog slug.

- [ ] Write `learning_no_event_on_failed_save`, `learning_completed_retry_and_revisit`, `learning_private_to_public_start`, `learning_never_sends_answers_or_attempt_id`. Assert no send when save fails or already submitted; a successful new completion sends once; result revisit sends none; retry gets its own start; private-screen retry waits for public exam render. Pass sample answers/memo/id and assert none appear in transmitted params.

```js
assert.equal(recordLearningTransition({kind:'start',qualificationSlug:'전기기능사',method:'past',count:60,localAttemptKey:'private-id',persisted:false}), false);
assert.equal(recordLearningTransition({kind:'complete',qualificationSlug:'전기기능사',method:'past',count:60,localAttemptKey:'private-id',persisted:true,alreadySubmitted:true}), false);
assert.equal(JSON.stringify(events).includes('private-id'), false);
```
- [ ] Run `node --test scripts/test-analytics-learning.mjs`; expect failure before implementation.
- [ ] Connect start after successful `saveStore` in `begin` (current lines 190–196), successful retry creation (current line 300 and lines 437–449), and completion after successful submit/store (current lines 247–282). Defer send until matching public exam/result is visible. Track completed only for newly transitioned submission, never result hydration. Do not refactor scoring or modify saved learner schema; keep local bounded dedup state isolated from learner storage and catch analytics failures. Views fire only when qualification content is actually available.
- [ ] Audit email/OAuth success contract: current OAuth callback only proves a session, not new signup; email signup can return non-new-user responses. Initially expose `signupSupported:false` and “가입 성공 측정 미지원” unless tests can prove a deterministic new-account success branch; never infer from login/created-at proximity. If supported, emit only `sign_up` with fixed method on a sanitized public page, without retaining/sending account ID. State supported methods in `docs/ANALYTICS.md`.
- [ ] Re-run learning/collector tests and `npm run check:question-bank`; expect pass. Browser exercise guest and member start/finish, failed persistence and result revisit; analytics failure must not block them.
- [ ] Commit Task 3 files: `feat: measure verified learning transitions`.

## Task 4: 관리자 전용 GA4 집계 API

**Files:** Create Google/handler shared modules and declarations, `supabase/functions/admin-analytics/index.ts`, cache migration, `scripts/test-analytics-server.mjs`; modify `docs/ADMIN_CONSOLE.md`.

**Interfaces:** `createGoogleAnalyticsClient(config:{propertyId:string;serviceAccount:{client_email:string;private_key:string};fetch:typeof fetch;now:()=>Date}): {runReport(body:unknown):Promise<unknown>;runRealtimeReport(body:unknown):Promise<unknown>;getMetadata():Promise<unknown>;checkCompatibility(body:unknown):Promise<unknown>}`; `buildReportRequests(request:AnalyticsRequest): {kind:'standard'|'realtime';body:unknown}[]`; `normalizeReports(request:AnalyticsRequest, replies:unknown[], meta:AnalyticsResponse['meta']):ReportData`; `createAdminAnalyticsHandler(deps:{resolveAdmin:(req:Request)=>Promise<401|403|true>;getConfig:()=>AnalyticsServerConfig|null;fetchReport:(request:AnalyticsRequest)=>Promise<AnalyticsResponse>;readCache:(key:string)=>Promise<AnalyticsResponse|null>;writeCache:(key:string,value:AnalyticsResponse,ttlSeconds:number)=>Promise<void>;now:()=>Date}):(req:Request)=>Promise<Response>`.

- [ ] Write `handler_non_admin_never_calls_google`, `server_input_and_cache_isolation`, `server_expired_cache_quota_and_zero`, `google_oauth_scope_and_secret_redaction`, `report_missing_dimension_and_threshold`. Assert missing/regular-user auth returns 401/403 before reads; different period/filter keys isolate; standard TTL is 900 seconds, realtime 60; upstream errors use stale cache only with original fetched time, otherwise error; successful 0 stays ok, empty-before-measurement is noData; metadata flags survive; secrets/raw bodies never appear in response/logs.

```js
assert.equal((await nonAdminHandler(new Request('https://example.test/', {method:'POST',body:JSON.stringify({report:'overview'})}))).status, 403);
assert.equal(googleCalls.length, 0); assert.equal(cacheReads.length, 0);
assert.deepEqual(cacheWrites.map(x => x.ttlSeconds), [900, 60]);
```
- [ ] Run `node --test scripts/test-analytics-server.mjs`; expect failure before implementation.
- [ ] Implement same `createSupabaseContext(req,{auth:'user'})` plus profiles.role check as `admin-data`; accept POST/OPTIONS only. Read secrets from Edge Function settings: `PASSMATE_ANALYTICS_REPORTS_ENABLED`, `GA4_PROPERTY_ID`, `GA4_SERVICE_ACCOUNT_JSON`, `GA4_PROPERTY_TIMEZONE`, `GA4_MEASUREMENT_STARTED_AT`, `GA4_CUSTOM_DIMENSIONS_READY`, `GA4_SIGNUP_SUPPORTED`. Default reports disabled and signup false. OAuth signs RS256 via Web Crypto and requests only `https://www.googleapis.com/auth/analytics.readonly`; cache access token until expiry minus 60 seconds. Use server-configured property only; 10-second fetch timeout, no infinite retries, API concurrency at most 2.
- [ ] Implement report mapping below; use GA metadata/checkCompatibility before enabling each report, cache metadata 24 hours. Limit group tables to 100 sorted rows and display truncation; fetch totals independently, never derive totals from top rows. If incompatible, report that panel unsupported/configuration error. Missing custom definitions disables only qualification/event-detail reports, leaving standard traffic reports usable.

| Report | Dimensions / metrics and handling |
| --- | --- |
| overview | `date` with sessions/views/users/engagement plus independent eventName/eventCount report merged by date. Fetch whole-period user totals separately, and prior equal-length period totals. |
| acquisition | `sessionDefaultChannelGroup` or `sessionSourceMedium` or `sessionCampaignName`; sessions/views/engagement and independent start-event counts. Same session filters in both queries. |
| pages | `landingPage` for landing group, `pagePath` for page group. Label metrics and their denominators separately; no sum of users across pages. |
| qualifications | `customEvent:qualification_slug` and eventName with eventCount for three verified learning events; label counts, not ordered funnel/conversion rate. Public page sessions may be shown separately using known canonical paths. |
| environment | One requested group at a time: country, city, deviceCategory, browser. Avoid country×city×device Cartesian aggregation. |
| realtime | runRealtimeReport, no dimensions, metric `activeUsers`, minutesAgo 29..0, no date/source/qualification/device filter. |

- [ ] Implement `public.admin_analytics_report_cache(cache_key text primary key,payload jsonb not null,fetched_at timestamptz not null,expires_at timestamptz not null)` with expiry index, RLS enabled, no anon/authenticated privileges or policies, service_role only. Store aggregate responses only; combine same-key in-flight queries within the worker; never cache auth tokens. Remove generated cache rows expired more than 24 hours during maintenance on authenticated report requests; no learner tables touched. Client HTTP cache is `private,no-store`.
- [ ] Re-run server tests, `npm run check:admin`, TypeScript build validation, and local Supabase function smoke tests with mocked provider; expect no leakage/auth bypass. Verify cache grants/RLS using a local DB or read-only migration contract check if local runtime unavailable, recording that limit rather than claiming deployed SQL proof.
- [ ] Commit Task 4 files: `feat: serve restricted GA4 admin reports`.

## Task 5: 방문 분석 패널

**Files:** Create `components/admin-analytics.tsx`, `lib/admin-analytics-view.mjs`, `.d.mts`, `scripts/test-admin-analytics.mjs`; modify `components/admin-client.tsx`, `app/analytics.css`.

**Interfaces:** `AdminAnalytics({accessToken}:{accessToken:string})`; `derivePeriod(days:7|30|90,today:string):{startDate:string;endDate:string}`; `formatEngagement(seconds:number,sessions:number):string`; `buildAnalyticsCsv(response:AnalyticsResponse):string`; `createReportLoader(fetchReport:(request:AnalyticsRequest,signal:AbortSignal)=>Promise<AnalyticsResponse>):{load(request:AnalyticsRequest,onValue:(response:AnalyticsResponse)=>void):Promise<void>;dispose():void}`.

- [ ] Write `view_period_boundary_and_denominator`, `view_late_response_does_not_replace_new_filter`, `view_no_data_not_zero_or_fake`, `csv_formula_and_quotes`. Assert inclusive 7/30/90-day dates across month/leap boundaries, zero-session time renders “—”, totals remain independent of row sums; outdated request never overwrites newer selection; error/noData states are distinct; cells beginning `=`, `+`, `-`, `@` or control whitespace cannot execute spreadsheet formulas.

```js
assert.deepEqual(derivePeriod(7,'2026-03-01'), {startDate:'2026-02-23',endDate:'2026-03-01'});
assert.equal(formatEngagement(180,2), '1분 30초'); assert.equal(formatEngagement(0,0), '—');
assert.equal(delivered.at(-1).meta.fetchedAt, newestFixture.meta.fetchedAt);
```
- [ ] Run `node --test scripts/test-admin-analytics.mjs`; expect failure before implementation.
- [ ] Add MenuKey `analytics`, title/nav “방문 분석” to existing admin menu; use dynamic import and access token prop only when selected. Keep existing business overview and loadAll requests unchanged. Fetch `admin-analytics` using existing Supabase URL/publishable key conventions, same admin session. Cancel obsolete request and ignore obsolete response; abort on menu unmount.
- [ ] Implement overview/trend, source/campaign tables, landing/page/qualification views, country/city/device/browser views, recent-30-min card. Default 30 days; allow only 7/30/90 or <=90-day custom date range. Source filters derive from actual response rows; qualification choices from `publicQualifications`; support only validated report/group/filter combinations. Realtime has independent unfiltered label and >=60s polling, paused when document hidden. Show property timezone, fetchedAt, partial today, measurementStartedAt, custom dimension readiness, signup support, threshold/truncation notices. Render counts/engagement definitions next to labels, no presumed conversion percentage.
- [ ] Draw simple SVG trend and accompanying accessible table with existing CSS tokens; do not add chart library. On narrow screens stack cards and keep details readable. Offer CSV of currently displayed aggregate rows with safe cells. Link official Search Console/Search Advisor and existing operational instructions without hardcoded private account IDs. Test tables/empty states through the existing TypeScript-transpile/render approach; browser verify interactions, keyboard and screen widths.
- [ ] Verify comparison copy: previous-period 0 makes relative percentage “—”, not Infinity or an invented 100%; when today's partial data is included, show its limitation beside the comparison. Use the property timezone returned by the API for date boundaries, not the browser's UTC day.
- [ ] Re-run analytics tests plus `npm run check:admin`; expect pass. Run `npm run build`; fix actual failures without modifying unrelated validations.
- [ ] Commit Task 5 files: `feat: add admin visitor analytics dashboard`.

## Task 6: 연결·실측·배포

**Files:** Create `docs/ANALYTICS.md`, `docs/ANALYTICS_PRIVACY_DRAFT.md`; modify `docs/STATUS.md`; evidence in `output/analytics-20261013/`. No full privacy policy is invented or silently published.

**Interfaces:** Task 2 consumes public env values; Task 4 consumes Edge secrets; Task 5 renders real report states. External setup must match these names and flags.

- [ ] Write connection checklist: inspect existing GA account/property first; choose property and Asia/Seoul timezone, verify real retention setting, turn off ads/signals/enhanced measurement, register event-scope `qualification_slug`, `learning_method`, `qualification_field`, `qualification_grade`, `question_count_bucket`. Set feature capability flags only after verification; custom dimensions take time to appear and are not retroactive.
- [ ] Open actual Google setup with browser tools; handle new account permissions/terms/credential creation with action-time confirmation. Grant the read service account Viewer on that property only; enable Analytics Data API in the selected project if required. Never place the key in repo, client or command output; save via protected provider secret configuration. If access is unavailable, finish disabled deployment/connection state and explicitly mark operational measurement incomplete.
- [ ] Draft visitor notice using only verified provider/settings/purpose/selection details; confirm missing operator/legal details instead of inventing them. Align actual published notice before `NEXT_PUBLIC_ANALYTICS_NOTICE_READY=true`. Record measurement start when collection is actually enabled. For preview/testing use separate test property or GA debug/internal filter; do not contaminate production statistics with stress tests.
- [ ] Run full analytics tests, `npm run check`, `npm run build`; record pass/fail and commit identity. Apply cache migration/Edge Function before enabling report flag. Use existing verified deployment workflow; create and attach PR, deploy reviewed changes and validate the actual domain/commit, preserving unrelated files and running processes.
- [ ] Browser verify no Google requests before consent, on decline, after withdrawal, and on private/admin/callback routes including navigation after a previously loaded tag. Check actual transmitted sanitized URL/referrer/event fields, manual pageview count, guest/member start/complete, no replay on old results. Confirm actual GA DebugView/Realtime events and later reconcile standard reports against admin for identical period/filters; report-data delay cannot be marked success or zero.
- [ ] Verify unauthenticated/regular-user denial against deployed function, admin access, actual cache expiry/grants, CSV/filters/mobile/keyboard. Capture only aggregate screenshots without tokens/member data. Recheck homepage/CBT/private pages for regressions.
- [ ] Record rollout and rollback report: applied commit/deployment/GA property without secret, actual proof, incomplete external steps, disable client/report flags first, revert feature commits, revoke Viewer/credential separately, note collected GA data is not erased by code rollback. Finish with operating guidance for comparing search sessions and learning starts; avoid repeated SEO submissions.
- [ ] Commit docs/evidence metadata: `docs: record analytics setup validation and rollback`.

## 계획 자체 검토와 실행 대기

Scope coverage: consent/privacy and public routing → 1/2; actual learning/signup limits → 3; auth/report dimensions/cache/errors → 4; all screen states/filters/CSV/mobile → 5; Google access/notice/deployment/live proof/rollback → 6. The five Review Focus conditions have assigned behavioral tests. Types and response names are shared once; no sequential funnel or inferred signup is promised. Tests reuse Node and the existing render technique, not a new framework.

This plan is written for review. No feature code, GA property, credential, migration or deployment has been applied. After plan approval choose direct implementation in this chat or task-by-task subagent implementation/review; execute with the corresponding required skill.

Reference: [GA4 manual pageviews](https://developers.google.com/analytics/devguides/collection/ga4/views), [Data API schema](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema), [Realtime API](https://developers.google.com/analytics/devguides/reporting/data/v1/realtime-basics).
