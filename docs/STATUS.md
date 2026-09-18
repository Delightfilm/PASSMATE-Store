# PASSMATE Current Status

Last updated: 2026-09-18

## Current Version

**V3 — 결제 기반 구현 중 (V1/V1.5/V2 실환경 종료 Gate 병행 보류)**

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

## V2 Customer Account Progress

- [x] Supabase browser Auth client
- [x] 이메일/비밀번호 로그인
- [x] 회원가입 + display_name profile 연동
- [x] 이메일 확인 redirect 처리 기반
- [x] 비밀번호 재설정 요청/변경 화면
- [x] 로그인 상태 Header UI
- [x] 내 계정 profile 조회/이름 수정/로그아웃
- [x] 내 자료 entitlement 조회 UI
- [x] 구매 후 비활성 상품도 본인이 metadata를 볼 수 있는 RLS migration
- [x] Auth public-config CI guard
- [x] Supabase migration 0006 실제 적용
- [x] migration 0006 적용 후 Security Advisor 0 findings
- [ ] Supabase Auth Redirect URL production 설정 확인
- [ ] 실제 테스트 회원 가입/로그인
- [ ] 실제 사용자 own-row RLS 검증
- [ ] Production Vercel에서 Auth flow 검증

## V3 Payment Progress

- [x] PG 독립 Payment Provider contract
- [x] payment_attempts / payment_events DB schema
- [x] provider + idempotency key 중복 방지
- [x] provider event 중복 처리 방지
- [x] 결제 금액/통화 서버 검증
- [x] pending → paid/failed/cancelled DB transition 연결
- [x] paid → refunded DB transition 연결
- [x] paid 시 entitlement grant + issuance enqueue 경계
- [x] direct order는 로그인 사용자 필수 규칙
- [x] raw webhook payload 비저장, SHA-256 fingerprint만 보관
- [x] Payment RPC service-role only
- [x] Payment contract CI validator
- [x] Supabase migration 0007 실제 적용
- [x] V3 provider-neutral runtime verification 통과
- [x] Payment RPC anon/authenticated 차단 + service_role only 검증
- [x] migration 0007 적용 후 Security Advisor 0 findings
- [ ] 실제 PG 선정
- [ ] 실제 PG adapter 구현
- [ ] PG sandbox 결제 승인/실패/취소/환불 E2E
- [ ] 실제 webhook signature 검증

## Next Priorities

1. 실제 PG 후보/수수료/개발 난이도 비교 후 provider 선정
2. 선택한 PG sandbox adapter + webhook signature 검증 구현
3. Vercel 제한 해제 후 V2/V3 Production UI 검증
4. 실제 회원가입/로그인 + own-row RLS 검증
5. NAS Worker 실제 Supabase `--once` integration test
6. V3 sandbox 결제 → paid → entitlement → issuance E2E


## Blocker

Supabase 프로젝트는 project ref로 직접 접근 가능해져 DB 작업 blocker는 해소됨.

현재 남은 외부 연동 blocker:
- Vercel connector에서는 아직 `passmate-store` 프로젝트가 404로 조회되어 환경변수 자동 입력 불가
- browser-safe Supabase URL/publishable key fallback을 코드에 연결해 이 blocker는 우회했으나, 최신 Vercel 배포는 Hobby build-rate-limit으로 지연/실패 상태
- NAS 실제 integration test는 service-role secret을 NAS Worker 환경에 주입해야 실행 가능

참고: 현재 PASSMATE Supabase 프로젝트 region은 **ap-northeast-1 (Tokyo)** 이다. 기존 계획의 Seoul(ap-northeast-2)과 다르므로 region 변경이 필요하면 별도 프로젝트 migration으로 처리해야 한다.
