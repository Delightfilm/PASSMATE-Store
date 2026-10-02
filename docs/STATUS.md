# PASSMATE Current Status

> Last updated: **2026-10-03**
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

## CBT Mate 운영 문제은행

- PASSMATE v0.7.2 bundle JSON 스키마(\`qualification\`, \`exam_sessions\`, \`subjects\`, \`questions\`)를 관리자에서 직접 가져오는 경로 구현
- 7MB급 파일을 브라우저에서 검증한 뒤 100문항 단위로 \`question-bank-admin\` Edge Function에 전송
- 내용 중복 제거를 폐지하고 원본 \`question_uid\` 단위로 모든 회차 문항 보존
- 운영 DB 저장 → 검수 대기 → 공개/되돌리기 배치 흐름 구현
- 공개 문항을 \`/question-bank/\`가 Supabase에서 페이지 단위로 읽어 회차별·단원별·사용자 조합 모의고사에 사용
- 이미지 URL 문항 표시 및 검증 오류 보고서 다운로드 구현

### 2026-10-02 CBT 21개 점검 항목

- `codex/cbt-21-review`에서 UI 및 테스트 전용 서버 출제/연습용 번호 변경 진행. 운영 `main` 배포는 변경하지 않음.
- 별도 Supabase 테스트 프로젝트 연결은 미확인. Preview의 CBT 원격 쓰기는 연결 확인 전 차단.
- 격리된 메모리 PostgreSQL에서 100회 20/20/20 출제, 일자별 번호, 상태/소유권/멱등 검증 통과. hosted Supabase 및 실제 두 탭 동시 제출 QA는 미완료.
- 상세 변경/회귀/되돌리기 자료: `docs/CBT_21_REVIEW.md`, 테스트 전용 SQL: `docs/cbt-test-migration.DRAFT.sql`.

### 2026-10-02 CBT 재검토 11개 항목

- 기존 로컬 응시의 권한을 유지하는 RESTRICTIVE RLS로 변경. 서버 응시만 직접 쓰기/승격 차단.
- 낙관적 문항별 저장 큐, 모의시험 중 채점 차단, 구성표/과목 테이블, 만료 기록의 로컬 숨김, 오류 상태 구분 및 mastered 반영.
- `docs/CBT_11_REVIEW.md`가 이전 21개 보고서의 일괄 권한 회수/전역 저장 큐 설명을 대체한다.
- 임시 로컬 PostgreSQL 18.4에서 실제 두 연결 검증 통과: B의 Lock 대기, 최초 제출 결과/행 1개, RLS 직접 쓰기 및 RPC 차단. Supabase hosted Auth/REST 및 브라우저 두 탭 QA는 별도 테스트 프로젝트가 없어 미완료.
- 운영 공개 카탈로그 메타데이터의 읽기 전용 집계: 1,138문항/19회차, 2001년 4회 색채와 금속도장 각각 19문항; 나머지 55개 회차×과목 셀은 20. 누락 번호/원인 및 보기·정답까지 유효한 풀은 아직 확인 필요. 응시/정답 조회나 DB 쓰기는 하지 않음.
- **별도 테스트 DB의 두 연결/Auth/REST/브라우저 QA가 모두 끝난 뒤에만 병합 검토.** 현재 운영 DB/배포는 변경하지 않음. 생산 환경 차단 가드 해제 및 운영 전환은 별도 검토 필요.

### 2026-10-02 CBT 후속 재검토 9개 항목

- 이전 11개 검토의 권한/구성표/롤아웃 지침은 `docs/CBT_9_REVIEW.md`가 대체한다. 보고서에 현재 DRAFT SQL 전문을 포함했다.
- authenticated의 attempts DELETE 권한과 두 DELETE 정책 제거. 기존 legacy INSERT/UPDATE 및 서버 관리 행 차단은 유지.
- 구성표는 종목 UUID FK; 시드 UUID를 명시. 종목 이름 변경/동명 종목 검증 통과.
- 앱 서버 접근은 환경 `CBT_SERVER_PROJECT_REFS` 명시 허용 목록, 기본 빈 값·시작 OFF. 환경은 활성화하지 않음. 테스트 SQL/QA의 운영 실행 금지는 유지.
- 신규 서버 시험은 mock 전용. custom/past/subject 전환은 별도 PR. 준비 후 병합하는 A안을 기본 유지; B 자유 출제는 미구현/결정 필요.
- 무제한 진행 중 기록은 이 브라우저의 최근 열람(없으면 시작일)으로 7일 계산해 접음. 표시/숨김은 로컬만 변경.
- 공개 카탈로그 메타데이터 읽기 전용 확인: 2001년 4회 색채 12번, 금속도장 43번이 공개 목록에 없음. 전체 58문항. 비공개/수입·이미지/원본 원인은 관리자 조회와 NAS 대조 필요.
- 로컬 native PostgreSQL 18.4 두 연결 및 전체 빌드/큐·UI·UUID/RLS 검사 통과. 실제 Preview Slow 3G/Supabase Auth/REST/두 탭 검증은 테스트 DB가 없어 미완료.
- 운영 병합/DB 쓰기/문항 복구는 수행하지 않음.

### 2026-10-03 CBT 후속 재검토 7개 항목

- 최신 절차는 `CBT_7_REVIEW.md`, 한 장 병합 게이트는 `CBT_MERGE_GATE.md`. 이전 9개 보고서의 SQL은 역사 기록이고 현재 전문은 `cbt-test-migration.DRAFT.sql`.
- 시작 clientId(UUID)를 클라이언트에서 재시도까지 유지. DB 계정별 시작 잠금 + user/client 유니크 + 별칭 키로 동일/두 탭 시작을 기존 미만료 mock 응시로 연결. 만료/제출 뒤 같은 키도 원래 응시 반환.
- 앱의 정확한 ref 허용 목록과 DB `cbt_private.server_exams.enabled=true`가 모두 필요. DB 기본 false, absent/false는 start/answer/submit/identity 모두 차단. 앱 서비스에는 marker SELECT만, 구성표도 SELECT만.
- PR1 UI와 PR2 서버 분리는 가능하지만 공용 client/저장 모듈/QA는 hunk 분리 필요. PR1 로컬 자유 출제 유지+비율 안내 또는 준비 중 선택은 결정 필요. 현재 통합 Draft의 준비 후 병합 방침 유지; PR1/PR2 새 PR 생성·운영 병합은 하지 않음.
- 7일·이 브라우저 기준 문구를 유지하고 다른 기기의 활동은 반영하지 못한다는 문장을 명시. 로컬 표시/숨김만 변경.
- 누락 문항 진단 SELECT에 실행 안내/해석표/원문·정답 배제와 감사/집계 provenance 추가. 현재 코드상 58은 공개 시 재집계 값이며 원본·수입 시점 수량 스냅샷은 아님. 운영 원본/로그 실행은 미확인.
- 로컬 핸들러 더블클릭/응답 유실·재로드 UUID, PGlite 활성화·권한, native PostgreSQL 18.4 실제 두 연결 시작/제출 경합, 큐/UI/전체 빌드 검증 통과.
- 별도 테스트 프로젝트가 없어 hosted Supabase Auth/REST·실제 Preview Slow 3G·브라우저 두 탭은 미실행. 운영 DB/허용 목록 활성화/main 병합은 하지 않음.
