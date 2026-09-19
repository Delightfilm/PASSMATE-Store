# PASSMATE Session Log

## 2026-09-18 — V1 Start

**한 일**
- 최종 V0~V12 로드맵을 GitHub 문서로 고정.
- 진행상황 기록 규칙을 STATUS / SESSION_LOG 방식으로 확정.
- V1 Supabase 핵심 데이터 모델 및 migration 초안 작성 시작.

**막힌 것**
- PASSMATE 전용 Supabase 프로젝트 생성 시 사용할 organization의 사용자 확인 필요.
- 현재 확인된 Supabase organization은 `DF-AUTOSYNC` 1개.

**다음 할 일**
- organization 확인 후 PASSMATE Supabase 프로젝트 생성.
- V1 migration 적용 → RLS 검증 → 테스트 상품 입력 → Storefront 연결.

## 2026-09-18 — V1 Supabase Organization Decision

**한 일**
- PASSMATE Supabase 환경을 DF-AUTOSYNC와 분리하기로 확정.
- 현재 연결 계정의 organization 목록 재확인.

**막힌 것**
- 연결된 계정에는 현재 DF-AUTOSYNC organization만 존재.
- 현재 Supabase 도구에는 organization 생성 기능이 없어 Dashboard에서 1회 생성 필요.

**다음 할 일**
- PASSMATE 전용 organization 생성 확인.
- 새 organization에 PASSMATE 프로젝트 생성 → V1 migration 적용 → RLS 검증.

## 2026-09-18 — V1 Supabase Organization Creation Attempt

**한 일**
- 사용자 요청에 따라 PASSMATE 전용 Supabase organization을 직접 생성하려고 연결 도구 기능을 재확인.

**막힌 것**
- 현재 Supabase 연결에는 organization 조회 기능만 있고 organization 생성 기능은 제공되지 않음.
- 기존 DF-AUTOSYNC organization 내부에는 생성하지 않는 원칙 유지.

**다음 할 일**
- PASSMATE 전용 organization이 생성되는 즉시 새 프로젝트 생성부터 자동으로 이어서 진행.

## 2026-09-18 — V1 Offline Preparation

**한 일**
- 사용자 PC 없이 진행 가능한 V1 사전작업을 계속 진행.
- PM-C2 상품 정보를 `data/catalog.json` 단일 소스로 정리하고 CI 검증 스크립트 추가.
- Supabase core schema의 권한을 재검토하여 고객이 자신의 `role`을 admin으로 변경할 수 있는 권한 상승 가능성을 차단.
- 상품 메타데이터(display_year, badge, features)를 DB schema에 반영.
- `0002_seed_catalog.sql`, `v1_smoke.sql`, V1 데이터 모델 문서, Supabase Setup Runbook 추가.

**막힌 것**
- PASSMATE 전용 Supabase organization 생성은 현재 연결 도구에서 수행할 수 없음.
- 실제 migration/RLS 테스트는 새 organization/project 생성 이후 가능.

**다음 할 일**
- organization 생성 즉시 `passmate-prod` 프로젝트 생성.
- migration/seed/smoke test 자동 적용.
- Vercel 환경변수 및 Storefront catalog read 연결.

## 2026-09-18 — V1 Catalog Adapter

**한 일**
- Supabase 프로젝트가 아직 없어도 배포가 깨지지 않도록 local catalog fallback을 유지하는 데이터 어댑터 구현.
- `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`가 설정되면 Supabase REST catalog를 사용하도록 준비.
- 홈/상품목록/상품상세를 동일 catalog adapter에 연결.

**막힌 것**
- 실제 Supabase 연결 검증은 PASSMATE organization/project 생성 이후 가능.

**다음 할 일**
- 새 Supabase project 생성 직후 환경변수만 넣으면 DB catalog source로 전환되는지 검증.

## 2026-09-18 — V1.5 Order State Machine

**한 일**
- 주문/결제 상태와 자료 발행 상태를 분리한 2축 상태 머신으로 확정.
- Order: `pending → payment_pending → paid/refunded`, 실패 시 `failed → payment_pending` 재시도 규칙 추가.
- Fulfillment: `not_started → queued → issuing → ready`, 실패 시 `failed → queued` 재시도 규칙 추가.
- 결제 전 발행 금지, 환불 시 `refunded + revoked` 강제 규칙 추가.
- `state_version`을 통한 optimistic concurrency 기반 추가.
- `order_state_events` 자동 audit trail과 DB transition trigger migration 작성.
- JSON contract / TypeScript helper / CI validator / SQL smoke test / 상세 문서 추가.
- Production build에서 catalog + order-state contract 검증이 항상 실행되도록 quality gate 변경.

**막힌 것**
- DB trigger와 SQL smoke test는 PASSMATE 전용 Supabase 프로젝트가 생기기 전까지 실제 실행 불가.

**다음 할 일**
- PASSMATE Supabase 생성 후 migrations 0001~0003 적용 및 illegal transition 차단 검증.
- 이후 NAS Worker의 Queue/Issuing/Ready/Failed 전이를 이 계약에 맞춰 설계.

## 2026-09-18 — V1.5 NAS Job Contract

**한 일**
- NAS가 inbound 서버가 아니라 Supabase를 outbound polling하는 구조로 Job Contract 확정.
- `issuance_jobs` queue schema와 atomic claim(`FOR UPDATE SKIP LOCKED`) RPC 작성.
- lease token / worker id / 300초 lease / 60초 heartbeat 규칙 확정.
- retryable failure는 `retry_wait`, 최대 5회 이후 `dead_letter`로 이동하도록 설계.
- stale Worker 방지를 위해 lease 만료 후 completion 거절, heartbeat 실패 시 결과 폐기 규칙 추가.
- 완료 결과는 storage_key / SHA-256 / size만 저장하고 claim payload에서 고객 PII를 금지.
- 환불 시 미완료 job cancel + entitlement revoke 경로 추가.
- 다중 상품 주문에서 첫 작업 완료 후 남은 작업이 있으면 order fulfillment가 `issuing -> queued`로 돌아가도록 상태 머신 보완.
- Job event audit trail, SQL smoke test, JSON contract validator, TS 타입, NAS Worker README 추가.
- Production build quality gate에 issuance job contract validator 추가.

