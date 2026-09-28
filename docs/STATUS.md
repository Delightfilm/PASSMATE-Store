# PASSMATE Current Status

> Last updated: **2026-09-28**
>
> This file records the **current verified state**, not the full history. Historical work remains in `SESSION_LOG.md` and `docs/archive/`.

## Current Focus

**Content Factory 재확보/검증 → Stage Sound 실제 원고·속지 → V3 Payment E2E → V4 NAS → V5 download E2E → V8 launch**

사용자 결정에 따라 결제 실검증과 NAS는 이후로 두고, 현재는 콘텐츠 원본과 문제지→Markdown 파서를 먼저 정리한다.

## Verified Live State

### GitHub / Vercel

- Repository: `Delightfilm/PASSMATE-Store`
- 장바구니 + 패키지 선택 UI, 관리자 감사 로그 UI, 상품 이미지 갤러리가 main에 반영됨
- 최신 애플리케이션 commit `10f4453`의 상품 갤러리 UI가 Vercel production에 반영되고 PC·모바일 검수 완료
- 관리자 Workspace V2, static-export-safe 상품 Preview, 상품 create/edit 코드 반영
- Supabase Preview용 local/live migration history 정합화
- 불필요한 Vercel 반복 배포는 중단하고 변경을 묶어서 진행

### Product / Supabase Catalog

Live DB:

| Code | Product | Price | Active | Version |
|---|---|---:|---|---|
| PM-C2 | 컴퓨터활용능력 2급 (UI: 핵심노트) | 5,900원 | true | `2027-v1.0` published |
| PM-C2-PASS | 컴퓨터활용능력 2급 합격팩 (UI: 시험대비 완성패키지) | 9,900원 | true | `2027-v1.0` published |
| PM-SS3-CORE | 무대음향 3급 핵심요약 패키지 (UI: 핵심노트) | 5,900원 | false | `2026-v0.1-test` draft |
| PM-SS3-PASS | 무대음향 3급 합격팩 (UI: 시험대비 완성패키지) | 9,900원 | false | `2026-v0.1-test` draft |

현재 출시 타깃은 무대음향 3급이며, CORE/PASS 모두 QA 전까지 비공개 draft를 유지한다. PM-C2도 동일한 2-SKU 구조로 정리되어 있다.

### Locked Product Structure

- 핵심노트 = 핵심개념 요약노트 + 공식·수치 한눈표 + 시험 직전 체크리스트
- 시험대비 완성패키지 = 핵심노트 전체 + 상세 개념해설서 + 단원별 확인문제·해설
- 내부 SKU/파일 코드는 CORE/PASS/PASS PACK/SHEET/CHECK 유지
- 기본 출시가는 5,900원 / 9,900원이며 실제 운영 가격은 관리자 페이지에서 SKU별 변경
- 결제 가격 Source of Truth는 `products.price_krw`
- 별도 CRAM/벼락치기 상품 없음
- 고객 UI 명칭과 표지 + 빈 속지 3장 상품 갤러리 운영 반영 및 PC·모바일 검수 완료
- live DB 상품명은 UI 승인 후 별도 변경

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
- `admin-data` v5 감사 로그 조회 경로 ACTIVE/JWT required
- 관리자 설정의 운영 변경 이력 UI production 반영

남음:

- 실제 브라우저 운영 E2E 최종 확인
- 관리자 action 1건 수행 후 운영 변경 이력 표시 확인
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

GitHub main과 live Supabase에 반영 완료.

- CORE/PASS를 실제 독립 SKU로 처리
- 시험대비 완성패키지 구성: PASS PACK + CORE + SHEET + CHECK
- 폐기된 별도 벼락치기 문구 제거
- 디지털 상품 수량 중복 제거
- 같은 자격증 패키지 선택은 교체
- 상품 카드/상세/장바구니 가격은 runtime에 Supabase active SKU에서 조회
- 관리자 가격 수정은 `products.price_krw`를 변경하고 신규 checkout 총액에 직접 반영
- checkout은 DB 가격을 `order_items.unit_price_krw`에 pin하고 서버 합계를 PortOne `totalAmount`로 전달
- live migration 목록에서 `cart_checkout` 적용 이력 2건 확인
- `payment-start`는 live Edge에서 ACTIVE이며 실제 결제 E2E는 Payment 항목에서 별도 검증

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

