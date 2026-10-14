# First-party Traffic Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자동 팝업·하단 배너 없이 식별자 없는 자체 방문 집계를 제공하고, 기존 동의자의 GA4 분석을 별도 출처로 유지한다.

**Architecture:** 브라우저의 메모리 수집기가 제한된 주변 합계를 같은 출처의 Next.js API에 전송한다. API가 공개 카탈로그·계약을 검증한 후 전용 서버 토큰으로 Supabase에 전달하며, DB는 중복 반영 없이 일별 합계만 저장한다. 관리자 JWT/role 조회 API와 기존 관리자 UI가 자체 집계와 GA4를 분리해 표시한다.

**Tech Stack:** Node 22.x, Next.js 15.5.24, React 19.1.0, TypeScript, 순수 `.mjs` + `.d.mts`, 기존 Supabase JS 2.116.0/Edge Functions/Postgres, pg_cron, Node test runner. 새 분석 SDK나 제품 의존성은 추가하지 않는다.

**Spec:** `docs/superpowers/specs/2026-10-14-first-party-traffic-analytics-design.md` — 2026-10-14 사용자 승인. 구현자는 설계와 이 계획을 함께 읽는다.

## Global Constraints

- 저장소: `C:/Users/Delight/Documents/ChatGPT/PASSMATE/passmate-seo-qualification-pages`; 브랜치 `codex/first-party-traffic-analytics`. 문서 기준 main은 `b8c032895f66bde0363218d489be0cba1239b860`; 실행 시 새 원격 상태와 병렬 변경을 확인한다.
- 운영 Supabase `fmecqeadghrdisirucqm`; Vercel project `prj_V10bDGyDR0pVWcpdGAgPHGmc9NuT`, team `team_Xe3ztEre9iK44lOTLSQ5J9Di`. 기존 인증·회원·응시·학습·주문·GA4 데이터와 무관한 작업 폴더를 보존한다.
- 기본 측정을 위한 쿠키, localStorage, sessionStorage, IndexedDB 값 또는 기기 지문을 생성하지 않는다. 사용자가 직접 변경한 측정 선택만 기능성 설정으로 저장한다.
- 분석 DB에 IP·회원 ID·이메일·이름·인증값·기기/브라우저 식별자·전체 User-Agent·개별 방문/세션 기록·답안·점수·문항 내용을 저장하지 않는다. 원본 주소·리퍼러·쿼리·해시도 전송하지 않는다.
- 단위: 조회수, 방문 시작 수, 활성 밀리초. 방문 시작 수를 순방문자·고유 사용자 수로 부르지 않는다. 평균은 총 활성 시간/총 조회수이며 분모 0은 ‘—’다.
- 활성 관측 간격 5초, 정상 관측 공백 상한 10초, 주기 전송 20초, 방문 재시작 간격 30분, 재시도/버퍼 유효기간 5분, 동시 전송 1개, 미전송 공개 페이지 키 최대 20개.
- 패킷 최대 8KiB, 공개 페이지 항목 최대 20개, 전체 조회수 최대 20, 방문 시작 수 ≤ 조회수, 활성 시간 최대 60초. nonce는 패킷마다 독립적이며 변경 없는 재시도에만 재사용한다.
- 중복 판정 30분. 만료 영수증은 수집/조회 시 정리와 일일 유지관리로 만료 후 24시간 이내 물리 삭제. 오늘 포함 최근 90일 합계 보관, 한국 시간 매일 05:00에 새 테이블만 정리한다.
- 브라우저 전송은 `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, 제한된 `keepalive`; 수집 응답은 `Set-Cookie` 없음. 원래 요청 헤더를 Supabase에 복사하지 않는다.
- 기존 거절과 GPC는 보존한다. 신규 방문자의 GA4를 자동 허용하지 않는다. 자체 집계와 GA4 수치는 합산하지 않는다.
- 조회/설정 실패는 0명·성공으로 바꾸지 않는다. 자동 팝업·배너는 제거하고 수동 설정도 독립 페이지로 제공한다.
- 계약·저장·로그 경계가 설계의 최소화 요구를 통과한 뒤 수집을 켠다. 구현 결과를 법률상 익명성 인증으로 표현하지 않는다.

## Review Focus

1. 중지 선택 직전의 비동기 수집/재시도 — 선택 이후 새 전송과 오래된 버퍼 재생이 없어야 한다. Task 4/5에 경합 테스트를 둔다.
2. 중복 패킷의 동시 도착과 재시도 중 페이지 이동 — 원래 증가분은 한 번만 반영하며 새 증가분과 섞이지 않아야 한다. Task 2/4가 검증한다.
3. 잠든 컴퓨터·백그라운드 타이머·bfcache·한국 자정 — 공백을 활성 시간으로 추정하지 않고 복귀만으로 조회를 더하지 않아야 한다. Task 2/4가 검증한다.
4. 출처 위장 도메인·잘못 인코딩된 주소·임의 추가 필드 — 개인 값과 임의 키가 저장소로 전달되지 않아야 한다. Task 1/3이 검증한다.
5. 측정 시작 전·오늘·빈 결과·상위 100행·소량 행·조회 실패 — 측정 범위와 평균/합계/오류 상태가 관리자 화면과 CSV에서 일치해야 한다. Task 6이 검증한다.

## File Structure

| 경로 | 책임 |
| --- | --- |
| `supabase/functions/_shared/traffic-aggregate-contract.mjs` + `.d.mts` | 패킷·증가분·조회 요청/응답 계약과 정확한 한도 |
| `lib/traffic-aggregate-policy.mjs` + `.d.mts` | 공개 경로 키, 출처 분류, 기존/새 선택·GPC 판정 |
| `lib/traffic-aggregate-collector.mjs` + `.d.mts` | 메모리 상태·활성 시간·패킷 분할·불변 재시도 |
| `lib/traffic-aggregate.ts` | 브라우저 이벤트/설정 저장 연결, 자격 증명 없는 fetch |
| `lib/traffic-aggregate-server.mjs` + `.d.mts` | 같은 출처 Next.js 수집 핸들러와 서버 전달 경계 |
| `app/api/analytics/aggregate/route.ts` | 공개 카탈로그·서버 설정을 주입하는 얇은 POST 경로 |
| `supabase/functions/traffic-aggregate-ingest/index.ts` | 서버 토큰 검증 후 제한된 집계 RPC 호출 |
| `supabase/functions/admin-traffic-aggregate/index.ts` | 기존 방식의 JWT/DB 관리자 검사 후 조회 RPC 호출 |
| `supabase/functions/_shared/traffic-aggregate-handlers.mjs` + `.d.mts` | Edge 핸들러의 테스트 가능한 검증/오류/인증 흐름 |
| `supabase/migrations/`의 CLI 생성 파일 | 집계·영수증·상태 테이블, 원자적 RPC, 권한, 새 유지관리 작업 |
| `app/analytics-settings/page.tsx`, `components/analytics-settings.tsx` | 색인 제외 설정/안내 화면 |
| `components/analytics-provider.tsx`, `components/site-footer.tsx` | 수집기 연결과 설정 링크; 자동 동의 UI 제거 |
| `components/admin-traffic-aggregate.tsx`, `lib/admin-traffic-aggregate-view.mjs` + `.d.mts` | 자체 집계 카드/표/CSV/요청 경합 처리 |
| `components/admin-client.tsx` | 자체 기본 집계와 기존 GA4 메뉴 출처 분리 |
| `scripts/test-analytics-aggregate-*.mjs`, `scripts/fixtures/traffic-aggregate.sql`, `scripts/prepare-traffic-aggregate-qa.mjs` | 실제 행위·계약·SQL·권한 검증과 격리 SQL 준비 |
| `docs/FIRST_PARTY_ANALYTICS.md`, 기존 `docs/ANALYTICS.md`/`docs/ANALYTICS_QA.md` | 실행·관측·한계·보관·증거·롤백 문서 |

공개 카탈로그의 권위는 기존 `lib/cbt-home-catalog.ts`의 `publicQualifications`다. Next 경로에서 이 목록으로 키를 확인한다. Edge 수집 함수는 서버 전용 토큰과 구조/한도를 검사하고 이를 신뢰하며 별도 카탈로그 사본을 만들지 않는다. 브라우저→Next 입력의 공개 키 검증은 생략할 수 없다.

---

### Task 1: 안전한 패킷·공개 키·선택 계약

**Files:** Create contract/policy 모듈과 선언 파일, `scripts/test-analytics-aggregate-contract.mjs`. Existing reference: `lib/analytics-policy.mjs`, `lib/cbt-home-catalog.ts`.

**Interfaces:**
- `AggregateMetrics = {pageViews:number;visitStarts:number;activeMs:number}`; `AggregateRow = {key:string;metrics:AggregateMetrics}`.
- `AggregatePacket = {version:1;nonce:string;totals:AggregateMetrics;sources:AggregateRow[];pages:AggregateRow[]}`; `AggregateBuffer = Omit<AggregatePacket,'version'|'nonce'>`. nonce는 소문자 UUID v4 형식, 페이지 키는 `home`, `cbt`, `q:<canonical slug>`, `e:<canonical slug>`다.
- Contract produces `parseAggregatePacket(raw:unknown, byteLength:number):AggregatePacket|null`, `validateAggregateRequest(raw:unknown, today:string):AggregateRequest|null`, `mergeMetrics(a:AggregateMetrics,b:AggregateMetrics):AggregateMetrics`, `splitAggregateBuffer(buffer:AggregateBuffer):AggregateBuffer[]`. Merge/split는 안전 정수와 한도를 지킨다. collector가 분할 결과마다 새로운 nonce/version을 붙인다. 한 패킷 안의 source/page 키 중복은 거부한다.
- `AggregateRequest = {startDate:string;endDate:string;dimension:'date'|'source'|'page'}`. 서버 한국 오늘을 기준으로 미래/90일 초과/교차 상세 필터를 거부한다.
- Policy produces `trafficPageKey(pathname:string, qualifications:readonly {slug:string}[]):string|null`, `classifyTrafficSource(referrer:string, siteOrigin:string):TrafficSource`, `verifyTrafficPageKeys(packet, qualifications):boolean`, `resolveTrafficChoice({legacyConsent,basicChoice,gpc,storageReadable}):{basic:boolean;ga4:boolean}`.
- `TrafficSource = 'naver'|'google'|'daum'|'bing'|'social'|'other'|'unknown'`; 새 선택 키는 `passmate.analytics.basic.v1`, 값은 `on`/`off`. 저장 읽기 오류·알 수 없는 저장 선택값은 자동 허용 대신 양쪽 중단으로 처리한다.

- [ ] **1. 실패 테스트 작성.** 개인정보 필드 추가, 잘못된 UTF-8 크기, 20/21 조회, 60,000/60,001ms, 음수/NaN/분수, 주변 합 불일치, 카탈로그 외/시도 ID 키, 위장 출처, 기존 거절·GPC·읽기 오류를 각각 검증한다.
  ```js
  assert.equal(parseAggregatePacket({...validPacket,memberId:'hidden'},1024),null);
  assert.equal(classifyTrafficSource('https://naver.com.evil.test/?email=a','https://www.mypassmate.com'),'other');
  assert.deepEqual(resolveTrafficChoice({legacyConsent:'denied',basicChoice:null,gpc:false,storageReadable:true}),{basic:false,ga4:false});
  assert.equal(trafficPageKey('/cbt/전기기능사/exam/private-attempt/?token=secret',catalog),null);
  ```
- [ ] **2. 실행해 실패 확인.** `node --test scripts/test-analytics-aggregate-contract.mjs`; 새 export/계약 부재로 실패해야 한다.
- [ ] **3. 모듈 구현.** 실제 pathname만 받는다. 잘못된 percent 인코딩은 null, 공용 종목/일반 문제풀이 키만 허용한다. 전체 원본 주소를 반환하지 않는다. `other`와 `unknown`을 분리한다. 유입 호스트는 명시적 공급자 도메인의 경계와 일치할 때만 분류한다.
- [ ] **4. 분할·한도 테스트 통과.** 120초 누적을 각각 한도 안의 패킷으로 나눈 뒤 전체/주변 합계가 정확히 원본과 같아야 한다. `node --test scripts/test-analytics-aggregate-contract.mjs` PASS.
- [ ] **5. 관련 새 파일만 커밋.** `feat: define safe first-party aggregate contracts`.

### Task 2: 원자적 일별 저장·중복 방지·권한·정리

**Files:** CLI로 생성할 migration, `scripts/fixtures/traffic-aggregate.sql`, `scripts/prepare-traffic-aggregate-qa.mjs`. 이 저장소에는 현재 `supabase/config.toml`이 없으므로 임의 설정을 추가하거나 다른 프로젝트에 링크하지 않는다.

**Interfaces:**
- Tables: `public.traffic_aggregate_daily(bucket_date date,dimension text,dimension_key text,page_views bigint,visit_starts bigint,active_ms bigint)`, PK `(bucket_date,dimension,dimension_key)`; `public.traffic_aggregate_receipts(digest text PK,expires_at timestamptz)`; `public.traffic_aggregate_state(singleton boolean PK,enabled boolean,started_at timestamptz,maintenance_job_id bigint,maintenance_last_attempt_at timestamptz,maintenance_last_success_at timestamptz,maintenance_last_status text)`.
- `dimension`은 `total`/`source`/`page`; 전체 키는 `all`. 페이지×출처 조인 레코드, raw payload 열은 만들지 않는다.
- Produces RPC `public.ingest_traffic_aggregates(p_digest text,p_packet jsonb) returns boolean`, `public.read_traffic_aggregate_report(p_start date,p_end date,p_dimension text) returns jsonb`, `public.cleanup_traffic_aggregates() returns void`.
- RPC는 `SECURITY INVOKER`; PUBLIC/anon/authenticated EXECUTE와 테이블 권한을 철회하고 service_role만 사용한다. RLS 활성화. admin role 판단은 Task 6의 Edge 함수가 수행한다.
- State `enabled=false`, `started_at=null`로 시작한다. 수집 RPC는 비활성 상태에 쓰지 않는다. 수신일은 서버 한국 날짜다. maintenance 상태는 새 state 표만 업데이트하며 기존 `cron` 테이블을 service_role에 광범위하게 공개하지 않는다.
- 검증 대상은 같은 운영 프로젝트 안의 **API 비노출 `traffic_aggregate_qa` 스키마**다. 기존 테이블·레코드는 읽거나 바꾸지 않는다. 동일 SQL을 이 스키마로 한정한 검증용 정의를 먼저 적용하고 운영용 public 정의는 Task 7에서 적용한다. 현재 전역 psql/docker/supabase CLI는 발견되지 않았다. SQL 실행은 연결된 Supabase MCP를 사용한다.

- [ ] **1. 실패 SQL fixture 작성.** `traffic_aggregate_qa` 대상 트랜잭션에서 소량 fixture와 enabled 상태를 준비한다. 같은 digest 두 번, nonce 동시 도착, 만료 영수증, UTC 15:00 한국 자정 경계, 90일 보관, anon/authenticated 읽기·쓰기·RPC 거부를 assertion으로 검증한다. 마지막은 ROLLBACK이며 기존 테이블을 수정하지 않는다.
- [ ] **2. 미구현 QA fixture의 사전 검사를 실행해 실패 확인.** 연결된 MCP `execute_sql`로 QA 전용 relation/function 부재를 assertion 처리한다. 쿼리는 `traffic_aggregate_qa` 외의 표를 참조하지 않는다.
- [ ] **3. 생성 CLI를 확인하고 migration 생성.** `supabase --version`, `supabase migration new --help`, `supabase migration new first_party_traffic_aggregates`. 실제 반환된 migration 경로를 사용하며 timestamp 이름을 직접 만들지 않는다. CLI가 없으면 설치 전에 기존 bundled/cached CLI를 확인한다.
- [ ] **4. migration에 저장 계약 구현.** 30분 영수증 삽입과 주변 합계 증가를 같은 트랜잭션으로 처리하고 conflict면 false만 반환한다. 카운터는 상한 검증 후 bigint 덧셈. 조회 RPC는 전체 합계와 선택 차원 행을 분리한다. 정리 범위는 새 두 테이블뿐이다.
- [ ] **5. QA 정의와 유지관리 검증 준비.** `buildTrafficQaMigration(sql:string):string`을 `prepare-traffic-aggregate-qa.mjs`에서 export한다. 새 세 테이블·세 RPC의 public 스키마와 search_path만 `traffic_aggregate_qa`로 치환하고 다른 앱 객체 참조가 있으면 실패시킨다. 역할 `PUBLIC`은 치환하지 않는다. `scripts/test-analytics-aggregate-qa.mjs`에서 정상 대상 치환과 `public.profiles` 등 외부 객체 입력 거부를 검증한다. QA 스키마의 PUBLIC/anon/authenticated 접근을 철회하고 service_role에 필요한 사용 권한만 둔다. 결과 DDL은 MCP `apply_migration`으로 적용한다. 이 core migration에는 확장 설치와 예약 등록을 넣지 않는다. QA에 대해서만 정리 함수를 수동 검증하며 실제 pg_cron 설치/일일 작업 등록은 Task 7의 별도 retention migration에서 한다. 예약 이름은 `passmate-traffic-aggregate-retention`, UTC `0 20 * * *`, SQL은 새 public cleanup 함수 호출뿐이다.
- [ ] **6. fixture/동시성 통과.** MCP `execute_sql`에 fixture 전체를 BEGIN→assertions→ROLLBACK으로 한 번에 전달한다. 동일 digest의 동시 삽입은 서로 다른 두 MCP 실행 세션에서 QA 영역의 fixture만 사용해 확인한다. 합은 한 번만 반영돼야 한다. 격리 QA 행은 검증용 데이터만 사용하고 테스트 뒤 disabled 상태로 남기며 기존 운영 데이터를 비교용 fixture로 끌어오지 않는다.
- [ ] **7. migration·fixture만 커밋.** `feat: store atomic daily traffic aggregates`.

### Task 3: 자격 증명 없는 같은 출처 수집 경로

**Files:** Create server 모듈/선언, Next route, shared handler 모듈/선언, `traffic-aggregate-ingest/index.ts`, `scripts/test-analytics-aggregate-ingest.mjs`. Reference `app/api/cbt/question-stats/route.ts`의 서버 전달 패턴만 재사용하며 해당 경로의 쿠키·IP 처리 코드는 복사하지 않는다.

**Interfaces:**
- `createTrafficAggregateProxy({getConfig,publicQualifications,forward,now}):(Request)=>Promise<Response>`; config `{enabled:boolean;supabaseUrl:string;apiKey:string;ingestToken:string;allowedOrigins:string[]}`.
- `createTrafficIngestHandler({getConfig,ingest,sha256,now}):(Request)=>Promise<Response>`; ingest consumes Task 2 RPC args, returns accepted boolean. 인메모리 동시 수집 상한은 인스턴스당 2다.
- Proxy forwards to `/functions/v1/traffic-aggregate-ingest` with `Content-Type`, apikey, `x-passmate-aggregate-token` only. Edge config reads `PASSMATE_AGGREGATE_INGEST_TOKEN`; JWT 대신 이 전용 서버 토큰을 검사한다. 관리자 조회 함수와 배포 인증 설정을 혼동하지 않는다.
- Public response is 204 on accepted/duplicate, 400 invalid packet, 403 wrong origin, 413 oversized, 415 wrong content type, 429 capacity exhausted, 503 disabled/unavailable. No body echo, no caching, no Set-Cookie.

- [ ] **1. 실패 핸들러 테스트 작성.** Origin이 없거나 다른 호스트, cross-site, 가짜 공개 키, 큰 스트림, 추가 개인정보, 잘못된 토큰은 forward/RPC 호출 전에 실패해야 한다. HTTP Cookie/Authorization/Referer/IP 헤더를 넣어도 전달된 헤더·본문·응답에는 없어야 한다.
  ```js
  assert.equal((await proxy(crossOriginRequest)).status,403);
  assert.equal(forwardCalls.length,0);
  assert.equal((await proxy(validRequest)).headers.has('set-cookie'),false);
  assert.deepEqual(Object.keys(forwardCalls[0].headers).sort(),['Content-Type','apikey','x-passmate-aggregate-token'].sort());
  ```
- [ ] **2. 실패 확인.** `node --test scripts/test-analytics-aggregate-ingest.mjs`가 새 핸들러 부재로 실패.
- [ ] **3. 제한된 프록시/함수 구현.** 스트림을 읽으면서 8KiB에서 중단하며 Content-Length만 믿지 않는다. `application/json`, 허용 원점, 카탈로그 키를 확인한다. Supabase 요청 제한 시간 5초, 응답은 204/안전한 오류 상태만 허용한다. 전달된 요청의 쿠키를 읽거나 토큰/본문을 로깅하지 않는다.
- [ ] **4. 안전한 인증/오류 구현.** 토큰 비교 시 길이·일치 여부를 검증한다. 사전 검증 없는 요청에 RPC를 호출하지 않는다. 설정 부재, timeout, quota 오류와 비밀값을 포함한 upstream 오류는 공개 응답에 노출하지 않는다. 키는 브라우저 번들에 포함하지 않는다.
- [ ] **5. 통과 확인.** `node --test scripts/test-analytics-aggregate-ingest.mjs scripts/test-analytics-aggregate-contract.mjs`; 기존 `npm run check:server-keys`도 통과.
- [ ] **6. 관련 파일만 커밋.** `feat: collect validated same-origin traffic aggregates`.

### Task 4: 메모리 수집기·시간·분할·재시도

**Files:** Create collector 모듈/선언, `lib/traffic-aggregate.ts`, `scripts/test-analytics-aggregate-collector.mjs`.

**Interfaces:**
- `createTrafficAggregateCollector({now,send,randomNonce,onError},{enabled,publicQualifications,choice}):TrafficAggregateCollector`.
- Methods `navigate(pathname,referrer):void`, `setActivity({visible,focused}):void`, `setChoice(choice):void`, `tick():void`, `flush():Promise<void>`, `dispose():void`.
- `now`는 performance.now 기반 밀리초, `send(packet):Promise<boolean>`은 네트워크 성공 여부, `randomNonce()`는 패킷 전용 UUID다. 공개 경로·출처는 Task 1, 패킷 구조/분할도 Task 1 계약을 소비한다.
- Browser adapter produces `startTrafficAggregate():()=>void`, `visitTrafficAggregate(pathname:string):void`, `readTrafficPreferences()`, `applyTrafficPreference(mode:'off'|'basic'|'detail'):void`. 이 모드의 저장/GA4 연결은 Task 5가 완성한다.

- [ ] **1. 결정적 fake-clock 실패 테스트 작성.** 첫 진입 1/1, 같은 경로 재렌더 0 추가, SPA 이동 1 조회/0 시작, bfcache 복귀 조회 0 추가, 공개→비공개→같은 공개 복귀는 새 조회 1회, 30분 중단 뒤 1 시작, 숨김/블러/비공개 시간 0, 11초 타이머 공백 미추정, 읽는 중 입력 없어도 시간 유지.
- [ ] **2. 경합/재시도 실패 테스트 추가.** 중지 후 버퍼 폐기·새 전송 0, in-flight 패킷 고정, 새 경로의 증가분 분리, nonce 재시도 동일, 다음 패킷 nonce 독립, 5분/20키 제한, 120초 분할 합계 보존을 검증한다.
  ```js
  collector.navigate('/','https://search.naver.com/?query=private');
  clock.advance(5000);collector.tick();
  collector.setActivity({visible:false,focused:false});
  clock.advance(60000);collector.tick();
  await collector.flush();
  assert.equal(packets.reduce((n,p)=>n+p.totals.activeMs,0),5000);
  assert.equal(JSON.stringify(packets).includes('query='),false);
  ```
- [ ] **3. 실패 확인.** `node --test scripts/test-analytics-aggregate-collector.mjs`가 새 collector 부재로 실패.
- [ ] **4. 수집기 구현.** 샘플 사이 10초 초과 공백은 버린다. 밀리초를 누적하고 패킷 한도 안에서 분할하며 선택 중지·폐기 이후 생성/재시도를 중단한다. 20초 interval은 visible 화면에서만 필요하며 이벤트의 flush는 단일 in-flight 큐를 사용한다. 실패는 메모리에서만 5분 이내 재시도한다.
- [ ] **5. 브라우저 어댑터 구현.** fetch 5초 timeout, `omit`/`no-referrer`/`keepalive` 설정, no auth header. visibility/focus/pagehide/pageshow/path 이벤트는 관측/시간 정리에만 사용하고, 기본 측정을 위한 저장소 쓰기가 없음을 검증한다. GA4 패킷·attempt 저장값을 참조하지 않는다.
- [ ] **6. 통과 확인.** `node --test scripts/test-analytics-aggregate-collector.mjs scripts/test-analytics-aggregate-contract.mjs`; 요청 옵션과 storage spy 검사 통과.
- [ ] **7. 관련 파일만 커밋.** `feat: measure focused public-page traffic without visitor identifiers`.

### Task 5: 자동 동의 UI 제거·독립 설정 화면·기존 선택 보존

**Files:** Modify provider/footer, replace 기존 `components/analytics-consent.tsx` 사용을 `components/analytics-settings.tsx`로 옮긴 뒤 미사용 기존 component 제거, create `app/analytics-settings/page.tsx`, modify `lib/traffic-aggregate.ts`, `lib/analytics.ts` only for explicit preference integration, create `scripts/test-analytics-aggregate-preferences.mjs`. GA4 collector의 opt-in 조건은 변경하지 않는다.

**Interfaces:**
- `applyTrafficPreference('off')`: 새 basic=off, 기존 GA4 consent=denied, 양쪽 중지/버퍼 폐기.
- `applyTrafficPreference('basic')`: 새 basic=on, GA4 consent=denied, 자체만 재개.
- `applyTrafficPreference('detail')`: 새 basic=on, 기존 GA4 consent=granted; 설명을 확인한 명시적 클릭 이후만 실행.
- 이벤트 `passmate:traffic-preference`와 브라우저 `storage` 변경을 양쪽 수집기에 전달한다. GPC=true는 저장 선택과 무관하게 양쪽 중지다. 읽기/쓰기 오류 시 수집은 중지 상태로 유지하고 학습은 동작한다.
- `effectiveGa4Allowed():boolean`을 `lib/analytics.ts`에서 제공한다. 순수 Task 1 선택 판정과 현재 저장값/GPC를 이용하며 브라우저 adapter를 역으로 import해 순환 의존성을 만들지 않는다. 페이지/이벤트/학습 기록·flush의 GA4 진입점마다 이 판정을 적용한다. 중지 시 기존 `suspendAnalytics()`로 대기 학습과 collector의 공개 문맥도 비운다.

- [ ] **1. 실패 선택 테스트 작성.** 기존 거절/허용/신규 각각, 모든 새 선택 모드, GPC, 손상된 저장값, storage 실패, 다른 탭의 off 전환과 tag-load/flush 경합을 검증한다. basic 재개가 과거 GA4 grant를 되살리지 않아야 한다. 자체 flag=true/GA4 flag=false 상태에서도 자체 수집과 설정 링크는 사용 가능하며, GPC가 기존 grant보다 우선해 풀이 완료/가입 이벤트도 차단해야 한다.
- [ ] **2. 실패 확인.** `node --test scripts/test-analytics-aggregate-preferences.mjs`; 새 연결 부재로 실패.
- [ ] **3. provider·footer 연결.** 자체 시작/경로 변경을 기존 provider에 연결하고 자동 AnalyticsConsent render를 제거한다. 푸터는 기존 위치/스타일의 `/analytics-settings/` 링크가 되며 두 측정 flag 중 하나라도 켜져 있으면 노출한다. provider도 자체와 GA4 활성화를 독립 판정한다. 기존 GA4 데이터와 계정 메뉴·학습 footer 숨김 규칙을 보존한다.
- [ ] **4. 설정 화면 구현.** `privateMetadata`, 제목 ‘방문 분석 설정’, 현재 적용 상태, 목적/항목/90일/출처 분리/기존 GA4 정보/문의/중지 방법을 표시한다. 버튼 문구는 ‘모두 중지’, ‘기본 집계만 사용’, ‘상세 분석도 허용’. popup/dialog를 쓰지 않는다. 로컬 안내 문안을 전체 개인정보 처리방침으로 주장하지 않는다.
- [ ] **5. 통과 확인.** 새 preference tests와 기존 `npm run check:analytics`, `npm run check:browser-storage`. 격리된 브라우저에서 신규/기존 거절/GPC/기존 허용, 초기·SPA·설정 화면에 자동 팝업/배너가 없고 저장 선택이 다른 탭에 반영되는지 확인한다.
- [ ] **6. 관련 파일만 커밋.** `feat: replace analytics prompts with a voluntary settings page`.

### Task 6: 관리자 API·자체 집계 화면·CSV

**Files:** Create admin Edge entrypoint, extend shared traffic handlers, create admin-view 모듈/선언/component, modify `components/admin-client.tsx`, create `scripts/test-analytics-aggregate-report.mjs` and `scripts/test-analytics-aggregate-view.mjs`. Existing `components/admin-analytics.tsx`와 회원 인기 시험 집계는 수정하지 않는다.

**Interfaces:**
- `createAdminTrafficAggregateHandler({resolveAdmin,getConfig,readReport,now}):(Request)=>Promise<Response>`. `resolveAdmin` returns true/401/403 using verified JWT and `profiles.role === 'admin'`, never user_metadata. 관리자 검사는 설정·조회 이전에 수행한다.
- `AggregateResponse = {status:'ok'|'noData'|'error'|'notConfigured';data:null|{totals:AggregateMetrics;rows:AggregateRow[]};meta:{source:'firstParty';timezone:'Asia/Seoul';measurementStartedAt:string|null;fetchedAt:string|null;partialToday:boolean;rowLimit:100;thresholded:boolean;maintenanceHealthy:boolean};errorCode?:'permission'|'configuration'|'network'|'query'}`.
- `normalizeAggregateReport(rpcReply,request,now):AggregateResponse`, `formatAggregateTime(activeMs,pageViews):string`, `buildAggregateCsv(response,request):string`, `createAggregateReportLoader(fetchReport):{load;cancel}`. UI component exports `AdminTrafficAggregate`.

- [ ] **1. 실패 API/view 테스트 작성.** 비로그인/일반 회원은 DB 조회 0회와 401/403. 설정 없음/측정 전/null/조회 오류를 0으로 바꾸지 않는다. 전체 합계를 상위 행 합으로 대체하지 않는다. 5회 미만 항목 묶음, 상위 100행, 한국 오늘, 가중 평균과 stale 요청 취소를 검증한다.
  ```js
  assert.equal(formatAggregateTime(60000,0),'—');
  assert.equal((await handler(nonAdminRequest)).status,403);
  assert.equal(dbCalls.length,0);
  assert.equal(normalizeAggregateReport(null,request,now).status,'error');
  assert.ok(buildAggregateCsv(reply,request).includes('firstParty'));
  ```
- [ ] **2. 실패 확인.** `node --test scripts/test-analytics-aggregate-report.mjs scripts/test-analytics-aggregate-view.mjs`.
- [ ] **3. admin handler 구현.** 기존 admin-analytics와 같은 `createSupabaseContext` 인증 패턴을 사용하고 Task 2 조회 RPC만 호출한다. start/end/dimension 외 입력과 90일 초과를 거부한다. 이번 자체 조회는 별도 캐시를 추가하지 않는다. fetchedAt은 실제 성공 시각이다.
- [ ] **4. UI와 CSV 구현.** 7/30/90/직접 기간, 요약/추이/유입/페이지, 정확한 정의와 제한을 표시한다. 기본 방문 분석 메뉴는 자체 집계, 기존 동적 `AdminAnalytics`는 ‘GA4 동의자 분석’ 메뉴로 유지한다. source별 상태/숫자/CSV를 합산하지 않는다. 권한·빈 상태·시작 전·오류·오늘·정리 실패를 명시한다.
- [ ] **5. 통과 확인.** report/view 테스트와 기존 analytics tests. 검증 DB 표본 숫자를 API→카드→표→CSV까지 대조한다. 모바일 가로 넘침, 기간 변경 경합과 키보드 표/버튼 조작을 확인한다.
- [ ] **6. 관련 파일만 커밋.** `feat: show first-party traffic reports separately from GA4`.

### Task 7: 운영 연결·실수집·릴리스·롤백 검증

**Files:** Create `docs/FIRST_PARTY_ANALYTICS.md`, update `docs/ANALYTICS.md`, `docs/ANALYTICS_QA.md`, `docs/STATUS.md`; screenshots/packet summaries go under ignored `output/first-party-traffic-analytics/`. 제품 코드 추가 없이 발견된 실제 실패만 관련 Task로 되돌려 수정한다.

**Interfaces / exact configuration:**
- Browser/Next public: `NEXT_PUBLIC_FIRST_PARTY_ANALYTICS_ENABLED` (false default). 기존 GA4 public flags/measurement ID는 유지한다.
- Next server: `PASSMATE_FIRST_PARTY_INGEST_ENABLED`, `PASSMATE_AGGREGATE_INGEST_TOKEN`; public Supabase URL/key는 기존 `getPublicSupabaseConfig`를 재사용한다. public 번들에 토큰을 노출하지 않는다.
- Supabase ingest: same token plus `PASSMATE_FIRST_PARTY_INGEST_ENABLED`; report: `PASSMATE_FIRST_PARTY_REPORTS_ENABLED`. Both default false.
- DB state `enabled`/`started_at`는 실제 운영 활성화 시각을 기록한다. env/state 중 하나라도 비활성 또는 정리 기능 미검증이면 ingest를 켜지 않는다.

- [ ] **1. 소스/서비스 상태 재확인.** 최신 remote main·branch·unrelated dirty 파일, 현재 운영 Vercel 커밋/별칭, Supabase 대상·기존 GA4/학습 기록을 확인한다. 이미 승인된 범위의 작업만 적용한다. 새로운 비밀 생성/서버 설정은 값과 recipient를 출력하지 않고 필요한 연결에 한정한다.
- [ ] **2. 격리 대상에서 전체 검증.** `npm run check:analytics`, QA 스키마 SQL fixture/동시성/권한 검사, 이후 GA4 공개 설정을 운영과 맞춘 `npm run build`가 exit 0이어야 한다. 로컬 브라우저에서는 기본 client flag만 켜고 server ingest는 비활성(503)으로 두어 실제 전송 항목/옵션과 실패 처리·UI를 검증한다. 해당 브라우저 시험은 저장 성공 증거가 아니다. 저장/동시성은 QA SQL, 전송 경계는 주입 가능한 핸들러 테스트로 검증하며 실제 전체 연결은 Step 6에서 확인한다. 기존 데이터에 테스트 응시를 만들지 않는다.
- [ ] **3. 실제 개인정보/요청 경계 검사.** 브라우저 네트워크에서 Cookie/Authorization/Referer 없음, 허용 payload만 있음, 신규·거절·GPC의 GA4 요청 0을 확인한다. proxy/Edge/DB에서 원본 IP/헤더/본문 로그가 없는지 실제 관측 설정과 에러 경로를 대조한다. 이를 검증할 수 없거나 최소화 요구를 어기면 운영 flag를 켜지 않고 구체적인 blocker를 보고한다.
- [ ] **4. 서버·저장·정리 적용.** 새 core migration과 좁은 함수만 대상 프로젝트에 적용, ingest의 전용 토큰 검사와 admin 함수의 플랫폼 JWT 검증을 각기 올바르게 배포한다. `supabase migration new first_party_traffic_aggregate_retention`으로 반환된 별도 retention migration에 pg_cron 설치와 새 작업 등록/metadata 기록만 담는다. 적용 후 수동 정리 실행 결과/권한·삭제 범위를 확인한다. 기존 작업·권한·회원/주문 데이터는 보존한다.
- [ ] **5. 검토·Git 릴리스.** 문서 갱신 후 전체 diff를 별도 리뷰받고 중요 지적을 수정한다. 전용 브랜치 push→PR 생성/attach→CI/검증 배포 확인→승인된 운영 범위로 병합한다. 유료 상품·광고 설정 변경·다른 채팅/사람에게 메시지 전송은 하지 않는다. 실제 운영 변경 승인이 추가로 필요하면 구체적인 완료 산출물과 이유를 제시한다.
- [ ] **6. 운영 활성화·실측.** 안전한 서버 설정과 DB state를 켜고 검증된 운영 웹 배포에 public flag를 반영한다. exact merged SHA/READY/별칭을 확인한다. 운영자 자신의 정상 공개 이용 한 흐름으로 페이지 조회·유입 분류·5초 활성 후 숨김·SPA 이동→DB 합계→관리자 값이 맞는지 확인한다. 운영 표에 가짜 숫자를 직접 넣지 않는다.
- [ ] **7. 기존 기능·선택/권한 확인.** 기존 허용자의 GA4와 자체 집계가 별개로 조회되고, 기존 거절·새 중지·GPC는 양쪽 중단하며 일반 회원이 보고서를 읽을 수 없는지 확인한다. 자동 popup/banner 부재·수동 설정 페이지·모바일과 학습 보존 screenshot을 저장한다. 관리자의 로그인 상태는 로그아웃시키지 않는다.
- [ ] **8. 롤백 보고서/증거 저장.** 적용 범위, migration/function/deployment/commit identity, 실제 packet→aggregate→report proof, 미검증 항목, 보관 정리 상태와 남은 누락/봇 한계를 기록한다. rollback은 자체 ingest/report/public flags OFF→이전 웹 배포 복원. 기존 GA4·응시·학습·주문 데이터 또는 새 집계표를 삭제하지 않는다. 완료 보고에는 source/local/production/browser 검증을 구분한다.

## Self-review and execution handoff

설계 1–3/9는 Task 1/5, 4/8은 Task 3, 5–6은 Task 4, 7은 Task 2, 10은 Task 5, 11은 Task 6, 12–14는 Task 7에서 수행한다. 계약의 시간/크기/권한 한도는 Task 1이 정의하며 나머지 Task가 동일 타입과 상수를 소비한다. Review Focus의 다섯 실패군은 각 Task의 구체적 테스트에 포함한다.

이 계획은 하나의 수집→집계→조회 수직 기능이다. 인터페이스 의존성이 높고 기존 GA4/관리자 흐름 보존이 중요하므로, 이전 분석 작업처럼 이 채팅에서 직접 구현하는 Native 방식과 마지막 별도 전체 리뷰를 권장한다. 현재 단계는 계획 문서 검토이며 아직 구현·DDL·함수 배포·운영 설정 변경을 하지 않는다.