**막힌 것**
- 실제 atomic claim/lease/RPC SQL 검증은 PASSMATE 전용 Supabase 생성 이후 가능.

**다음 할 일**
- NAS Worker reference loop와 RPC 호출 순서를 코드 수준으로 고정.
- 이후 Payment Provider contract를 설계해 `paid -> enqueue` 경계를 확정.

## 2026-09-18 — NAS Worker Reference Implementation

**한 일**
- Supabase RPC 기반 NAS Worker Python reference implementation 작성.
- `claim -> heartbeat -> process -> hash -> complete/fail` 실행 루프 구현.
- lease 상실 또는 completion 거절 시 결과물을 폐기하도록 stale-result 방어 추가.
- MASTER 경로 segment 검증으로 path traversal 방지.
- ReferenceCopyProcessor는 실판매용이 아니며 `PASSMATE_ALLOW_REFERENCE_COPY=false`가 기본값이 되도록 안전장치 추가.
- Dockerfile / docker-compose / env example / NAS 배포 Runbook 추가.
- Python compile + unittest GitHub Actions Workflow 추가.
- config/model/processor/worker 단위 테스트 추가.

**막힌 것**
- 실제 Supabase RPC integration은 PASSMATE 전용 Supabase 프로젝트 생성 전까지 실행 불가.
- 최종 고객 PDF 변환 및 임시 다운로드 Storage는 아직 reference processor 밖의 후속 작업.

**다음 할 일**
- Worker CI 검증 완료 확인.
- Supabase 생성 후 migrations 0001~0004 적용 및 `--once` integration test.
- Final PDF Processor Contract와 Storage Adapter 경계를 설계.

## 2026-09-18 — Final PDF Processor Contract

**한 일**
- MASTER version directory에 `manifest.json` + SHA-256 검증 규칙 추가.
- `ProductionPdfProcessor` 파이프라인 shell 구현.
- `PdfTransformer`와 `ArtifactStore`를 분리해 PDF 변환과 저장소를 독립 교체 가능하게 설계.
- MASTER와 byte-identical 결과물을 실판매 발행본으로 허용하지 않는 안전장치 추가.
- 절대경로/`..` storage key 차단 및 PII-free storage path 규칙 추가.
- stale completion 시 artifact 삭제 가능한 storage interface 추가.
- manifest 변조, 동일 MASTER 복사, unsafe storage key를 검증하는 Python unit tests 추가.

**막힌 것**
- 실제 PASSMATE Supabase organization이 현재 연결 커넥터 목록에 아직 나타나지 않아 DB migration 적용은 계속 대기 중.
- 최종 PDF 시각/내부 식별 transform 구현은 MASTER PDF 형식/정책 확정 후 진행.

**다음 할 일**
- Supabase organization 연결이 보이면 passmate-prod 생성 → migrations 0001~0004 적용.
- Worker integration test 후 production storage adapter와 결제 Provider contract 진행.

## 2026-09-18 — PASSMATE Supabase Organization Confirmed

**한 일**
- 사용자 Supabase Organizations 화면에서 `PASSMATE / Free Plan / 1 project` 생성을 시각적으로 확인.
- PASSMATE가 DF-AUTOSYNC와 분리된 organization으로 존재하는 상태를 GitHub 진행상황에 반영.

**막힌 것**
- 현재 ChatGPT에 연결된 Supabase connector는 아직 DF-AUTOSYNC organization만 반환함.
- 새 PASSMATE organization/project가 connector에 동기화되거나 권한이 갱신되기 전에는 migration 적용 불가.

**다음 할 일**
- PASSMATE 프로젝트 ref 확인 또는 Supabase connector 재연결 후 프로젝트 접근 확인.
- 접근 확인 즉시 migrations 0001~0004, seed, RLS/state-machine/NAS queue smoke tests 적용.

## 2026-09-18 — Supabase Live Integration & Hardening

**한 일**
- 사용자 제공 project ref `fmecqeadghrdisirucqm`로 PASSMATE Supabase 프로젝트 직접 접근 성공.
- 프로젝트 상태 `ACTIVE_HEALTHY`, region `ap-northeast-1` 확인.
- migrations 0001~0004 및 PM-C2 seed가 실제 DB에 적용된 상태 확인.
- V1 read-only smoke test 통과.
- Connector가 일반 SQL write를 read-only transaction으로 실행하는 제약 때문에 runtime 검증을 별도 verification migration으로 수행.
- 주문 상태머신 + issuance queue runtime verification 통과: unpaid enqueue 차단, paid transition, idempotent enqueue, lease/heartbeat, retry, stale completion 차단, refund invariant 검증.
- Supabase Security Advisor 실행 후 발견된 SECURITY DEFINER RPC 노출, mutable search_path, RLS policy 중복/성능 문제를 `0005_security_hardening.sql`로 수정.
- `private.is_admin()` helper로 admin check를 API 노출 schema에서 분리하고 Worker RPC는 service_role only로 제한.
- client roles의 issuance queue 접근을 explicit deny policy로 고정.
- FK covering indexes 추가 및 RLS auth.uid initplan 개선.
- Security Advisor 재검사 결과 **0 findings** 확인.
- 권한 검증: anon/authenticated는 Worker claim RPC 실행 불가, service_role만 실행 가능, authenticated 사용자는 profiles.role UPDATE 불가.

**막힌 것**
- Vercel connector에서 `passmate-store` 프로젝트가 여전히 404로 조회되어 Supabase public env를 자동 입력할 수 없음.
- 실제 Auth 사용자 기반 own-row RLS와 NAS Worker `--once`는 다음 integration 단계에서 진행.

**다음 할 일**
- Vercel Supabase env 연결 후 Storefront DB catalog 조회 검증.
- 테스트 Auth 사용자 RLS 검증.
- NAS Worker service-role integration test.

## 2026-09-18 — Storefront Supabase Wiring

