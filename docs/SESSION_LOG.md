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
