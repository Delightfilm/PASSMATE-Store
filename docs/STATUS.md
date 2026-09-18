# PASSMATE Current Status

Last updated: 2026-09-18

## Current Version

**V1 + V1.5 — Supabase 기반 준비와 주문 상태 머신 병행 구축 중**

## Completed

### V0 ✅
- PASSMATE 브랜드명 확정
- Concept B 로고 방향 확정
- GitHub `Delightfilm/PASSMATE-Store` 연결
- Vercel `passmate-store` 연결
- 반응형 Storefront 구현
- 고객 화면에서 내부 보안/발행 기술 표현 제거
- Next.js 빌드 검증
- Vercel Production 배포 성공

## V1 Progress

- [x] V1 데이터 모델 확정
- [x] Supabase core migration 작성
- [x] RLS/권한 하드닝 반영
- [x] PM-C2 초기 catalog seed SQL 준비
- [x] V1 schema/RLS smoke test SQL 준비
- [x] Storefront catalog JSON 단일 소스화
- [x] Catalog CI validation 추가
- [x] Supabase catalog adapter 구현 (env 미설정 시 local fallback)
- [x] Home / 상품목록 / 상품상세를 catalog adapter에 연결
- [x] Supabase Setup Runbook 작성
- [ ] PASSMATE 전용 Supabase organization 생성
- [ ] PASSMATE 전용 Supabase 프로젝트 생성
- [ ] V1 migrations 실제 적용
- [ ] RLS 정책 실제 검증
- [ ] PM-C2 seed 실제 적용
- [ ] 테스트 사용자 기준 조회 검증
- [ ] Vercel 환경변수 연결
- [ ] Storefront에서 Supabase 상품 데이터 조회

## V1.5 Order State Machine Progress

- [x] 주문/결제 상태와 자료 발행 상태 분리
- [x] Order transition contract 작성
- [x] Fulfillment transition contract 작성
- [x] TypeScript 상태/라벨 helper 작성
- [x] state_version optimistic concurrency 규칙 추가
- [x] order_state_events audit trail 설계
- [x] DB transition enforcement migration 작성
- [x] SQL state-machine smoke test 작성
- [x] CI contract validation 추가
- [x] NAS issuance job contract 작성
- [x] Atomic claim / lease / heartbeat / retry / dead-letter RPC migration 작성
- [x] Job audit trail / refund cancellation 설계
- [x] Multi-item order aggregation 규칙 반영
- [x] NAS queue SQL smoke test 작성
- [x] NAS job contract CI validation 추가
- [x] NAS Worker reference implementation
- [x] Supabase RPC client
- [x] lease heartbeat thread
- [x] guarded reference processor (default disabled)
- [x] Dockerfile / docker-compose scaffold
- [x] Python unit tests + Worker CI
- [x] NAS deployment runbook
- [ ] PASSMATE Supabase에서 migrations 0003~0004 실제 적용
- [ ] DB illegal transition 차단 실제 검증
- [ ] NAS Worker가 fulfillment transition 계약을 사용하도록 연결

## Next Priorities

1. PASSMATE 전용 Supabase organization 생성
2. V1/V1.5 migrations(0001~0003) 실제 적용
3. order state SQL smoke test 실행
4. passmate-prod 프로젝트/Storefront 연동 검증
5. NAS Worker 실제 Supabase integration test
6. Production storage adapter 설계
7. Payment Provider contract 설계


## Blocker

PASSMATE는 DF-AUTOSYNC organization과 분리해서 운영하기로 확정.
사용자가 PASSMATE 전용 Supabase organization 생성을 완료했다고 보고했으나, 현재 연결된 Supabase connector의 organization 목록에는 아직 **DF-AUTOSYNC**만 표시됨.

필요 조치:
1. Supabase connector가 새 PASSMATE organization을 인식하는지 재확인
2. 인식되는 즉시 해당 organization에 `passmate-prod` 생성
3. migrations 0001~0004 + smoke tests 적용