**한 일**
- Vercel connector의 환경변수 입력 기능/프로젝트 조회 문제를 우회하기 위해 Supabase **publishable** URL/key만 browser-safe public config로 연결.
- service-role secret은 GitHub/브라우저에 추가하지 않음.
- Storefront catalog adapter가 Supabase를 우선 조회하고, API 실패/빈 결과일 때 local catalog로 안전하게 fallback하도록 보강.
- 최신 코드 push 후 Vercel 상태 확인.

**막힌 것**
- 최신 Vercel deployment는 코드 오류가 아니라 Hobby plan **build-rate-limit** 상태로 실패 처리됨.
- 따라서 production build에서 `catalog source=supabase` 로그 확인은 rate limit 해제 후 재검증 필요.

**다음 할 일**
- Vercel build 제한 해제 후 production deployment 검증.
- 이후 Auth-user RLS / NAS Worker real integration test 진행.

## 2026-09-18 — V2 Customer Account Implementation

**한 일**
- V1/V1.5의 실환경 마지막 Gate는 보류하고 V2 고객 계정 구현 시작.
- Supabase browser client를 추가하고 이메일/비밀번호 로그인/회원가입 흐름 구현.
- 회원가입 metadata의 `name`을 기존 auth trigger가 `profiles.display_name`으로 생성하도록 연결.
- 비밀번호 재설정 요청/변경 페이지 구현.
- Header 로그인 상태 UI와 내 계정 profile 조회/수정/로그아웃 구현.
- `내 자료`를 실제 `entitlements` + 상품/버전 metadata 조회 UI로 교체.
- 구매 후 상품이 비활성화되어도 기존 구매자는 자료 metadata를 볼 수 있도록 V2 RLS migration 작성.
- browser-safe publishable key만 사용하는지 CI에서 검사하는 Auth guard 추가.
- 정적 export를 유지해 현재 Vercel 구조를 깨지 않고 Client Auth로 동작하도록 설계.

**막힌 것**
- 실제 이메일 확인/비밀번호 재설정 redirect는 Supabase Auth URL 설정과 Production 배포 확인이 필요.
- Vercel Hobby build-rate-limit 때문에 Production Auth 검증은 제한 해제 후 진행.

**다음 할 일**
- migration 0006 실제 적용 + Supabase Advisor 재검사.
- GitHub Actions build 확인.
- 실사용 테스트 회원으로 signup/login/RLS 검증 후 V2 종료 Gate 판단.

## 2026-09-18 — V2 RLS Applied & Auth Guard Fix

**한 일**
- `0006_v2_customer_account_rls.sql`을 PASSMATE Supabase에 실제 적용.
- 적용 후 Supabase Security Advisor 재검사 결과 **0 findings** 확인.
- V2 첫 배포 시 Auth CI guard가 공개 설정 파일의 설명 주석 `service-role` 문자열까지 secret으로 오탐하는 문제 발견.
- 실제 secret pattern만 검사하도록 guard를 수정해 설명 주석은 허용하고 `SUPABASE_SERVICE_ROLE_KEY`/service-role JWT 흔적만 차단하도록 보정.

**막힌 것**
- Vercel의 최신 build 결과는 Hobby 제한/배포 상태를 계속 확인해야 함.
- Production Auth redirect와 실제 회원 signup/login 검증은 배포 접근 가능 시 수행.

**다음 할 일**
- 수정 commit의 build 상태 확인.
- Production에서 signup/login/password reset/RLS 실사용 검증.

## 2026-09-18 — V3 Payment Contract Start

**한 일**
- 실제 PG를 아직 선택하지 않은 상태에서 V3를 provider-neutral contract로 시작.
- `payment_attempts` / `payment_events` schema 설계.
- provider + idempotency key, provider + event id unique constraint로 중복 요청/웹훅 중복 처리 방지.
- 브라우저가 주문을 paid로 바꿀 수 없도록 모든 payment RPC를 service_role only로 설계.
- `start_payment_attempt()`에서 주문 금액/상품 버전/로그인 사용자 조건을 서버에서 검증.
- `apply_payment_event()`에서 paid/failed/cancelled/refunded를 기존 order state machine과 연결.
- 결제 성공 시 entitlement grant 및 issuance enqueue를 같은 DB transaction 경계에서 수행.
- webhook raw body는 저장하지 않고 SHA-256 fingerprint만 저장하도록 개인정보 최소화.
- PG adapter TypeScript interface + JSON contract + CI validator 작성.

**막힌 것**
- 실제 PG 사업자 계정/테스트 키가 없으므로 Toss/PortOne 등 provider-specific API와 webhook signature 검증은 아직 연결하지 않음.
- Vercel Hobby build-rate-limit으로 Production checkout 연결 테스트는 보류.

**다음 할 일**
- migration 0007 live 적용 및 provider-neutral runtime test.
- Security Advisor 재검사.
- 실제 PG 후보 비교 후 하나를 선정해 sandbox adapter 구현.

## 2026-09-18 — V3 Payment Contract Live Verification

**한 일**
- `0007_v3_payment_contract.sql`을 PASSMATE Supabase에 실제 적용.
- provider-neutral runtime verification을 실행해 idempotent payment start, paid, duplicate event 무시, refund, failed, retry payment, cancel 흐름 통과.
- paid event에서 order가 `paid`가 되고 issuance queue가 `queued`로 연결되는 것까지 실제 DB에서 검증.
- refund event에서 order가 `refunded + revoked`로 전환되는 것 확인.
- Payment RPC 권한 검사 결과 anon/authenticated는 실행 불가, service_role만 실행 가능.
- Supabase Security Advisor 재검사 결과 **0 security findings**.

**막힌 것**
- 실제 PG가 아직 선정되지 않아 sandbox API / webhook signature 검증 / 실결제 UI는 미구현.
- Vercel Hobby build-rate-limit으로 최신 V2/V3 코드의 Production build는 보류.

**다음 할 일**
- Toss Payments / PortOne 등 실제 PG 후보를 비교해 1개 선정.
- 선택 provider의 sandbox adapter와 webhook verifier 구현.

## 2026-09-18 — V3.1 PortOne + NHN KCP Server Boundary