- 2016–2024 기출 corpus/원고는 기존 문서상 기록만 있고 현재 로컬 실파일은 미확인
- 2025·2026 공식 게시 이력과 법령 기준은 [공식자료 점검 문서](./STAGE_SOUND_SOURCE_AUDIT_2026-09-20.md)에 분리 정리
- 운영 관리자 Preview에 무대음향 Light/Dark 표지 비교 적용
- 상품 카피 1차 QA 완료: 근거 없는 기출 기반/출제이력 표현 제거, CORE/SHEET/CHECK 구조 통일
- 카피 정리용 Supabase migration `20260920011743` live 적용 및 CORE/PASS `inactive + draft` 검증 완료
- 관리자 로그인 상태 PC·모바일 실제 QA 완료: Light/Dark 전환, Light 기본 복귀, 모바일 가로 넘침 수정
- PM-SS3-CORE 테스트 상품 등록
- Light Theme는 고객 노출 기본안, Dark Theme는 비교안으로 유지

### Content Factory / 문제지 파서

별도 ChatGPT 작업 `PDF 대본 제작`의 최종 기록:

- `PASSMATE Content Factory v0.5.1`
- 금속도장기능사 교사용 PDF 17개에서 1,020문항 / 보기 4,080개 / 정답표 1,020건 교차검증 보고
- 프로그램 ZIP 재해제 기준 자동 테스트 58/58 통과 보고
- 요약본 제작용 Markdown과 문제은행용 JSON/SQLite를 한 번에 생성
- 이미지 문항 33개는 `pending_human_review`
- 해설 1,020건은 모두 `explanation_status=missing`

현재 프로젝트에서 확인된 실제 상태:

- 파서 프로그램 ZIP·소스·테스트가 현재 GitHub 저장소와 로컬 작업공간에 없음
- 위 수치는 별도 작업의 완료 보고이며, 이 저장소에서 독립 재실행한 결과는 아님
- 무대음향 3급 문제지로 실행한 검증 결과와 생성 Markdown은 현재 작업공간에 없음
- 다음 단계는 최종 프로그램 ZIP/소스 재확보 → 테스트 재현 → 무대음향 원본 E2E 실행

Release Blocker:

- 2025·2026 공식 문제지/확정답안 실파일 확보 및 이용 범위 확인
- 2025·2026 출제기준표·표준교재 정오표 실파일 확보
- 시험일 시행 법령과 현행 법령의 조문별 검증
- 최종 QA
- 최종 PDF
- NAS MASTER 등록

## Current Blockers

1. **Content Factory v0.5.1 프로그램 ZIP/소스 재확보 및 현재 저장소에서 재검증**
2. **무대음향 공식 문제지/확정답안 실파일과 실제 Stage Sound Release PDF / MASTER**
3. **PortOne sandbox paid E2E** — 사용자 요청으로 이후 진행
4. **NAS SSH/Worker 실환경 연결** — 사용자 요청으로 이후 진행
5. 결제 → 발행 → 다운로드 전체 E2E

## Next Actions

1. `PASSMATE Content Factory v0.5.1` 최종 프로그램 ZIP 또는 소스 폴더를 현재 작업공간에 다시 확보
2. 포함 테스트 58개 재실행 및 샘플 PDF E2E로 보고 수치 재현
3. Stage Sound 공식 원본 확보 → 파서 실행 → MASTER/Markdown 원고 생성
4. 이미지 문항·정답·법령·해설 QA 후 실제 속지로 상품 갤러리 교체
5. 이후 PortOne sandbox paid → NAS `--check-config`/`--once` → Library download/환불 차단 검증

## Security Note

Supabase Security Advisor의 계정 설정 WARN(Leaked Password Protection) 외에 현재 확인된 DB/RLS 핵심 권한 문제는 별도 신규 blocker로 확인되지 않았다. 관리자 계정은 Kakao OAuth 지정 계정으로 제한한다.
