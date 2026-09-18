# PASSMATE Current Status

Last updated: 2026-09-18

## Current Version

**V1 — 회원·상품·주문 DB 기반 구축 중**

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

## Next Priorities

1. PASSMATE 전용 Supabase organization 생성
2. passmate-prod 프로젝트 생성 (Seoul)
3. V1 migrations + seed 적용
4. smoke test / RLS 검증
5. Vercel 환경변수 연결
6. Storefront Supabase catalog 연결

## Blocker

PASSMATE는 DF-AUTOSYNC organization과 분리해서 운영하기로 확정.
현재 연결된 Supabase 계정에서 확인되는 organization은 **DF-AUTOSYNC** 하나뿐이며, 현재 도구에서는 새 organization 생성 기능을 제공하지 않음.

필요 조치:
1. Supabase Dashboard에서 PASSMATE 전용 organization 생성
2. 생성 후 organization이 커넥터에 보이는지 확인
3. 해당 organization 안에 PASSMATE 프로젝트 생성