**한 일**
- 초기 운영비 최소화 방침에 따라 PortOne V2 + NHN KCP를 V3 1차 provider로 고정.
- 실제 외부 credential 없이 진행 가능한 서버 경계를 먼저 구현.
- 로그인 사용자/활성 상품/published version/DB 가격을 기준으로 주문+결제시도를 한 transaction에서 만드는 `create_direct_checkout()` RPC 작성.
- Supabase Edge Function `payment-start` 설계: JWT 사용자 검증 후 service-role RPC 호출, PortOne Store ID/Channel Key가 없으면 주문 생성 전에 fail-closed.
- Supabase Edge Function `payment-webhook` 설계: 외부 webhook body를 신뢰하지 않고 PortOne V2 API로 paymentId를 재조회한 결과만 DB에 반영.
- raw webhook body는 저장하지 않고 기존 payment event contract의 SHA-256 fingerprint만 사용.
- PortOne/KCP credential은 GitHub에 넣지 않고 Edge Function secret/env로만 주입하도록 문서화.

**막힌 것**
- PortOne Store ID, KCP Channel Key, V2 API Secret은 사용자 PortOne 콘솔에서 발급/확인이 필요.
- 실제 브라우저 결제창과 sandbox E2E는 credential 입력 후 가능.

**다음 할 일**
- migration 0008 실제 적용.
- payment-start / payment-webhook Edge Function deploy.
- Security Advisor 및 fail-closed 동작 확인.

## 2026-09-18 — V3.1 Edge Functions Live

**한 일**
- `0008_v3_direct_checkout.sql`을 PASSMATE Supabase에 실제 적용.
- `payment-start` Edge Function v1 배포 및 ACTIVE 확인. Supabase JWT 필수.
- `payment-webhook` Edge Function v1 배포 및 ACTIVE 확인.
- webhook은 외부 요청 특성상 gateway JWT를 사용하지 않고, PortOne V2 API에서 paymentId를 재조회한 결과만 신뢰하도록 설계.
- `create_direct_checkout()` 권한 검증: anon/authenticated 실행 불가, service_role만 실행 가능.
- 배포 후 Supabase Security Advisor **0 findings** 확인.
- PortOne Store ID / KCP Channel Key가 없으면 주문 생성 전에 중단하고, PortOne API Secret이 없으면 webhook 처리를 중단하는 fail-closed 경계 유지.

**막힌 것**
- PortOne Store ID / KCP Channel Key / V2 API Secret은 아직 미입력.
- 실제 카드 결제 sandbox는 PortOne 콘솔 접근 가능 시 진행.

**다음 할 일**
- credential 없이 가능한 Checkout UI shell 및 V4/V5 Storage/다운로드 계약 선행 작업.
- 콘솔 접근 가능해지면 PortOne credential 입력 → sandbox E2E.

## 2026-09-18 — V3 Checkout UI Shell

