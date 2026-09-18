# PASSMATE Store V0.1

PASSMATE 자사몰의 고객용 웹스토어 기반입니다.

## Included
- Next.js storefront using PASSMATE Concept B brand colors
- Home, product list/detail, library placeholder, checkout placeholder
- Responsive desktop/mobile layout
- Supabase schema and NAS issuance worker scaffold kept as back-office infrastructure
- No AI API required for customer PDF issuance

## Public UI principle
고객 화면에는 학습 효용과 상품 정보만 노출합니다. 내부 발행·추적·보호 인프라는 마케팅 메시지나 내비게이션에 표시하지 않습니다.

## Local development
```bash
npm install
npm run dev
```
Open http://localhost:3000

## Current intentional limitations
- 실제 결제 미연동
- Supabase 프로젝트 미연결
- 로그인 미연동
- 실제 MASTER PDF 미등록
- 다운로드 스토리지 미연결

## Deploy
GitHub `Delightfilm/PASSMATE-Store` -> Vercel 자동 배포를 기준으로 운영합니다.

## Project docs
- [Final Roadmap](docs/ROADMAP.md)
- [Current Status](docs/STATUS.md)
- [Session Log](docs/SESSION_LOG.md)
- [V1 Supabase migration](supabase/migrations/0001_v1_core.sql)
