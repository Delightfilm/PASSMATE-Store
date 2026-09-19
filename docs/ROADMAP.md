# PASSMATE Roadmap

> Last reviewed: **2026-09-19**
>
> 목표: 자격증 디지털 학습자료를 자사몰에서 판매하고, 결제 → 권한 → NAS 발행 → 비공개 다운로드까지 안정적으로 자동화한다.

## Source of Truth

작업 판단 순서는 아래 문서를 기준으로 한다.

1. `docs/PRODUCT_STRUCTURE.md` — 판매 상품/가격/구성
2. `docs/ROADMAP.md` — 단계와 Exit Gate
3. `docs/STATUS.md` — 현재 실제 상태
4. `docs/CONTENT_PIPELINE.md` — 콘텐츠 제작/보관 흐름
5. `docs/DESIGN_SYSTEM.md` — 판매 PDF 디자인 규칙

Work/Codex/채팅에서 "완료"라고 한 내용도 **GitHub main 또는 live Supabase/Vercel에서 확인되기 전에는 완료로 기록하지 않는다.**

## Locked Product Model

고객 선택지는 2개만 유지한다.

| SKU | Price | Composition |
|---|---:|---|
| 핵심요약 패키지 | 기본 출시가 5,900원 | CORE + SHEET + CHECK |
| 합격팩 | 기본 출시가 9,900원 | PASS PACK + CORE + SHEET + CHECK |

- 별도 CRAM/벼락치기 PDF는 만들지 않는다.
- D-1/시험직전 암기는 CORE 마지막에 포함한다.
- 합격팩은 핵심요약 패키지 전체를 포함한다.

## Version Roadmap

| Version | Goal | Current State | Exit Gate |
|---|---|---|---|
| V0 ✅ | 브랜드·Storefront 기반 | 완료 | Production 배포 |
| V1 ✅ | Supabase 상품/회원/주문 DB | 핵심 스키마/RLS 운영 중 | live CRUD/RLS |
| V1.5 ✅ | 주문·발행 상태 머신 | DB 전이/감사/Queue 기반 완료 | runtime contract |
| V2 ✅ | 고객 계정 | 이메일 + Google/Kakao Auth, 계정/Library 기반 구현 | 실제 계정 세션 검증 |
| **V3 🚧** | **PortOne V2 + NHN KCP 결제** | 코드/Edge/테스트 채널 준비. 실제 paid E2E 미완료 | sandbox 결제 → paid + event |
| **V4 🚧** | **NAS 발행 엔진** | Worker/Queue/PDF 처리 코드 완료. 실 NAS 연결 미완료 | NAS `--check-config` → `--once` 성공 |
| V5 🚧 | 자동 다운로드 | Private Storage/signed URL 코드 완료. 실 artifact E2E 대기 | 구매 → Library → download |
| V6 🚧 | 내부 발행/무결성 | Registry/무결성/재발행 기반 구현 | 실제 Storage artifact verify |
| V7 🚧 | 관리자 Workspace | SmartStore형 좌측메뉴, 상품 create/edit, Preview 구현 | 관리자 브라우저 E2E |
| **V8** | **무대음향 3급 1호 판매 오픈** | PM-SS3-CORE 비공개 Draft 테스트 중 | 아래 Release Gate 전체 통과 |
| V9 | 판매 최적화 | 미착수 | 상세/미리보기/SEO/후기/쿠폰 |
| V10 | 외부 판매채널 | 미착수 | 외부 주문 통합 |
| V11 | 자격증 시리즈 확장 | 미착수 | 신규 자격증 추가가 데이터 중심으로 가능 |
| V12 | 유출 대응 | 기반 폴더/발행기록만 존재 | 탐지 → 내부 발행기록 대조 |

## Current Critical Path

### A. Payment — 지금 최우선

현재 PortOne V2 + NHN KCP 테스트 채널은 생성되었다.

남은 Gate:

1. Store ID / Channel Key / V2 API Secret / Webhook Secret의 서버 설정 확인
2. PortOne V2 Webhook URL 등록/서명 수신 확인
3. sandbox 성공 결제
4. 실패/취소/full-refund 경로
5. browser sync + webhook race가 한 상태로 수렴하는지 확인

**paid 결제가 실제 DB에 기록되기 전에는 V3 완료로 표시하지 않는다.**

### B. Cart / Package Selection — GitHub/live 반영 완료

`feature/cart-v1-locked-skus`에서 다음 기준으로 정리했다.

- 고객 선택지는 CORE / PASS 2-SKU 구조 유지
- 기본 출시가는 CORE 5,900원 / PASS 9,900원이지만 운영 가격은 관리자 페이지에서 SKU별 변경 가능
- 상품 카드/상세/장바구니는 현재 active SKU 가격을 runtime 조회
- checkout은 브라우저 가격을 신뢰하지 않고 DB `price_krw`로 order item과 총액을 생성
- 같은 자격증의 CORE/PASS는 장바구니에서 수량 증가가 아니라 선택 교체
- 서로 다른 자격증은 multi-item checkout 가능
- idempotency replay는 동일 cart SKU set일 때만 허용
- `cart_checkout` migration과 CORE/PASS 2-SKU가 live Supabase에 반영됨
- `payment-start` 실결제 E2E는 Payment 항목에서 별도로 검증

### C. NAS

집에서 NAS 접근 가능한 환경에서 진행한다.

1. SSH 접속 정상화
2. PASSMATE Worker repo 배치
3. `worker/.env`에 modern `SUPABASE_SECRET_KEY` 직접 입력
4. `PASSMATE_PROCESSOR_MODE=disabled`로 `--check-config`
5. 실제 MASTER 등록/manifest verify
6. 테스트 paid 주문의 queue를 `--once`로 1건 처리
7. private Storage / Registry / Library / download 확인
8. 이후에만 continuous Worker 활성화

### D. Content / First Release

현재 1호 타깃은 **무대음향 3급**이다.

- `PM-SS3-CORE`: 5,900원, 비공개, Draft
- MASTER/상품원고는 아직 v1.0 판매 확정 전
- 2025·2026 공식 기출/확정답안 및 최신 자료 편입/검증이 Release Blocker
- Claude 디자인 → QA → 최종 Release PDF → NAS MASTER 등록 순서

## Release Gate — V8

공개 판매는 아래가 모두 통과한 뒤 연다.

1. 상품 구조/가격이 `PRODUCT_STRUCTURE.md`와 일치
2. 콘텐츠 QA 완료
3. 최종 Release PDF 확정
4. PortOne sandbox 결제 성공/실패/취소/환불 E2E
5. NAS Worker 실제 발행 성공
6. Private Storage 업로드 성공
7. Library signed download 성공
8. 환불 후 권한/다운로드 차단 검증
9. Admin에서 주문/발행/무결성 추적 가능
10. 공개 상품만 `published + is_active=true`

## Deployment Rule

- 작은 수정마다 Vercel 배포를 반복하지 않는다.
- 관련 변경을 묶어 **한 번의 검증 가능한 커밋**으로 정리한다.
- 문서 정리만 필요한 경우 애플리케이션 코드는 건드리지 않는다.
- 공개상품 활성화는 별도 승인 전까지 금지한다.