**한 일**
- PortOne V2 공식 Browser SDK CDN을 Checkout에 연결.
- 상품 상세 → \`/checkout/?product=<slug>\` 흐름으로 변경.
- 로그인 세션 확인 후에만 \`payment-start\` Edge Function을 호출하도록 Checkout Client 구현.
- Edge Function이 반환한 서버 검증 금액/주문명/Store ID/Channel Key만 결제창에 전달.
- PortOne 결제 요청에 \`redirectUrl\`을 지정해 모바일 리다이렉트와 PC Promise 반환을 모두 지원.
- \`/checkout/complete/\` 결과 화면 추가.
- 완료 화면은 브라우저 결제 응답을 구매 성공 근거로 사용하지 않고, 로그인 사용자가 조회 가능한 own order의 \`provider_order_id\` 상태를 polling하여 paid 여부를 판단.
- provider credential 미설정 또는 상품 version draft 상태에서는 기존 서버 fail-closed를 그대로 유지.
- Checkout browser code에 server-only secret이 들어가지 않는지 검사하는 CI guard 추가.

**막힌 것**
- PortOne Store ID / KCP Channel Key / V2 API Secret 미입력.
- PM-C2 \`2027-v1.0\`은 아직 draft라 실제 결제 시작은 의도적으로 차단.
- Vercel Hobby build-rate-limit으로 Production UI 확인은 보류.

**다음 할 일**
- V4/V5 private Storage + 다운로드 계약 선행 작업.
- 콘솔 접근 가능 시 PortOne credential 주입 후 sandbox E2E.

## 2026-09-18 — V5 Private Storage & Auto Download Prework

**한 일**
- 발행본 전용 private Supabase Storage bucket \`passmate-artifacts\` 계약 작성.
- PDF MIME only / 50 MiB limit / public=false 규칙 고정.
- 영구 public URL을 저장하지 않고 60초 signed URL만 서버에서 발급하는 다운로드 계약 작성.
- \`resolve_download_artifact()\` service-role RPC 설계: 로그인 사용자, active entitlement, paid source order, ready fulfillment, succeeded issuance job을 모두 확인해야 storage key를 반환.
- signed URL 발급 사실만 기록하는 \`download_events\` audit schema 추가. signed URL 원문은 저장하지 않음.
- JWT 기반 \`download-url\` Edge Function 구현.
- 내 자료 화면에 \`자료 준비 중 / 다운로드 가능 / PDF 다운로드\` 상태 및 버튼 추가.
- NAS용 \`SupabaseArtifactStore\` 구현: private bucket upload, immutable key, 재시도 시 기존 object SHA-256 검증, stale discard delete.
- V5 contract JSON + CI validator + Worker storage unit test 추가.

**막힌 것**
- 실제 NAS PDF 업로드 E2E는 NAS 접근 가능 시 수행.
- 현재 DB에는 실제 구매 Auth user/ready issuance artifact가 없어 고객 signed download 전체 E2E는 이후 진행.

**다음 할 일**
- migration 0009 실제 적용.
- download-url Edge Function deploy.
- bucket privacy / RPC privilege / Security Advisor 검증.

## 2026-09-18 — V5 Private Storage Live Foundation

**한 일**
- \`0009_v5_private_download.sql\` 실제 PASSMATE Supabase 적용 완료.
- private bucket \`passmate-artifacts\` 생성 확인: \`public=false\`, PDF only, 50 MiB.
- \`download-url\` Edge Function v1 배포 및 ACTIVE 확인. JWT required.
- \`resolve_download_artifact()\` 권한 검증: anon/authenticated 실행 불가, service_role만 실행 가능.
- \`download_events\`는 anon/authenticated SELECT 불가.
- \`storage.objects\`에 고객 직접 접근을 허용하는 policy가 없음을 확인.
- 적용 후 Supabase Security Advisor **0 findings** 확인.
- 현재 Supabase Edge Functions: payment-start / payment-webhook / download-url 모두 ACTIVE.

**막힌 것**
- 실제 발행 PDF object가 아직 없으므로 signed URL 실다운로드 E2E는 NAS Worker 실연동 이후 진행.
- 환불 후 재발급 차단 E2E도 실제 고객 fixture와 artifact가 준비된 뒤 진행.

**다음 할 일**
- NAS 접근 전에는 V7 Admin 선행 또는 V4 production Worker wiring을 계속 진행 가능.
- NAS 접근 가능 시 SupabaseArtifactStore upload → complete job → ready → download-url 전체 E2E.

## 2026-09-18 — V7 Admin Console Foundation

**한 일**
- 외부에서 진행 가능한 V7 관리자 콘솔 선행작업 시작.
- 관리자 권한을 UI 표시만으로 판단하지 않고 Browser role 확인 → Edge Function role 재확인 → DB admin actor 재확인의 3중 경계로 설계.
- 운영 Summary, 최근 주문, 발행 Job, 상품/버전 현황 조회 RPC 작성.
- \`retry_wait\`은 즉시 재시도 가능하게 하고, \`dead_letter\`는 기존 이력을 보존한 채 generation +1의 새 queued job을 만드는 안전한 재발행 방식으로 구현.
- generation 재발행 때문에 과거 dead-letter가 주문을 영구 failed로 고정하지 않도록 fulfillment aggregate를 artifact별 최신 generation 기준으로 변경.
- 구매 당시 버전이 이후 archived되어도 generation > 1 재발행은 가능하도록 issuance validation 보강. 최초 generation은 계속 published만 허용.
- \`admin_action_events\` audit 추가.
- \`/admin/\` 운영 UI, \`admin-data\`, \`admin-action\` Edge Function 작성.
- PG 실제 환불 버튼은 provider refund 성공 이전에 DB만 바뀌는 위험을 막기 위해 의도적으로 미구현.
- 상품 publish/가격 변경 mutation도 Release Gate를 우회할 수 있어 1차 V7에서는 조회만 제공.

**막힌 것**
- 현재 PASSMATE Auth user가 없어 실제 admin/customer 계정 권한 E2E는 아직 불가.
- NAS가 없어 실제 dead-letter fixture 기반 재발행 E2E는 이후 진행.

**다음 할 일**
- migration 0010 live 적용.
- admin-data / admin-action Edge Function 배포.
- Security Advisor 및 service-role-only privilege 검증.

## 2026-09-18 — V7 Admin Live Foundation

**한 일**
- \`0010_v7_admin_ops.sql\`을 PASSMATE Supabase에 실제 적용.
- \`admin-data\`, \`admin-action\` Edge Function v1 배포 및 둘 다 ACTIVE/JWT required 확인.
- Admin RPC 권한 검사: anon/authenticated 실행 불가, service_role만 실행 가능.
- \`admin_action_events\` 고객 직접 SELECT 차단 확인.
- Supabase Performance Advisor가 지적한 \`admin_action_events.actor_user_id\`, \`download_events.issuance_job_id\` FK covering index를 \`0011_v7_admin_indexes.sql\`로 보완.
- V7 runtime verification 통과:
  - 임의/non-admin actor가 Admin RPC 사용 시 DB에서 거절.
  - 과거 G1 dead-letter + 최신 G2 queued일 때 order fulfillment가 queued로 정상 복귀.
  - 구매 당시 정확한 버전이 archived된 뒤에도 generation > 1 재발행 가능.
- 적용 후 Supabase Security Advisor **0 findings**.
- Performance Advisor는 현재 신규/저사용 DB 특성의 unused-index INFO만 남고 unindexed FK 경고는 해소.

**막힌 것**
- 현재 PASSMATE Auth user가 0명이므로 실제 admin/customer 계정 브라우저 E2E는 아직 진행 불가.
- 실제 dead-letter/retry-wait 버튼 E2E는 운영용 Auth admin + 테스트 job이 준비된 뒤 수행.

**다음 할 일**
- PC/계정 접근 가능 시 사용자 Admin 계정 생성/role 지정 후 \`/admin/\` 실제 접근 검증.
- NAS 접근 가능 시 실제 실패 job을 대상으로 Admin 재시도 → Worker 처리까지 E2E.

## 2026-09-18 — V4 Production Worker Wiring

**한 일**
- 기존 reference Worker에서 실제 production path를 분리하고 `PASSMATE_PROCESSOR_MODE=disabled|reference|production` 명시형 모드 도입.
- 기본값을 `disabled`로 두어 새 NAS 환경이 preflight 전에 Queue를 claim하지 못하도록 fail-closed.
- production mode에서 `ProductionPdfProcessor → PypdfRewriteTransformer → SupabaseArtifactStore`를 실제 Worker main에 연결.
- pypdf 6.19.0을 고정하고 MASTER PDF를 clone/rewrite한 뒤 출력 parse/page-count를 재검증하도록 구현.
- V4 transformer에는 고객별 식별정보를 넣지 않고 generic Producer metadata만 사용. 내부 발행 식별은 V6 책임으로 분리.
- MASTER PDF를 version directory에 복사하고 SHA-256 manifest를 원자적으로 생성/검증하는 `master_tool init/verify` 추가.
- Worker node heartbeat schema/RPC 작성: worker/instance/mode/version/last_seen/current_job.
- Docker를 non-root + read-only rootfs + cap_drop ALL + no-new-privileges + tmpfs로 하드닝.
- Worker CI가 pypdf dependency를 설치한 뒤 compile/unit test를 실행하도록 갱신.
- production transformer/config/wiring/MASTER tool 테스트 추가.
- pypdf는 2026-09-16 공개된 6.19.0으로 pin.

**막힌 것**
- 실제 NAS가 현재 접근 불가하여 Docker preflight, PM-C2 real MASTER verify, service-role `--once`는 아직 실행 불가.
- 실제 발행 artifact가 없으므로 V5 signed download와 연결한 물리 E2E는 이후 진행.

**다음 할 일**
- migration 0012 실제 Supabase 적용 + runtime/권한/Security Advisor 검증.
- GitHub Actions Worker CI 확인.
- NAS 접근 가능 시 real MASTER → --once → private Storage → ready → signed download E2E.

## 2026-09-18 — V4 Worker Runtime Live Verification

**한 일**
- `0012_v4_worker_runtime.sql`을 PASSMATE Supabase에 실제 적용.
- `report_worker_node()` runtime verification 통과: production worker heartbeat row 생성/검증/cleanup.
- 권한 검사 결과 `report_worker_node()`는 anon/authenticated 실행 불가, service_role만 실행 가능.
- `worker_nodes` 테이블도 anon/authenticated 직접 SELECT 불가.
- 적용 후 Supabase Security Advisor **0 findings**.
- Performance Advisor는 신규 DB 특성의 unused-index INFO만 남음.
- 로컬 환경의 pypdf 5.9.0으로도 동일 clone/rewrite API를 별도 확인해 2페이지 보존, Producer 변경, MASTER와 byte-different 출력 확인. 배포 pin은 pypdf 6.19.0.

**막힌 것**
- GitHub connector가 push-triggered Workflow run을 직접 조회하지 못해 Worker Actions의 최종 green 상태는 별도 확인 필요.
- 실NAS preflight / 실제 MASTER / service-role Worker E2E는 NAS 접근 가능 시 진행.

**다음 할 일**
- NAS 접근 가능 시 `--check-config` → `master_tool verify` → `--once` 순서로 실환경 Gate 진행.
- 성공 artifact를 V5 `download-url`까지 이어서 전체 자동 발행/다운로드 E2E 수행.

## 2026-09-18 — V6 Internal Issuance Management

**한 일**
- 성공한 발행 Job의 결과를 별도 내부 Registry로 보존하는 `issuance_artifacts` 설계.
- Registry에는 고객 PII 없이 internal_ref, job/order/item/product/version, generation, private storage key, SHA-256, size만 기록.
- Job 성공 시 Registry 자동 등록, 새 generation 성공 시 이전 active artifact를 superseded로 전환하는 trigger 작성.
- 주문 환불 시 해당 order의 발행 기록을 revoked로 전환하는 lifecycle 동기화 추가.
- `issuance_artifact_events` audit 추가.
- Admin에서 발행 기록 목록을 조회하는 RPC와 UI 추가.
- Admin 무결성 확인 기능 작성: signed URL 없이 service-role로 private Storage object를 직접 읽고 SHA-256/size를 Registry와 비교.
- 결과를 verified/mismatch/unavailable로 저장하고 artifact event + admin action audit에 기록.
- customer 내 자료/다운로드 코드에 V6 Registry 내부 필드가 들어가면 실패하는 CI guard 추가.
- 고객 다운로드 권한은 기존 entitlement/order/job gate를 그대로 유지하고 V6 Registry가 권한 source of truth가 되지 않도록 분리.

**막힌 것**
- 실제 Storage artifact가 아직 없어 private object 무결성 확인 E2E는 NAS 발행 이후 진행.
- 실제 Admin Auth user가 없어 브라우저 Admin 버튼 E2E는 이후 진행.

**다음 할 일**
- migration 0013 live 적용 및 lifecycle runtime verification.
- admin-data/admin-action Edge Function V6 버전 배포.
- Security Advisor / RPC 권한 재검증.

## 2026-09-18 — V6 Internal Issuance Registry Live Verification

**한 일**
- `0013_v6_issuance_registry.sql`을 PASSMATE Supabase에 실제 적용.
- `admin-data`, `admin-action` Edge Function을 V6 기능 포함 v2로 갱신 배포, 둘 다 ACTIVE/JWT required 확인.
- 첫 runtime verification에서 test fixture가 order fulfillment를 `queued`로 직접 시작해 기존 state machine의 `queued → ready` 금지 규칙과 충돌하는 테스트 설계 오류를 발견.
- fixture를 실제 Worker 처리 중 상태인 `issuing`으로 맞춰 재실행 후 검증 통과.
- 실제 DB에서 generation 1 성공 → active, generation 2 성공 → G1 superseded/G2 active, order refund → 모든 artifact revoked 동작 확인.
- non-admin actor의 Registry Admin RPC 거절 확인.
- Admin Registry/Integrity RPC 권한: anon/authenticated 실행 불가, service_role only 확인.
- `issuance_artifacts`, `issuance_artifact_events` 고객 직접 조회 차단 확인.
- Performance Advisor가 지적한 order_item/product_version FK covering index를 `0014_v6_registry_indexes.sql`로 보완.
- 적용 후 Supabase Security Advisor **0 findings**.
- runtime test 종료 후 artifact/event/product fixture가 모두 0개로 cleanup된 것 확인.

**막힌 것**
- 실제 private Storage artifact가 아직 없어서 Admin의 실제 object SHA-256/size 비교 E2E는 NAS 발행 후 진행.
- 실제 Admin Auth user가 아직 없어 브라우저 `/admin/` 무결성 확인 버튼 E2E는 이후 진행.

**다음 할 일**
- NAS 접근 가능 시 V4 실제 `--once` 발행으로 V6 Registry 실데이터 생성.
- 같은 artifact를 Admin 무결성 확인 → V5 고객 다운로드까지 한 번에 E2E.

## 2026-09-18 — Full Repository / Live DB Code Review

**한 일**
- Next storefront/Auth/Checkout/Library/Admin, Supabase migrations 0001~0014, Edge Functions, NAS Worker, Storage, tests/CI를 전면 검토.
- live Supabase의 function/table privileges와 RLS policy를 직접 재점검. Security Advisor는 0 findings 유지.
- 현재 공식 Next/Supabase/PortOne/pypdf 문서와 구현 가정을 교차 확인.
- V8 출시 전 막아야 할 P0 3건 발견:
  1. stale Worker discard가 재claim Worker가 성공시킨 동일 Storage key를 삭제할 수 있는 race.
  2. entitlement unique(user, product) + paid upsert 때문에 재구매 후 최신 주문 환불 시 과거 정상 구매 권한도 revoke될 수 있음.
  3. Checkout UI는 PM-C2/6,900원을 하드코딩하지만 실제 charge amount/product는 live DB에서 오므로 가격/상품 표시와 청구가 달라질 수 있음.
- P1로 payment idempotency, browser payment reconciliation, webhook signature/currency/store validation, admin direct DML/hard-delete, Supabase legacy server key migration, catalog fail-closed, MASTER immutability를 식별.
- 상세 보고서를 `docs/CODE_REVIEW_2026-09-18.md`에 기록.

**확인된 강점**
- 서비스 RPC 권한 분리, customer RLS, profile role escalation 방지, private Storage/signed URL, order/fulfillment state machine, queue lease/retry/dead-letter, V6 lifecycle은 전반적으로 잘 방어됨.
- Next 15.5.24와 pypdf 6.19.0은 현재 확인한 보안 패치 수준에 맞음.

**막힌 것**
- 최신 main Vercel status는 여전히 Hobby build-rate-limit failure라 Production build 결과는 Vercel로 확인 불가.
- 실제 Auth/NAS/PortOne credential E2E는 외부 접근 제약 때문에 별도 Gate로 남음.

**다음 할 일**
- 새 기능 추가보다 P0 3건을 먼저 수정.
- P0 이후 payment/admin P1을 정리한 뒤 실환경 E2E 진행.
## 2026-09-18 — P0 fixes and live verification

The three release-blocking findings from the full code review are now closed in code, regression tests, and the live Supabase project.

- Worker lease-loss handling no longer discards a deterministic published Storage object after a stale completion or rejected completion. The race test proves that a successor Worker’s artifact remains available.
- Entitlements are now order-scoped (`user_id + source_order_id + product_id + product_version_id`). Duplicate paid/refund events are idempotent, a repurchase creates a separate grant, and refunding the later order preserves an earlier paid grant. Library selection deduplicates product/version cards and prefers a paid, ready grant.
- Checkout receives title, product code, version, and amount from the authenticated `payment-start` response, renders that exact amount, and requires an explicit confirmation immediately before PortOne. The browser cannot provide the amount or title.

Live verification:

- Applied `20260918103548_preserve_entitlements_per_order`, `20260918103825_fix_entitlement_grant_null_type`, and `20260918103840_verify_p0_entitlement_order_grants`.
- Runtime duplicate/repurchase/refund verification passed; all test fixtures were removed.
- `payment-start` is ACTIVE version 2 with JWT verification enabled; an unauthenticated request returns 401.
- Supabase Security Advisor is clean (0 findings).

Local verification passed: `npm run build`, all 28 Worker tests, and Deno type checking for `payment-start`.

The remaining launch gate is real NAS + authenticated account + PortOne sandbox E2E. Do not place server keys in Git or chat.

## 2026-09-18 — Payment P1 hardening

**한 일**
- P1-1 end-to-end checkout idempotency 구현. 같은 provider + idempotency key 재시도는 새 주문을 만들지 않고 기존 order/payment_attempt/merchant paymentId를 반환하며, transaction advisory lock으로 동시 재시도 race를 직렬화.
- Checkout 페이지가 한 logical checkout 동안 동일 idempotency key를 재사용하도록 변경하고 replay/cross-user regression SQL을 추가.
- PASSMATE live Supabase에 `payment_p1_idempotent_checkout` migration 적용 및 verification migration 통과. `payment-start` v3 ACTIVE/JWT required.
- P1-2 authenticated `payment-sync` Edge Function 추가. 결제 완료 페이지가 browser 결과를 신뢰하지 않고 구매자 JWT로 서버 reconciliation을 호출한 뒤 PortOne 결제 정보를 재조회.
- sync와 webhook이 같은 결제 상태를 서로 다른 event id로 보고해도 `apply_payment_event()`가 `already_applied`로 수렴하도록 보강하고 paid/refund convergence verification 통과.
- P1-3 `payment-webhook`에 PortOne Standard Webhooks HMAC 검증, expected Store ID, KRW, authoritative amount 검증, partial cancellation/manual-review 경로 추가.
- 공식 PortOne JS SDK 동작을 재확인해 `Webhook.verify()`가 payload를 반환하지 않는 점과 Deno `Headers`를 plain record로 변환해야 하는 점을 수정. `payment-webhook` v3 ACTIVE.
- `payment-sync` v1 ACTIVE/JWT required, `payment-webhook` v3 ACTIVE/custom signature auth.
- Payment P1 live DB verification 후 Supabase Security Advisor 0 findings.
- Next.js 타입체크가 Deno Edge Function을 Node module로 해석하던 CI 경계를 분리해 `supabase/functions/**`를 Next tsconfig에서 제외.

**막힌 것**
- PortOne 실제 Store ID / KCP Channel Key / API Secret / Webhook Secret 설정 상태를 도구로 읽을 수 없어 실제 signed webhook 및 sandbox 결제 E2E는 아직 미실행.
- 공개 판매 전에는 PortOne에 webhook URL을 등록하고 결제 성공/실패/취소/환불을 실제 sandbox에서 확인해야 함.
- NAS는 MASTER PDF가 없고, 다음 실행 전 PASSMATE Supabase project ref(`fmecqeadghrdisirucqm`)와 일치하는 URL/key로 환경을 다시 맞춰야 함.

**다음 할 일**
- GitHub Build CI 최종 green 확인.
- PortOne credential + webhook secret 설정 및 sandbox E2E.
- 이어서 Admin direct DML/hard-delete P1 제거.

## 2026-09-18 — Remaining P1 hardening

**한 일**
- Admin direct DML P1 live 적용: authenticated 관리자에게 남아 있던 products/product_versions/orders/order_items/entitlements의 INSERT/UPDATE/DELETE 정책과 권한 제거.
- commercial/payment/issuance/audit 14개 핵심 테이블에 runtime DELETE/TRUNCATE 차단 trigger를 적용하고 service_role DELETE/TRUNCATE 권한도 제거.
- live verification 결과 legacy admin mutation policy 0개, hard-delete guard 28개 trigger, fixture cleanup 0건. Security Advisor 0 findings.
- Storefront catalog를 fail-closed로 변경. Supabase 오류/비정상 payload/active product 0건에서 로컬 catalog가 자동으로 판매상품을 부활시키지 않으며, 명시적 `PASSMATE_ALLOW_LOCAL_CATALOG_FALLBACK=true`만 개발 escape hatch로 허용.
- static product slug 생성도 local JSON이 아니라 authoritative catalog source를 사용하도록 변경.
- MASTER registration을 immutable로 변경. 이미 `master.pdf` 또는 `manifest.json`이 있는 product/version은 init overwrite를 거부하며 변경된 PDF는 새 version을 요구. Worker regression test 추가.
- Supabase modern API key migration: Edge Function 6개를 pinned `@supabase/server@1.7.0` context로 전환하여 legacy `SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` 참조 제거.
- live Edge 재배포: payment-start v4, payment-sync v2, payment-webhook v4, download-url v2, admin-data v3, admin-action v3 모두 ACTIVE.
- NAS Worker는 `SUPABASE_SECRET_KEY=sb_secret_...`를 우선 사용하고 modern secret에는 `apikey`만 전송하도록 변경. production mode에서 legacy service_role key 사용을 거부하도록 Gate 추가.
- modern-key CI guard 추가. Worker CI green, catalog/MASTER 변경 Build+Worker CI green.
- 현재 Vercel 계정을 직접 조회한 결과 PASSMATE 프로젝트는 없고 `led-stage-editor`만 존재함을 확인.

**막힌 것**
- NAS의 실제 `worker/.env`에는 아직 modern PASSMATE secret을 직접 넣지 않았음. Secret 값은 채팅/Git에 노출하지 않고 Dashboard에서 확인해 NAS에 직접 입력해야 함.
- PortOne Store/KCP/API/Webhook secret 및 sandbox E2E는 외부 연동 Gate로 남음.
- Vercel에 PASSMATE 프로젝트가 현재 연결되어 있지 않아 production deployment/env 검증 불가.
- MASTER 실제 PDF가 아직 없어 NAS 발행 E2E는 대기.

**다음 할 일**
- Vercel PASSMATE 프로젝트 Import/연결.
- PortOne + Auth sandbox E2E.
- NAS PASSMATE URL + modern secret 교체 후 MASTER verify → production --once.


## 2026-09-19 — Stage Sound Test Product Preview

**한 일**
- 무대음향 3급 핵심요약 패키지를 실제 Supabase catalog에 테스트 상품으로 등록.
- `PM-SS3-CORE` / 5,900원 / `2026-v0.1-test` draft로 생성하고 `is_active=false`로 공개 차단.
- Admin 상품 카드에 비공개 상품 Preview 링크 추가.
- 관리자 로그인 + admin role + RLS를 통과한 경우에만 비활성 상품 상세/버전을 직접 조회하는 Preview 화면 추가.
- 무대음향 핵심요약 Light Theme 표지를 CSS 기반 Preview로 추가.
- 공개 상품 카드/상세도 추후 활성화 시 무대음향 CORE 표지를 동적으로 렌더링할 수 있도록 준비.
- 기존 상품목록의 CORE/CRAM/SHEET 문구를 현재 고정 상품 구조에 맞게 수정.

**막힌 것**
- 최신 Vercel commit status가 현재 pending이라 브라우저 Preview E2E는 build 완료 후 확인 필요.
- Vercel connector의 프로젝트 목록에는 여전히 passmate-store가 직접 노출되지 않아 배포 상세 조회에 제약이 있음.

**다음 할 일**
- Vercel build 완료 확인.
- 관리자 계정으로 `/admin/products/PM-SS3-CORE/preview/` 실제 접근 및 PC/모바일 확인.
- Preview 승인 후 테스트 PDF를 연결하고 구매 → entitlement → Library → download E2E 진행.


## 2026-09-19 — Owner Admin Dashboard

**한 일**
- 카카오 `jhpodong@naver.com` 계정을 PASSMATE 유일 관리자 계정으로 지정.
- live Supabase에서 해당 Kakao user의 profile role을 admin으로 승격하고 다른 계정은 customer 유지.
- DB의 `private.is_admin()`, `private.assert_admin_actor()`를 지정 Kakao 계정 검증과 결합.
- 다른 계정이 admin role을 얻는 것을 막는 profiles trigger 추가.
- 헤더와 내 계정에 관리자 전용 대시보드 진입 버튼 추가.
- 기존 운영자용 표/로그 중심 `/admin/`을 상품·주문·발행 중심의 쉬운 대시보드로 재설계.
- 무대음향 3급 테스트 상품 Preview를 첫 번째 빠른 작업으로 배치.
- 상품/주문/발행/Library/스토어 바로가기와 요약 KPI 카드 추가.
- 고급 발행/무결성 정보는 별도 펼침 영역으로 내려 초보 운영 화면을 단순화.

**막힌 것**
- 최신 Vercel status가 현재 pending이라 Production 브라우저 E2E는 build 완료 후 확인 필요.
- Supabase Security Advisor는 DB/RLS 취약점 대신 계정 전체 설정의 Leaked Password Protection 비활성 WARN 1건을 표시. 현재 지정 관리자는 Kakao OAuth 계정이지만 이메일/비밀번호 사용자 보호 강화를 위해 후속 설정 가능.

**다음 할 일**
- Vercel build 완료 확인.
- `jhpodong@naver.com` 카카오 로그인으로 `/admin/` 진입 및 PC/모바일 화면 확인.
- 대시보드에서 PM-SS3-CORE 미리보기 승인 후 테스트 PDF 연결 → 구매 → Library → 다운로드 E2E.
