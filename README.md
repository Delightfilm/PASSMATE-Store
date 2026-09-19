# PASSMATE Store

PASSMATE는 자격증 학습용 디지털 PDF를 판매하고, 결제부터 구매권한·NAS 발행·비공개 다운로드까지 자동화하는 자사몰 프로젝트입니다.

## Current stack

- Next.js static storefront
- Supabase Auth / Postgres / RLS / Storage / Edge Functions
- PortOne V2 + NHN KCP
- UGREEN NAS Docker Worker
- Vercel deployment
- GitHub CI / contract validation

## Current state

현재는 **출시 전 통합 검증 단계**입니다.

구현된 주요 기반:

- Email + Google/Kakao Auth
- 상품/버전/주문/entitlement 데이터 모델
- PortOne checkout / payment sync / signed webhook
- Private Storage + signed download
- NAS issuance queue/lease/heartbeat/PDF processor
- Internal issuance registry/integrity
- SmartStore형 관리자 Workspace
- 상품 create/edit/Preview
- Cart/package selection UI prototype

아직 공개 판매 Gate는 열지 않습니다.

남은 핵심:

1. PortOne sandbox paid E2E
2. Cart/package 구조를 고정 2-SKU 모델과 정합화
3. NAS 실제 Worker 연결
4. 실제 MASTER PDF 발행
5. 구매 → Library → download → refund/revoke E2E
6. 무대음향 3급 콘텐츠 최종 QA

## Product model

판매 선택지는 2개만 운영합니다.

- **핵심요약 패키지 — 기본 출시가 5,900원**: CORE + SHEET + CHECK
- **합격팩 — 기본 출시가 9,900원**: PASS PACK + CORE + SHEET + CHECK

운영 가격은 관리자 페이지에서 SKU별로 변경하며, 실제 신규 주문 결제금액은 Supabase `products.price_krw`에서 결정됩니다.

별도 CRAM/벼락치기 상품은 만들지 않습니다.

## Local development

```bash
npm ci
npm run dev
```

## Key documents

작업 시작 시:

- [Product Structure](docs/PRODUCT_STRUCTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Current Status](docs/STATUS.md)
- [Content Pipeline](docs/CONTENT_PIPELINE.md)
- [Design System](docs/DESIGN_SYSTEM.md)
- [Session Log](docs/SESSION_LOG.md)

Domain contracts:

- [Auth Flow](docs/AUTH_FLOW.md)
- [Payment Contract](docs/PAYMENT_CONTRACT.md)
- [PortOne + KCP](docs/PORTONE_KCP_INTEGRATION.md)
- [Order State Machine](docs/ORDER_STATE_MACHINE.md)
- [NAS Job Contract](docs/NAS_JOB_CONTRACT.md)
- [PDF Processor Contract](docs/PDF_PROCESSOR_CONTRACT.md)
- [Download Contract](docs/DOWNLOAD_CONTRACT.md)
- [Admin Console](docs/ADMIN_CONSOLE.md)
- [Internal Issuance](docs/INTERNAL_ISSUANCE.md)

과거 일회성 설계/리뷰 문서는 `docs/archive/`에 보관합니다.

## Storage rule

- GitHub: 코드, Markdown, 설정, 작은 구조화 데이터
- NAS: 원본 기출 PDF, 디자인 원본, 최종 Release PDF, MASTER, 대용량 자산/백업

## Public UI rule

고객 화면에는 상품의 학습 효용과 구매정보만 노출합니다. MASTER, QA 내부 상태, 발행 Registry, 내부 보안/추적 구조는 고객 마케팅 문구로 사용하지 않습니다.
