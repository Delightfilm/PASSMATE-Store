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
- [x] PASSMATE 전용 Supabase organization 생성
- [x] PASSMATE 전용 Supabase 프로젝트 접근 확인 (`fmecqeadghrdisirucqm`)
- [x] V1/V1.5 migrations 0001~0004 적용 상태 확인
- [x] PM-C2 seed 실제 적용 확인
- [x] V1 schema/RLS smoke test 통과
- [x] Order + issuance runtime contract verification 통과
- [x] Supabase security advisor 0 findings
- [x] Worker RPC service-role only 권한 검증
- [x] 고객 role self-escalation 차단 검증
- [ ] 테스트 Auth 사용자 기준 own-row 조회 검증
- [x] Storefront Supabase public config 연결 (publishable key only)
- [ ] Production deployment에서 Supabase catalog source 확인

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
- [x] PASSMATE Supabase에서 migrations 0003~0004 실제 적용 확인
- [x] DB illegal transition / retry / stale completion 실제 검증
- [x] NAS Queue RPC 권한 및 runtime contract 검증
- [ ] NAS Worker를 실제 Supabase service-role credential로 `--once` integration test

## Next Priorities

1. Vercel Hobby build-rate-limit 해제 후 최신 배포 확인
2. Production deployment 로그에서 Supabase catalog source 확인
3. 테스트 Auth 사용자 own-row/RLS 검증
4. NAS Worker 실제 Supabase `--once` integration test
5. Production storage adapter 설계
6. Payment Provider contract 설계


## Blocker

Supabase 프로젝트는 project ref로 직접 접근 가능해져 DB 작업 blocker는 해소됨.

현재 남은 외부 연동 blocker:
- Vercel connector에서는 아직 `passmate-store` 프로젝트가 404로 조회되어 환경변수 자동 입력 불가
- browser-safe Supabase URL/publishable key fallback을 코드에 연결해 이 blocker는 우회했으나, 최신 Vercel 배포는 Hobby build-rate-limit으로 지연/실패 상태
- NAS 실제 integration test는 service-role secret을 NAS Worker 환경에 주입해야 실행 가능

참고: 현재 PASSMATE Supabase 프로젝트 region은 **ap-northeast-1 (Tokyo)** 이다. 기존 계획의 Seoul(ap-northeast-2)과 다르므로 region 변경이 필요하면 별도 프로젝트 migration으로 처리해야 한다.
