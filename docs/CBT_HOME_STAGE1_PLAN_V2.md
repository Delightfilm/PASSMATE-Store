# PASSMATE 학습 홈 1단계 변경 계획 v2

## v1 → v2 변경 이력

| 항목 | v1 | v2 |
|---|---|---|
| 커밋 순서 | C1 → C2 → C3 | **C0 법적 문서·푸터 → C1 /store/ 보존 → C2 snapshot → C3 학습 홈** |
| 단계 승인 | 묶음 구현 후 검증 | 각 커밋에서 멈추고 diff·검사·캡처 보고 후 다음 단계 승인 |
| 정책 경로 | URL 확인 대기 | `/terms/`, `/privacy/`, `/refund/`, `/copyright/` 확정 |
| 정책 본문 | 푸터 정보 중심 계획 | 확정된 사용자 Markdown만 사용. 미수령 문서는 파일·페이지·링크를 만들지 않음 |
| 푸터 소유 단계 | C3에서 수정 | C0 독립 단위. C3에서는 푸터 수정 없음 |
| snapshot 생성 | production build에서 자동 네트워크 조회 | 사용자가 실행하는 `npm run catalog:snapshot`에서만 조회 |
| snapshot 보관 | Git 제외, 빌드 산출물 | 생성 JSON을 Git에 커밋. 생성 산출물을 제외하는 규칙을 두지 않음 |
| 빌드 실패 | NAS 접근 실패도 빌드 실패 | 로컬 JSON 누락·schema·releaseId 오류만 snapshot 빌드 실패 원인 |
| config | `next.config.ts`에 생성 hook | 해당 변경 삭제. dev·tsc·build·check에서 생성기 호출 금지 |
| 불필요한 diff | 생성 때 generatedAt 변경 | sourceSha256이 동일하고 기존 파일이 유효하면 쓰기 생략 |
| snapshot 롤백 | 같은 산출물 복원에 아티팩트 보존 필요 | Git의 JSON을 revert하여 동일 releaseId·원본 해시·생성 시각 복원 |
| C4 | 없음 | 결제 고지·동의 기록을 **계획만** 추가. 계약·DB 변경은 별도 승인 |

2026-10-05 · **이번 작업은 v2 문서 작성만 수행. 코드·의존성·DB·운영 배포 변경 없음.**

v1인 `docs/CBT_HOME_STAGE1_PLAN.md`는 비교용으로 보존한다. 후속 구현 지시는 이 v2를 기준으로 한다. 앞서 승인된 정책 구현 계획도 이번 지시의 “코드 적용하지 않음 / 본문 미확정 / C4 구현 보류”를 우선하며 실행하지 않는다.

저장소 확인 기준: `passmate-nas-content-runtime`, 브랜치 `codex/store-mobile-optimization`, HEAD `e9c4d624bf4d85d41ebe08e667716a69a489c6f1` 및 현재 작업 트리. 미커밋 선행 변경이 많으므로 HEAD만을 완성된 기준 화면으로 간주하지 않는다. 운영 환경과 실제 NAS catalog는 이번에 조회하지 않았다.

## 확정 범위

| 구분 | 이번 계획 |
|---|---|
| C0 | 사용자 확정 정책 Markdown·공통 정책 레이아웃·사업자 푸터·시험 메뉴 정책 링크. 홈 전환과 독립 |
| C1 | 현재 루트 상품 홈을 `/store/`에 보존. 이 단계에서는 `/`도 상품 홈 유지 |
| C2 | 실제 공개 catalog를 명시적 명령으로 자동 변환하여 Git에 고정. 빌드는 로컬 JSON 검증만 수행 |
| C3 | `/`를 검색 중심 학습 홈으로 전환. 실제 종목 검색·바로가기·상시 `/store/` 링크 |
| PC | 홈과 공통 헤더의 필요한 변경 허용. 메뉴 구조 통합은 제외 |
| 즉시 표시 | 홈 쉘·검색 초기 데이터는 서버 HTML에 포함. NAS·가격·인증 완료를 기다려 전체를 숨기지 않음 |
| 글자·접근성 | 보조 텍스트 최소 14px, 본문/입력 16px, 터치 44×44px, 대비 4.5:1 이상 |
| 보존 | C0~C3에서 인증·결제·가격·권한·다운로드·시험 생성/채점/저장 계약 보존 |
| 제외 | 헤더 메뉴 통합, 하단 탭, 토큰 전면 개편, 오답 후 노트 연결, 기록 이어풀기 |
| C4 | 결제 고지·동의 기록의 선택지와 위험만 작성. 구현·마이그레이션 생성·DB 적용 금지 |
| 운영 | 운영 배포·운영 DB 쓰기·실결제 없음. 독립 배포 가능성은 설계 요건이며 배포 실행 허가가 아님 |

각 C0~C3 완료 보고와 다음 단계 승인 사이에서는 작업을 멈춘다. v2 문서 작성 승인을 전체 구현·새 의존성 설치·운영 변경 승인으로 확대하지 않는다.

## 화면과 경로

```text
/ 학습 홈 — C3에서 전환
  기존 헤더 구조                   스토어 → /store/
  내 시험 기출부터, 틀린 문제 복습까지.
  [자격증 이름 검색_______________]   입력 16px / 높이 52px
  바로 풀 자격증                    실제 목록에서 최대 6개
  [전체 자격증 보기] → /cbt/
  [핵심노트 스토어] → /store/         본문에 항상 표시
  C0 공통 푸터                     C3에서 수정하지 않음

/store/ 상품 홈 — C1에서 추가
  현재 /의 상품·비교·학습 순서·가격 skeleton/재시도·CTA 보존

/terms/ /privacy/ /refund/ /copyright/ — C0
  사용자 확정 Markdown을 받은 문서만 페이지 생성
  제목·시행일 → 다른 존재하는 정책 링크 → 본문 → 사업자 정보
  privacy: H3 목차 → 조항 앵커

/cbt/[certSlug]/exam/[attemptId]/ — 저장소에서 확인한 응시 경로
  푸터 숨김 유지
  “중간 채점 · 나가기” 메뉴 패널에 존재하는 정책 링크 한 줄 추가

/cbt/, /cbt/{기존 종목 slug}/, /products/, /products/{slug}/,
/cart/, /checkout/, /library/, /account/…
  기존 경로·계약 유지. /checkout/ 변경은 C4 별도 승인 전까지 보류
```

