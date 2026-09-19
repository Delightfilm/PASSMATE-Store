# PASSMATE Current Status

> Last updated: **2026-09-19**
>
> This file records the **current verified state**, not the full history. Historical work remains in `SESSION_LOG.md` and `docs/archive/`.

## Current Focus

**V3 Payment E2E → V4 NAS real integration → V5 download E2E → V8 Stage Sound launch**

새 기능 추가보다 실제 결제부터 다운로드까지 한 번 끝까지 통과시키는 것이 우선이다.

## Verified Live State

### GitHub / Vercel

- Repository: `Delightfilm/PASSMATE-Store`
- 2026-09-19 Work 변경: 장바구니 + 패키지 선택 UI가 main에 반영됨
- 해당 main commit의 Vercel status는 **success**
- 관리자 Workspace V2, static-export-safe 상품 Preview, 상품 create/edit 코드 반영
- 불필요한 Vercel 반복 배포는 중단하고 변경을 묶어서 진행

### Product / Supabase Catalog

Live DB:

| Code | Product | Price | Active | Version |
|---|---|---:|---|---|
| PM-C2 | 컴퓨터활용능력 2급 | 6,900원 | true | `2027-v1.0` published |
| PM-SS3-CORE | 무대음향 3급 핵심요약 패키지 | 5,900원 | false | `2026-v0.1-test` draft |

현재 출시 타깃은 **PM-SS3-CORE**다. PM-C2는 기존 개발/운영 fixture 성격이 남아 있으며 최신 2-SKU 구조와 별도로 정리 대상이다.

### Locked Product Structure

- 핵심요약 패키지 5,900원 = CORE + SHEET + CHECK
- 합격팩 9,900원 = PASS PACK + CORE + SHEET + CHECK
- 별도 CRAM/벼락치기 상품 없음

### Admin

완료:

- 지정 Kakao 관리자 계정 기반 권한
- DB actor + Edge + UI 다중 검증
- SmartStore형 좌측 메뉴
- 상품 조회/검색/필터
- 상품 create/edit
- draft 상품 Preview
- 주문/발행/Artifact 조회
- 재시도 및 무결성 확인 기반

남음:

- 실제 브라우저 운영 E2E 최종 확인
- PG 실제 환불 Admin action은 V3 실결제 검증 후

### Payment

구현 완료:

- PortOne V2 + NHN KCP
- `payment-start`
- `payment-sync`
- signed `payment-webhook`
- 서버 기준 가격/금액 검증
- idempotency
- entitlement + issuance enqueue transaction boundary
- Edge Functions ACTIVE

외부 진행:

- PortOne NHN KCP **테스트 채널 생성 완료**
- Codex 작업에서 live Edge Functions가 재배포된 흔적은 확인됨
- 그러나 GitHub main에는 결제 설정 관련 새 commit이 아직 없음

Live DB 현재:

- `payment_pending / not_started` 주문: **2건**
- PortOne payment attempt `pending`: **2건**
- payment event: **0건**
- active entitlement: **0건**
- issuance job: **0건**

따라서 **sandbox paid E2E는 아직 완료되지 않았다.**

### Cart / Package Selection

main에 UI/DB migration 코드가 추가되었지만 Release-ready가 아니다.

현재 확인된 정합성 문제:

1. 합격팩 가격을 base + 6,000원으로 계산 → LOCKED 9,900원과 불일치
2. 합격팩 설명에 폐기된 `벼락치기`가 포함됨
3. 임시 PM-C2-PACK 모델이 현재 2-SKU 규칙과 불일치
4. `20260919100000_cart_checkout.sql`은 live migration 목록에 없음

**결제 E2E 진행 중인 Codex 작업과 충돌하지 않도록 지금은 코드 수정하지 않고 다음 통합 정리에서 수정한다.**

### NAS / Worker

코드 기반은 완료:

- Queue claim / lease / heartbeat / retry
- Production PDF processor
- MASTER manifest 검증
- private Storage upload
- immutable MASTER version rule
- modern Supabase secret 지원
- Docker hardening

실환경:

- UGREEN NAS PASSMATE 공유폴더 구조 생성됨
- SSH 활성화/22번 포트 설정 화면 확인
- Mac → NAS `192.168.0.48:22` 접속은 timeout
- NAS 작업은 집에서 재개하기로 함
- `--check-config` 미실행
- 실제 MASTER 미등록
- 실제 `--once` 미실행

### Download / Issuance

구현 완료:

- private `passmate-artifacts` bucket
- signed URL
- entitlement/order/job gate
- Registry lifecycle
- SHA-256/size integrity tracking

실제 PDF가 아직 없으므로 real artifact → Library → download E2E는 미완료.

### Stage Sound Content

현재:

- 2016–2024 기출 corpus 기반 분석/원고 존재
- PM-SS3-CORE 테스트 상품 등록
- CORE 디자인 방향/Light Theme 확정

Release Blocker:

- 2025·2026 공식 기출/확정답안 편입
- 최신 자료/법규 검증
- 최종 QA
- 최종 PDF
- NAS MASTER 등록

## Current Blockers

1. **PortOne sandbox paid E2E**
2. **Cart/package model을 LOCKED 2-SKU 구조와 정합화**
3. **NAS SSH/Worker 실환경 연결**
4. **실제 Stage Sound Release PDF / MASTER**
5. 결제 → 발행 → 다운로드 전체 E2E

## Next Actions

1. Codex의 PortOne 작업 결과가 main/live에 무엇을 남겼는지 확인하고 sandbox paid를 완료
2. 결제 작업과 충돌이 끝난 뒤 Cart/Pass Pack 가격·구성·DB 모델 정리
3. 집에서 NAS SSH 정상화 → `--check-config`
4. 테스트 MASTER 1개 등록 → paid order → Worker `--once`
5. Library download/환불 차단까지 통과
6. Stage Sound 콘텐츠 최신 공식자료 QA 후 V8 판매 오픈 검토

## Security Note

Supabase Security Advisor의 계정 설정 WARN(Leaked Password Protection) 외에 현재 확인된 DB/RLS 핵심 권한 문제는 별도 신규 blocker로 확인되지 않았다. 관리자 계정은 Kakao OAuth 지정 계정으로 제한한다.
