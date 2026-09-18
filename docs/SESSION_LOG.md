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