검색/바로가기는 기존 종목 상세로 이동한다. 자동 시험 생성·시험 기록 쓰기는 하지 않는다. 현재 `lib/question-bank.ts:84`의 `certSlug()`는 명시 slug가 없으면 `name.trim().replace(/\s+/g, "-")`를 사용한다. 실제 공개 catalog 타입에는 code/title이 있고 slug 필드는 없다. code를 URL slug로 쓰지 않고 현재 규칙·URL 인코딩·기존 `findCert()`의 디코딩과 호환되는지 검사한다.

## 파일 단위 변경 목록

새 파일은 예정 경로다. 정책별 `.md`와 `page.tsx`는 해당 확정 문서를 받을 때만 만든다. 미수령 문서의 빈 파일·더미 본문·빈 정책 페이지는 만들지 않는다.

| 단계 | 파일 | 변경 내용 |
|---|---|---|
| C0 | `content/legal/{terms,privacy,refund,copyright}.md` | 받은 확정 본문만 저장. frontmatter의 title·effectiveDate 사용 |
| C0 | `lib/business-info.ts` | 상호·등록번호·대표자명·주소·이메일·전화·신고번호·운영시간의 단일 설정 |
| C0 | `lib/legal-content.ts` | 서버에서 Markdown·frontmatter 읽기, 실제 문서/경로 목록·H3 목차 생성. NAS/auth/가격 조회 없음 |
| C0 | `components/legal-page.tsx`, `components/legal-markdown.tsx` | 정책 전용 레이아웃 및 승인된 Markdown 렌더링 |
| C0 | `components/policy-links.tsx`, `components/business-information.tsx` | 존재하는 정책 링크만 표시, 빈 사업자 필드 줄 생략 |
| C0 | `app/{terms,privacy,refund,copyright}/page.tsx` | 받은 문서에 해당하는 정적 페이지와 metadata만 생성 |
| C0 | `components/site-footer.tsx`, 필요시 `components/footer-route-gate.tsx` | 서버 콘텐츠와 응시 경로 숨김을 분리. 푸터 자체가 로그인/NAS/가격을 조회하지 않음 |
| C0 | `app/cbt/[certSlug]/exam/[attemptId]/page.tsx` | 서버에서 존재하는 정책 링크 metadata만 시험 UI에 전달 |
| C0 | `components/question-bank-client.tsx` | 시험 메뉴 패널에 정책 링크 행만 추가. 시험 상태 처리 변경 없음 |
| C0 | `app/legal.css`, `app/layout.tsx` | 정책·사업자·법적 푸터에 한정된 CSS 및 import. 기존 푸터 축약 규칙과의 충돌만 필요한 경우 해소 |
| C0 | `scripts/validate-legal.mjs`, `package.json` | `check:legal` 추가. 기본 경고, `LEGAL_STRICT=1` 실패 모드. 기존 검사 유지 |
| C0 | `package.json`, `package-lock.json` | **승인된 경우에만** Markdown 의존성의 정확한 버전 추가 |
| C1 | `app/store/page.tsx` | 기존 루트 상품 홈 보존. HomeProducts·서버 가격·SKU·CTA 유지 |
| C1 | `components/site-header.tsx` | `/store/`에도 기존 스토어 헤더 스타일 적용. 루트·기존 메뉴 의미는 아직 유지 |
| C2 | `scripts/generate-cbt-home-catalog.mjs` | 명시적 `catalog:snapshot`에서만 공개 catalog 조회·검증·자동 변환 |
| C2 | `data/cbt-home-catalog.generated.json` | releaseId·generatedAt·sourceSha256·실제 전체 목록을 **Git에 커밋** |
| C2 | `lib/cbt-home-catalog.ts`, `scripts/validate-cbt-home-catalog.mjs` | 로컬 snapshot schema/releaseId 검증 및 순수 검색·URL helper |
| C2 | `package.json` | 명시적 생성 명령, 로컬 `check:home-catalog` 및 build 검증 연결. 자동 생성 hook 없음 |
| C2 | `app/layout.tsx` | `npx next build`도 로컬 snapshot 검증을 거치도록 서버 모듈의 로컬 검증 연결. next.config 변경 없음 |
| C2 | `scripts/validate-build-network.mjs` 예정 | 외부 통신 차단/기록 조건에서 명령별 네트워크 0건과 snapshot 비변경 검증 |
| C3 | `app/page.tsx`, `components/learning-home.tsx`, `components/certification-search.tsx` | 정적 snapshot으로 제목·검색·바로가기·상시 스토어 링크 |
| C3 | `components/site-header.tsx`, `components/service-switcher.tsx` | 기존 메뉴 구조 유지. 스토어 href `/store/`, `/`의 학습 활성 상태 보정 |
| C3 | `app/learning-home.css`, `app/layout.tsx` | 새 홈 범위 CSS import. 기존 색 토큰 참조. 푸터 스타일 변경 없음 |
| C3 | `scripts/validate-learning-home.mjs` | 홈 NAS/가격 의존 제거·검색·기존 상세 URL·상시 링크 검사 |
| 각 단계 | `docs/DESIGN_SYSTEM.md`, `docs/STORE_MOBILE_QA.md` | 단계별 diff·검사·캡처·실제 SHA·승인 이력·미검증 항목 기록 |
| C4 계획만 | `docs/CHECKOUT_POLICY_CONSENT_PLAN.md` 예정 | 아래 C4 선택지·위험·승인 범위의 상세화. 이번에는 별도 문서도 만들지 않고 v2 안에만 기록 |
| C4 구현 금지 | `components/checkout-client.tsx`, 결제 Edge/RPC, 새 동의 API/마이그레이션, 필요시 다운로드 처리 | 모델·계약 선택 및 별도 승인을 받은 후에만 변경 |

