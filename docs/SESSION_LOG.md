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
