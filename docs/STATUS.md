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

- [x] V1 데이터 모델 초안 확정
- [x] Supabase migration 파일 작성
- [ ] PASSMATE 전용 Supabase 프로젝트 생성
- [ ] V1 migration 실제 적용
- [ ] RLS 정책 검증
- [ ] 테스트 상품 생성
- [ ] 테스트 사용자 기준 조회 검증
- [ ] Vercel 환경변수 연결
- [ ] Storefront에서 Supabase 상품 데이터 조회

## Next Priorities

1. PASSMATE 전용 Supabase 프로젝트 생성
2. V1 migration 적용
3. RLS/테이블 검증
4. 제품 seed 입력
5. Storefront Supabase 연결

## Blocker

Supabase 새 프로젝트 생성 전, 사용할 organization 확인이 필요함.
현재 연결 계정에서 확인된 organization: **DF-AUTOSYNC**