**v1에서 삭제한 변경 항목:** `next.config.ts`의 생성 hook, `.gitignore`의 생성 JSON 제외, C3의 푸터 수정. 현재 `next.config.ts`에는 생성 hook이 없고 `.gitignore`에도 해당 JSON 제외 규칙이 없다. `git check-ignore`에서도 해당 경로가 제외되지 않는다. 따라서 이 두 파일은 그대로 둔다. 임시 파일은 생성기가 성공/실패 후 자신이 만든 경로만 정리하며 ignore 규칙을 새로 추가하지 않는다.

`components/question-bank-client.tsx`는 C0의 정책 링크 표시 예외만 허용한다. CBT 데이터·다운로드 helper, 인증·결제·권한 처리 파일은 C0~C3에서 수정하지 않는다. 빌드 네트워크 검사에서 기존 가격 조회가 실제 실행되는 문제를 발견하면, 가격 계산을 바꾸지 않는 요청 시 렌더링 경계 조정안을 별도로 보고한다. 확인 전 해당 파일의 수정 범위를 확대하지 않는다.

## catalog snapshot 정책

| 항목 | v2 정책 |
|---|---|
| 입력 | 기존 `NEXT_PUBLIC_QUESTION_BANK_CONTENT_URL`의 공개 `/catalog.json`. 값을 로그로 노출하거나 비공개 토큰을 넣지 않음 |
| 실제 schema | 로컬 타입에서 `passmate.question-bank.catalog.v1`, releaseId, qualifications의 code/title/questions/exams 등 확인. 실제 NAS 응답은 **확인 필요** |
| 생성 시점 | 사용자가 직접 실행한 **`npm run catalog:snapshot` 때만** 네트워크 조회 |
| 조회 범위 | catalog 1개. 문제·이미지·가격·계정 응답은 요청하지 않음 |
| 제한 | 요청별 timeout 5초, 재시도 최대 1회, 대기 1초. 전체 약 11초 이내 |
| 검증 | 입력 schemaVersion·비어 있지 않은 releaseId·code/title·중복 code/경로·문항/회차 정수. 출력의 snapshot schema 검증 |
| 출력 | snapshotSchemaVersion, releaseId, generatedAt, sourceSha256, qualifications |
| 목록·바로가기 | 전체 목록 자동 변환. 유효 회차/문제가 있는 종목을 안정 정렬해 최대 6개. 인기 통계나 가짜 종목 생성 금지 |
| 쓰기 | 원본 검증 → SHA-256 비교 → 임시 파일 기록·재검증 → 교체. 실패 시 기존 JSON 보존 |
| 같은 원본 | 기존 JSON이 유효하고 sourceSha256이 같으면 파일 쓰기 생략. generatedAt·파일 내용·mtime 유지 |
| 원본 변경 | 변경한 원본으로 성공 생성한 경우만 JSON 교체. diff와 releaseId를 확인하여 별도 갱신 커밋 |
| 생성 실패 | 명시적 생성 명령만 실패. 기존 유효 JSON이 있으면 dev/check/tsc/build는 계속 사용 가능 |
| 빌드 실패 | **로컬 JSON 누락·schema 오류·releaseId 누락이면 실패**. 누락 시 `npm run catalog:snapshot` 안내. NAS가 꺼져 있다는 이유로 실패시키지 않음 |
| 기존 서비스 | 빌드·배포는 Git에 있는 검증된 snapshot 사용. NAS 응답이나 다음 생성 실패가 기존 산출물을 변경하지 않음 |
| 개발/타입 검사 | clean checkout에 커밋된 JSON 사용. dev·tsc는 자동 생성하지 않음. 누락 시 생성 안내·오류 |
| 명령 경계 | next.config·dev·tsc·build·check에서 생성 스크립트 또는 다른 catalog 네트워크 경로 호출 금지 |
| 직접 빌드 | `npm run build`는 check로 검증. `npx next build`는 서버 모듈 연결로 로컬 검증만 수행. 실제 오류 차단 동작은 C2에서 검증 |
| 홈 런타임 | 정적 snapshot으로 HTML·검색 생성. 홈 catalog·문제 번들·가격 요청 0건 |
| 갱신 주기 | 사용자의 명시적 생성 + 검토·커밋 시 갱신. 빌드 때 재생성하지 않고, 파일 나이만으로 빌드를 막지 않음 |
| 최신 목록 차이 | 기존 `/cbt/`는 기존 실데이터 경로 유지. NAS release와 홈 snapshot이 다를 수 있음. 삭제/개명된 종목 이동 시 기존 안내 보존 |

생성 산출물은 **Git에 커밋한 JSON을 빌드에 포함**한다. 수동 목록 작성·빌드 중 임의 재생성은 금지한다. `git revert`로 해당 산출물이 복원되므로 네트워크 조회 없이 같은 releaseId·sourceSha256·generatedAt의 파일을 다시 사용할 수 있다.

현재 `app/layout.tsx`는 로컬 `next/font/local`을 사용한다. `lib/server-product-prices.ts`에는 Supabase 외부 fetch가 있으며 `cache: "no-store"`다. 루트와 상품 목록이 이를 호출하므로 **현재 build 전체의 외부 네트워크 0건은 아직 입증하지 않았다**. C2에서는 실제 명령의 통신을 기록/차단해 확인한다. 로컬 JSON 검사만 추가했다고 전체 빌드가 오프라인이라고 보고하지 않는다.

명령 시작·컴파일·검사에서의 외부 네트워크 0건과, 사용자가 기존 `/cbt/`·스토어·로그인 화면을 이용할 때 발생하는 기존 런타임 요청은 구분한다. 후자까지 차단하면 기존 서비스 계약이 달라지므로 변경하지 않는다. 설치·명시적 snapshot 생성은 네트워크 0건 대상 명령에 포함하지 않는다.

## 푸터·정책 페이지 — C0

### 본문과 렌더링

현재 저장소에는 `content/legal/`, 4개 정책 페이지, 사업자 설정 파일이 없다. 앞서 전달된 첨부 초안은 최종본으로 사용하지 않는다. 사용자가 검토 완료한 Markdown을 전달한 문서만 추가한다. 본문 문구·조항·표를 임의로 쓰거나 교정하지 않는다.

frontmatter의 `title`, `effectiveDate`를 읽어 제목·시행일을 표시한다. 시행일은 모두 `2026-10-05`. body에 제목·시행일이 반복되더라도 임의 삭제하지 않고 사용자에게 제안한다. 상단의 “다른 정책 3개”도 실제 존재하는 문서만 연결한다. 모든 문서를 받은 뒤에는 다른 3개가 표시된다.

`package.json`·`package-lock.json`과 app/components/lib 사용처를 확인했으며 Markdown 렌더러가 없다. 계획 후보의 공식 npm 배포 메타데이터와 tgz 바이트를 조회했지만 설치하지 않았다.

| 후보 | 버전 | tgz / 패키지 자체 압축 해제 크기 | 판단 |
|---|---|---|---|
| react-markdown | 10.1.0 | 15,544 / 52,637 bytes | React 요소 렌더링 후보 |
| remark-gfm | 4.0.1 | 7,621 / 21,993 bytes | GFM 표·링크 등 지원 후보 |
| gray-matter | 4.0.3 | 11,775 / 38,621 bytes | frontmatter 파싱 후보 |
| marked | 18.0.14 | 127,273 / 504,507 bytes | 대안. HTML 출력 사용 시 별도 안전 처리 필요 |

추천은 앞의 3개 조합이다. 직접 패키지 합계는 tgz 34,940 bytes, 압축 해제 113,251 bytes이며 **전이 의존성·lockfile 전체 설치 용량·실제 번들 증가량은 제외**한다. 그 추가 용량과 취약점 검사 결과는 승인 전 **확인 필요**로 보고한다. 정확한 버전을 고정하고 lockfile을 함께 관리한다. 근거: [react-markdown 배포 정보](https://registry.npmjs.org/react-markdown/10.1.0), [remark-gfm 배포 정보](https://registry.npmjs.org/remark-gfm/4.0.1), [gray-matter 배포 정보](https://registry.npmjs.org/gray-matter/4.0.3).

대안은 marked 기반 서버 렌더링 또는 정책을 별도 HTML로 변환하는 방식이다. 전자는 안전 처리와 테스트가 더 필요하고, 후자는 Markdown 원문과 결과의 동기화 부담이 있다. 표·중첩 번호 목록·링크를 만족시키기 위해 자체 Markdown 파서를 새로 만들지는 않는다. **사용자 의존성 승인 전에는 어느 후보도 추가하지 않는다.**

렌더러는 GFM 표, 번호 목록 안의 하위 목록, 링크를 보존한다. raw HTML 실행과 위험한 URL 스킴은 허용하지 않는다. Markdown source는 수정하지 않고, 미확정 자리표시의 공개 노출은 막으며 원문과 렌더 결과 차이를 QA에 기록한다. 문장이 불완전해지면 임의 보충하지 않고 확인 요청 대상으로 남긴다.

정책 전용 레이아웃: max-width 720px, 모바일 좌우 16px, 본문 16px/줄 간격 **1.7**, 보조 최소 14px, 대비 4.5:1 이상. 표는 max-width 100% 컨테이너 안에서만 `overflow-x: auto`; 페이지는 가로 넘침이 없어야 한다. 긴 URL은 줄바꿈한다. 링크 터치 영역 44px 이상, 개인정보 H3마다 고유 앵커를 만들고 동일한 규칙으로 목차를 생성한다. 중복 H3도 서로 다른 앵커를 갖는다.

### 사업자 정보와 푸터

| 설정 필드 | 값 | 화면 |
|---|---|---|
| 상호 | 딜라이트 커머스 | 표시 |
| 사업자등록번호 | 876-59-00934 | 표시 |
| 대표자명·주소·이메일·전화·통신판매업 신고번호·운영시간 | 빈 값, 미확정 | 해당 줄 자체 생략 |

`lib/business-info.ts` 한 곳에서 관리한다. 가짜 값·`#` 링크·더미 문구를 넣지 않는다. 문의는 실제 이메일이 확정될 때만 `mailto:`로 연결한다. 전화가 확정되면 표시·실제 `tel:` 연결을 검증한다. 정보는 모바일에서도 접지 않는다.

PC 푸터: 정책 링크 줄 → 사업자 정보 → 저작권 표기. 기존 브랜드 요소는 보존한다. 개인정보처리방침은 굵게 표시한다. 모바일은 링크 2열·터치 44px 이상. 푸터 정보는 최소 14px·줄 간격 1.6·대비 4.5:1 이상으로 표시하고 기존 색상 토큰을 참조한다. 기존 모바일 푸터 축약 CSS가 법적 링크·사업자 정보를 숨기지 않게 제한된 클래스 안에서 해소한다.

정책 본문과 사업자·링크 콘텐츠는 서버 컴포넌트에서 만들고, 현재 client footer의 경로 판정은 작은 route gate로 분리할 수 있다. 시험 메뉴에는 서버에서 읽은 **존재하는 정책의 metadata만** 전달한다. 클라이언트에 파일 시스템 코드나 정책 원문 전체를 넣지 않는다. 로그인/NAS/가격 완료 전에도 일반 화면의 서버 HTML에 링크·사업자 정보가 있어야 한다.

하단 여백은 `--bottom-nav-height` 기본 0과 `env(safe-area-inset-bottom, 0px)`을 반영한다. 이번 단계에서 탭을 만들지 않는다. 고정 구매 바 여백과 이중 적용되지 않게 검사한다.

시험 경로 파일은 `app/cbt/[certSlug]/exam/[attemptId]/page.tsx`다. 현재 footer는 `/^\/cbt\/[^/]+\/exam\//`에서 숨겨지고, `question-bank-client.tsx`의 `modal === "menu"`에 “계속 풀기 / 중간 채점 / 목록으로 나가기”가 있다. 여기에 정책 링크 **단일 행**만 추가한다. 좁으면 행 내부에서 스크롤하여 페이지 넘침을 막고 44px 터치를 유지한다. 새 탭으로 열고 이를 접근성 이름에 전달한다. 헤더 메뉴 구조·답안·시간·저장·종료 로직은 변경하지 않는다.

### validate-legal

| 검사 | 기본 | `LEGAL_STRICT=1` |
|---|---|---|
| 4개 문서 존재·title/effectiveDate·날짜 형식/확정 시행일 | 누락·오류를 경고 | 남아 있으면 실패 |
| 푸터/상단/시험 메뉴 링크 대상의 문서·페이지 존재 | 경고. 렌더링은 실제 존재하는 대상만 허용 | 불일치가 있으면 실패 |
| 상호·사업자등록번호 필수값 | 누락을 경고 | 누락 시 실패 |
| `[ ... ]` 미확정 자리표시 | 파일·위치를 보고. Markdown 링크 구문과 구분 | 남아 있으면 실패 |
| 대표자명·주소·이메일·전화·신고번호·운영시간 미확정 | 필드별 보고 | 빈 필드가 남아 있으면 실패 |

기본 `check`는 미수령 문서·미확정 값 때문에 가짜 문서를 만들어 통과시키지 않는다. strict는 사용자가 배포 직전에 켠다. strict가 꺼져도 경고 목록과 현재 렌더링한 문서 목록을 보고한다. 아직 4개 본문이 없어 4개 페이지의 완성·캡처를 주장할 수 없다. 일부만 받은 경우 부분 결과로 표시하며, 전체 C0 완료 여부는 사용자에게 확인받는다.

## 완료 기준

아래는 구현 후 기준이다. 현재 문서 작성으로 통과했다고 간주하지 않는다.

| 검사 | 통과 기준 |
|---|---|
| C0 원문 | 확정 사용자 Markdown만 사용, 승인하지 않은 본문 변경 0건. 미수령 문서 파일·페이지·링크 없음 |
| C0 정책 | 4개를 받은 뒤 각 페이지 360/390/430px 넘침 0. 표는 컨테이너 내부 스크롤, 긴 URL 줄바꿈, privacy H3 목차·중복 앵커 이동 |
| C0 링크·정보 | 실제 문서만 연결. 빈 사업자 필드 줄 없음. 일반 화면 서버 HTML에 법적 링크·사업자 정보 포함 |
| C0 시험 | 응시 중 푸터 숨김, 메뉴 정책 링크 동작, 새 탭 후 답안·타이머 유지 |
| C0 strict | `LEGAL_STRICT=1`에서 누락 문서/frontmatter·자리표시·미확정 필드·링크 불일치가 남으면 실패 |
| C1 스토어 | `/` 유지 및 `/store/`에서 기존 상품·CORE/PASS 가격·skeleton/실패 재시도·CTA 보존 |
| C2 생성 | 명시적 명령에서만 실제 catalog 자동 변환. timeout/잘못된 schema/중복/releaseId 누락 시 생성 실패·기존 파일 미손상 |
| C2 무변경 | 같은 sourceSha256에서 JSON 내용·generatedAt·mtime 및 Git diff 변화 0 |
| C2 오프라인 | NAS 차단 상태에서 유효한 커밋 JSON으로 build/check/tsc/dev 성공. 외부 네트워크 호출 **0건** |
| C2 로컬 검증 | JSON 누락·잘못된 schema·빈 releaseId에서 check와 npm/npx build 실패. 생성 안내. 자동 네트워크 복구 없음 |
| C2 재현성 | clean checkout·검사·빌드 후 snapshot 파일 해시와 Git diff 유지. sourceSha/releaseId 기록 |
| C3 초기 HTML | `/`에 제목·검색 label·실제 바로가기·본문 `/store/` 링크. NAS·가격 응답 대기 없음 |
| C3 첫 화면 | 360/390/430×700px에서 제목·검색·바로가기·스토어 링크. 실제 가용 종목이 4개 이상이면 최소 4개 보임 |
| C3 검색 | 실제 목록·초성/공백 정규화·최대 6결과·없음 안내, combobox 키보드/스크린리더·focus 처리 |
| C3 이동 | 기존 상세로 이동. 자동 시험/기록 생성 없음. 헤더와 본문에 `/store/` 상시 링크 |
| C3 헤더 | 메뉴 구조 유지. `/store/` 스토어 활성, `/` 학습 활성. 두 active 없음. 푸터 변경 없음 |
| 화면 수치 | 보조 14px 이상, 정책 본문 16px/1.7, 입력 16px, 터치 44×44px, 대비 4.5:1 이상 |
| 전체 넘침 | 모바일에서 document.documentElement.scrollWidth 및 document.scrollWidth가 innerWidth 이하 |
| CLS | 홈 CLS ≤0.1. 결과 변경은 overlay 또는 사용자 입력에 따른 변경으로 처리 |
| 회귀 | 기존 CBT 종목/시험/결과/오답·상품/장바구니/결제/자료 경로와 계약 유지 |
| 롤백 | C3 revert 후 이전 상품 홈·/store/·C0 푸터·정책 유지. snapshot 갱신 revert로 이전 releaseId/파일 해시 복원 |
| 캡처 | 각 커밋 Edge/Chromium·WebKit, 모바일 360/390/430 및 PC 768/1024/1280 전후 캡처. 신규 페이지는 이전 경로 부재 표시 |
| 필수 검사 | 각 단계 npm run check, npx tsc --noEmit, npx next build. C2부터 외부 통신 차단·기록 검증 추가 |
| 운영 경계 | 운영 배포·DB 쓰기·실결제 0건. C4 구현 0건 |

네트워크 0건은 코드 검색만으로 판정하지 않는다. 실행 기록으로 build/check/tsc/dev의 시작·컴파일·검사를 각각 검증한다.

가격·주문·권한과 외부 응답은 로컬 fixture로 검사한다. fixture 검증과 운영 실증을 구분한다. 홈에서 기존 인증 전용 요청이 발생하면 별도로 기록하며 NAS/가격 의존 제거와 혼동하지 않는다. 기존 폰트 가드의 최대 1.5초 대기와 NAS 대기를 구분한다.

## 커밋 구성과 롤백

선행 dirty 변경과 새 변경을 분리하고 실제 SHA를 기록한다. 예정 라벨을 실제 커밋으로 보고하지 않는다.

| 단위 | 예정 커밋 | 독립성·승인 경계 | 롤백 |
|---|---|---|---|
| C0 | `feat(legal): add policy pages and business footer` | 홈·snapshot에 의존하지 않음. 문서/의존성 승인과 결과 검토 후 C1 승인 | C0 revert로 정책 UI·푸터 추가만 제거. 홈·스토어·CBT 계약에는 영향 없음 |
| C1 | `feat(store): preserve storefront at store route` | `/` 유지. 결과 보고 후 C2 승인 | C3 취소 후 C1 제거 가능. 이미 공개한 /store/는 유지 권장 |
| C2 | `build(cbt): generate home catalog snapshot` | 생성기·검증·**추적된 JSON** 포함. 결과 보고 후 C3 승인 | C3 취소 후 revert. 최초 도입 취소는 helper·검증·JSON 제거이며 C0/C1 유지 |
| C3 | `feat(home): activate learning home and search` | 홈·검색·최소 헤더 변경만. **푸터 수정 없음** | 주 롤백 단위. /는 이전 상품 홈, /store/·C0 정책/푸터 유지 |
| 이후 snapshot 갱신 S | `chore(cbt): refresh home catalog snapshot` | 사용자 명시적 생성 결과만 별도 검토·커밋 | S revert만으로 이전 JSON·releaseId·generatedAt·sourceSha 복원. 생성 명령 실행 금지 |
| C4 | 별도 승인 후 결정 | 이번에는 계획만. 모델·계약·운영 DB 승인 필요 | 아래 데이터 보존 롤백 원칙 적용 |

각 커밋 뒤 **멈춤 → 실제 SHA/diff → 필수 검사 결과 → 캡처 → 남은 위험 → 다음 단계 승인** 순서로 보고한다. 승인 전 다음 단계 코드를 쓰지 않는다. C0의 본문이나 의존성 결정이 필요한 경우에도 해당 작업을 먼저 승인받는다.

```text
홈 전환만 취소: git revert <C3 실제 SHA>
  → 기존 / 상품 홈 복원, /store/와 C0 정책/푸터 유지
  → Git JSON은 그대로. catalog:snapshot 호출 없이 검사·빌드

snapshot 갱신 취소: git revert <S 실제 SHA>
  → 같은 이전 releaseId·해시·generatedAt 복원
  → 로컬 검증만 실행, NAS 접속 없이 빌드

홈 1단계 전체 취소: C3 → C2 → C1 순서로 revert
  → C0는 유지. /store/가 공개된 경우 C1은 유지

C0만 취소: git revert <C0 실제 SHA>
  → C1/C2/C3는 유지. 공유 package.json/layout 충돌은 해당 C0 변경만 제거
  → snapshot 검증·학습 홈 CSS/헤더·스토어 경로를 함께 지우지 않음
```

C0/C3 사이에 직접 코드 의존성을 만들지 않는다. 학습 홈 CSS도 정책·푸터 클래스를 덮어쓰지 않는다. 공유 파일에서 revert 충돌이 있으면 남길 변경을 diff로 확인하고 같은 승인/검증 절차를 적용한다. `reset --hard`, `git clean`, 운영 DB 삭제·키 변경은 사용하지 않는다. C0 독립 롤백은 레이아웃·기능 독립성을 뜻하며 공유 파일의 충돌 가능성을 숨기지 않는다.

## D 적용용 구현 지시문

```text
현재는 이 v2 계획 문서만 작성한다. 코드를 적용하지 않는다.
후속 명시적 구현 승인을 받았을 때만 아래 단계를 수행한다.

1. 기존 dirty 상태·기준 화면·계약을 보존한다. 앞선 모바일 작업을 섞지 않는다.
   C0 → C1 → C2 → C3 순서로 진행하며 각 커밋 후 결과 보고·다음 단계 승인을 받는다.

2. C0 전제: 사용자 확정 Markdown과 렌더러 의존성 승인을 확인한다.
   받은 본문만 content/legal/에 저장한다. title/effectiveDate frontmatter 사용.
   못 받은 문서는 파일·페이지·링크를 만들지 않는다. 본문 임의 작성/수정 금지.
   렌더러 새 패키지의 버전·직접/전이 용량·대안·검사 결과를 보고하고 설치 승인을 받는다.

3. C0 레이아웃: max 720px, 모바일 좌우 16px, 본문 16px/1.7, 보조 14px.
   GFM 표·번호 목록 내 하위 목록·링크를 지원한다. raw HTML 실행은 허용하지 않는다.
   표는 컨테이너에서만 스크롤, URL 줄바꿈, privacy H3 목차와 고유 앵커.
   다른 정책 링크는 실제 존재하는 문서만, 하단에 공통 사업자 정보.

4. C0 푸터: lib/business-info.ts 단일 설정. 상호/등록번호 확정값만 초기 표시.
   나머지 빈 필드는 줄째 생략. 실제 이메일 없으면 문의 링크도 생략.
   PC 링크→사업자→저작권, 모바일 2열·44px. 정보 접지 않음.
   링크·정보는 서버 HTML에 포함하고 auth/NAS/가격을 기다리지 않는다.
   --bottom-nav-height 기본 0 + safe-area. 탭은 만들지 않는다.
   응시 경로 /cbt/[certSlug]/exam/[attemptId]/에서는 기존 footer 숨김 유지.
   실제 시험 메뉴에 정책 링크 한 줄만 추가. 시험/헤더 메뉴 구조·계약 변경 금지.

5. C0 검사: validate-legal을 추가하고 기존 check를 보존한다.
   누락 문서/frontmatter·링크 대상·필수 사업자값·자리표시·미확정 필드 보고.
   기본 경고, LEGAL_STRICT=1 실패. 미확정을 가짜 값으로 해소하지 않는다.
   전후 캡처·검사·diff·미확정 보고 후 멈추고 C1 승인을 받는다.

6. C1: app/store/page.tsx에 기존 상품 홈 보존. /는 아직 상품 홈.
   HomeProducts·서버 가격·skeleton/재시도·CORE/PASS·CTA를 유지한다.
   /store/의 기존 헤더 스타일만 보정한다. 푸터는 C0 그대로 유지.
   검사·캡처·diff 보고 후 멈추고 C2 승인을 받는다.

7. C2: catalog 생성기는 사용자 명시적 npm run catalog:snapshot에서만 네트워크 사용.
   공개 catalog만 읽고 timeout 5초·재시도 1회·검증·원자적 교체·실패 시 보존.
   원본 SHA가 같고 기존 JSON이 유효하면 쓰지 않는다. generatedAt도 유지.
   data/cbt-home-catalog.generated.json을 Git에 커밋한다. 손편집 금지.
   next.config.ts·.gitignore 변경 없음. dev/tsc/build/check 자동 생성 금지.
   누락/schema/releaseId 오류는 로컬 검증에서 실패하고 생성 명령 안내.
   npm build와 npx next build 모두 로컬 검증을 실행하되 외부 요청은 0건.
   통신 차단/기록으로 검증하고 문제 발생 시 숨기지 말고 변경안부터 보고한다.
   검사·캡처·diff 보고 후 멈추고 C3 승인을 받는다.

8. C3: 루트에서 NAS·가격 조회를 제거하고 snapshot 정적 import로 학습 홈 렌더링.
   제목·검색·실제 바로가기·전체 종목 링크·상시 /store/ 링크를 서버 HTML에 넣는다.
   기존 certSlug·URL 규칙, combobox 키보드/접근성을 지킨다. 자동 시험 생성 금지.
   헤더 메뉴 구조 유지, 스토어 href/루트 활성 상태만 보정한다.
   /store/ 링크는 본문과 헤더에 유지. 푸터 파일·문구·스타일을 수정하지 않는다.
   새 홈 CSS만 한정 적용, 기존 토큰 사용, 2단계 기능 추가 금지.

9. 각 단계 Chromium/WebKit 360/390/430 및 PC 768/1024/1280을 검사·캡처한다.
   check/tsc/npx next build 통과, strict 실패 fixture, 외부 요청 0건, 회귀를 기록한다.
   C3 revert 후 C0 정책/푸터·/store/ 보존과 S revert의 snapshot 복원을 검증한다.
   실제 SHA·releaseId·diff·캡처·미검증 항목을 docs/STORE_MOBILE_QA.md에 추가한다.

10. C4는 계획만 유지한다. 결제 체크박스/API/SQL/다운로드 시작 기록을 구현하지 않는다.
    운영 배포·운영 DB 쓰기·실결제는 어떤 단계에서도 하지 않는다.
```

## 미확정 사항

| 항목 | 현재 확인 | 다음 결정 |
|---|---|---|
| 정책 본문 확정 시점 | 사용자 검토 중. 이전 첨부는 초안 | 확정 Markdown을 문서별로 제공. 원문을 임의 사용하지 않음 |
| 대표자명·주소·이메일·전화·신고번호·운영시간 | 미확정 | 사용자 제공 전 줄 생략, strict에서 실패 |
| 문의 | 실제 이메일/문의 목적지 없음 | 확정된 연락처 제공 후 연결 |
| Markdown 의존성 | 기존 없음. 후보 직접 패키지 크기 확인 | 전이 용량·안전 처리·검사 및 사용자 설치 승인 **확인 필요** |
| 실제 catalog·releaseId | 타입/schema/env 경로만 로컬 확인 | 사용자가 명시적 생성 명령 실행 시 실제 응답 확인 |
| build/check/tsc/dev 외부 통신 | 코드상 local font, 가격 외부 fetch 확인. 통신 실측 미실시 | C2에서 실제 차단·기록 검증 **확인 필요** |
| C0 부분 구현 완료 판단 | 4개 본문이 없어 전체 정책 검증 불가 | 일부 수령 시 부분 범위·C1 진행 여부를 별도 승인 |
| C4 모델·계약·DB 변경 | 아래 선택지만 검토. 운영 schema 미조회 | 모델 선택·기록 기준·마이그레이션·운영 적용 별도 승인 |

### C4 — 결제 화면 고지와 동의 기록: 계획만

확정 환불정책의 고지 문구를 결제 버튼 바로 위에 두고, 다른 동의와 분리한 필수 체크박스를 기본 미체크로 둔다. 그 아래 실제 이용약관·개인정보처리방침·환불정책 링크를 제공한다. 고지 문구는 아직 미확정이므로 작성하지 않는다. 기존 금액 확인 체크박스를 대체하지 않는다.

#### 현재 주문·결제·미리보기·다운로드 확인

| 확인 대상 | 로컬 근거·결과 | 한계 |
|---|---|---|
| 주문 모델 | `0001_v1_core.sql` 및 후속 orders migration에 금액·상태·paid_at 등 있음. 동의 시각/버전 컬럼은 없음 | 실제 운영 DB에 동일 schema인지 **확인 필요** |
| 결제 시작 | `payment-start/index.ts`는 productSlug/productSlugs/idempotencyKey만 허용, 다른 필드는 거부. create_direct_checkout RPC로 주문 생성 | 동의 필드를 추가하면 요청/RPC 계약 검토 필요 |
| 현재 UI | checkout-client의 confirmed는 기존 금액 확인. 이후 PortOne SDK 호출 | 환불 별도 동의 저장 없음 |
| 결제 이벤트 | paid/failed/cancelled/refunded 용도 | 동의 이벤트를 끼워 넣거나 의미를 바꾸지 않음 |
| 상품 샘플 | 상품 상세는 ProductGallery에 pages를 넘기지 않음. 기본 pages=[]이므로 현재 표지 목업만 표시. 컴포넌트는 실제 이미지가 있을 때 추가 페이지를 표시할 수 있음 | 실제 판매 PDF 샘플 제공은 현재 상세에서 확인되지 않음. public의 cbt-mock-preview는 판매 자료 샘플이 아님 |
| 제공 시작 기록 | download-url은 권한/자료를 확인해 서명 URL을 만들고 download_events의 signed_url_created·created_at·expires_at을 저장. client는 URL로 이동 | 서명 URL 발급이 실제 다운로드/열람 시작을 증명하지 않음 |
| 기록 실패 | download event 저장 실패는 로그를 남기지만 URL 응답을 계속 제공 | 모든 제공 시점에 기록이 존재한다고 보장할 수 없음 |
| 열람/완료 | 해당 다운로드 코드 경로에 실제 PDF 열람·바이트 수신 시작·완료 이벤트 없음 | Storage 접근 로그 등 외부 증거의 존재·보유는 **확인 필요** |

상품에 실제 미리보기/샘플을 추가하려면 사용자 제공 파일·공개 허용 범위를 먼저 확인한다. 본문·샘플을 만들거나 유료 원본을 임의 공개하지 않는다. signed_url_created를 다운로드·열람 시작으로 재명명하는 것만으로 증거를 만들지 않는다. 제공 개시의 정의와 실제 기록 방법은 사용자 판단을 받아야 한다.

#### 데이터 모델 선택지

| 선택지 | 저장·흐름 | 마이그레이션 위험 | 롤백 |
|---|---|---|---|
| A 주문 컬럼 추가 | orders에 refund_consent_at(서버 UTC), refund_policy_effective_date 추가. 필요시 고지 해시도 보관. 인증·소유권 검증한 서버 경로로 기록 | 기존 주문에는 NULL. 허위 과거 동의 backfill 금지. orders DDL 잠금·동시 결제·RPC/권한·구버전 클라이언트 호환성 검토. 처음부터 NOT NULL을 걸면 과거 주문/구버전 흐름이 깨질 수 있음 | 먼저 새 UI/API 의존을 해제. 컬럼과 기록은 유지해 구버전 동작 복원. 데이터/컬럼 삭제는 별도 승인 |
| B 별도 동의 테이블 — 검토 우선안 | order_policy_consents에 order_id·사용자 연결·동의 종류·accepted_at(서버 UTC)·정책 effectiveDate·고지 해시. 새 API에서 소유권·버전 검증, 같은 주문/버전의 재시도는 중복 방지 | FK·고아 기록·RLS/GRANT·API 배포 순서·읽기/삭제 권한·보유 기준 검토. 주문 삭제/회원 탈퇴에 미치는 FK 동작을 임의 확정하지 않음 | 앱 호출부터 되돌리고 테이블은 읽기 제한·기록 보존. 자동 DROP/운영 데이터 삭제 금지 |

동의한 정책의 effectiveDate는 실제 표시한 frontmatter에서 가져온다. 브라우저가 보낸 시각을 기록의 기준으로 쓰지 않는다. 같은 시행일에 본문이 바뀌는 상황을 구별하려면 고지/문서 해시를 추가하는 안을 제안하며, 구체적인 버전 기준은 **확인 필요**다. 정책 링크를 표시한 것을 모두 동의한 것으로 기록하지 않는다.

동의 기록 완료 전에 결제를 시작하지 않는 UI 흐름과, 서버에서 모든 결제 요청에 동의를 강제하는 계약은 다르다. 후자를 원하면 현재 payment-start/RPC·결제 가능 시점·기존 주문/구버전 클라이언트 처리까지 승인해야 한다. 정상 결제 webhook을 동의 기록 유무만으로 무시해 결제 사실이나 권한 상태를 잃는 방식은 채택하지 않는다.

#### 별도 승인이 필요한 지점

1. 확정 고지 문구, 동의 대상 정책·버전, 미리보기 공개 범위와 제공 개시의 정의.
2. A/B 모델 선택, API/RPC 및 결제 진입 계약 변경 범위, 기존 주문의 NULL/미동의 처리.
3. 로컬 구현·마이그레이션 파일 생성·검증 착수. 승인 전에는 SQL/API를 만들지 않음.
4. 운영 schema 확인, 백업·권한·적용 순서·rollback 검토 후 **운영 DB 변경과 함수/웹 배포의 별도 승인**.

현재 운영 DB·실결제를 검증하지 않았고 C4 코드도 변경하지 않았다. 동의 기록·제공 시작 기록을 법적 증거로 어떤 범위까지 사용할지는 기술 구현만으로 확정하지 않는다.
