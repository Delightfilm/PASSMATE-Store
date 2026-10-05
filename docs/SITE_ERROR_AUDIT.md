# 사이트 오류 검토 및 수정 — 2026-10-04

로컬 체크아웃 `codex/store-mobile-optimization`에서 스토어·계정·문제은행·관리자 화면과 서버 권한·금액 검사를 점검했다. 재현한 오류를 수정했고 `npm run check`, `npx tsc --noEmit`, `npx next build`가 모두 exit 0으로 완료됐다.

운영 배포, 운영 DB 변경, 실제 결제, 실제 자료 발급, 유료 AI 생성은 실행하지 않았다. 기존 모바일 최적화 작업과 관계없는 `supabase/.temp/`도 보존했다. 이번 수정에는 CSS 또는 브레이크포인트 변경이 없으며, 정상 상태의 데스크톱 디자인을 바꾸지 않았다.

## 발견한 오류와 수정

| 재현 조건 | 수정 전 | 수정 후 |
|---|---|---|
| SNS 로그인 확인 화면에서 sessionStorage 접근 차단 | `Storage blocked` 예외로 화면 중단 | 읽기·삭제 실패를 처리하고 로그인 오류 안내 또는 정상 세션 복원 경로 유지 |
| Google 로그인 버튼에서 sessionStorage 접근 차단 | 저장 실패 후 정리 작업도 실패하여 `연결 중` 상태가 남음 | 선택적인 이동 경로 저장이 실패해도 OAuth URL 생성·이동 가능; 실제 OAuth 요청 실패 시 버튼 상태 복구 |
| 학습 기록에 `attempts:null`, `bookmarks:null` 저장 | 북마크 화면에서 `reading 'find'` 예외 | 입력을 unknown으로 검증하고 유효한 배열·기록만 사용 |
| 동일한 잘못된 기록으로 계정 화면 접속 | `reading 'filter'` 예외 | 정상 계정 또는 로그인 안내 표시 |
| 장바구니 저장 용량 부족 | `QuotaExceededError` 예외, 저장 실패 안내 없음 | 실패 안내 표시; 삭제 실패 시 기존 장바구니 유지 |
| 시험 시작·답안 저장 시 저장 용량 부족 | 예외가 발생하여 작업 중단 | 학습 기록 저장 실패 안내; 초기 기록 저장 실패 시 시험 화면 이동 보류; 저장 실패를 성공으로 처리하지 않음 |
| 관리자 문항 파일에 `questions:{}` 또는 `[null]` 입력 | `rows.forEach is not a function`, `reading 'stem'`; 처리 중 상태가 복구되지 않음 | 배열·행 객체·빈 목록 검사, 행별 오류 표시, 버튼 상태 복구, 오류 파일의 DB 저장 비활성화 |

정상 기록의 답안, 시험 시작·종료 시간, 북마크, 메모는 보존한다. 5지선다처럼 보기 수가 다른 문제의 답안 위치도 보존하며, 잘못된 제출 날짜와 점수 객체는 렌더링에 전달하지 않는다. 읽기 단계에서 저장소를 덮어쓰거나 전체 기록을 삭제하지 않는다. 관리자 가져오기의 중복 문항 보존 정책도 유지한다.

OAuth의 `next`는 기존 내부 경로 검사를 유지한다. 저장소 접근이 차단되고 명시적인 `next`도 없으면 `/library/`로 돌아간다. 저장소를 사용할 수 없을 때 원래 선택한 복귀 경로까지 복원하는 실제 OAuth E2E는 보장하지 않는다.

## 캡처와 재현 증거

[수정 전후 비교 및 기능 캡처](../../tmp/site-audit/index.html) — 로컬 서버로는 `http://127.0.0.1:3022/site-audit/index.html`.

비교 이미지 12개와 기능 이미지 22개, 총 34개가 브라우저에서 모두 로드되는 것을 확인했다.

| 사례 | 수정 전 | 수정 후 |
|---|---|---|
| SNS 확인 화면 | [캡처](../../tmp/site-audit/before-oauth-storage.png) | [캡처](../../tmp/site-audit/after-oauth-storage.png) |
| SNS 버튼 | [캡처](../../tmp/site-audit/before-oauth-button-storage.png) | [캡처](../../tmp/site-audit/after-oauth-button-storage.png) |
| 북마크의 잘못된 기록 | [캡처](../../tmp/site-audit/before-cbt-storage.png) | [캡처](../../tmp/site-audit/after-cbt-storage.png) |
| 계정의 잘못된 기록 | [캡처](../../tmp/site-audit/before-account-storage.png) | [캡처](../../tmp/site-audit/after-account-storage.png) |
| 장바구니 저장 실패 | [캡처](../../tmp/site-audit/before-cart-write.png) | [캡처](../../tmp/site-audit/after-cart-write.png) |
| 시험 시작 저장 실패 | [캡처](../../tmp/site-audit/before-edge-cbt-quota.png) | [캡처](../../tmp/site-audit/after-edge-cbt-quota.png) |
| 관리자 잘못된 JSON | 파서를 직접 실행하여 위 두 예외 재현; 수정 전 UI 캡처 없음 | [Edge](../../tmp/site-audit/after-edge-admin-import.png), [WebKit](../../tmp/site-audit/after-webkit-admin-import.png) |

SNS 버튼 수정 후 캡처는 실제 Google 로그인 페이지 대신 로컬 테스트 HTML로 이동한 결과다. 테스트용 JWT·사용자·주문·상품 응답은 운영 계정 또는 결제가 아니다.

## 검증 범위와 결과

### 경로 검사: 100건

25개 경로 × 390/1280px × Edge/WebKit. 예상한 200/404 응답, 빈 화면 없음, pageerror 없음, 실패한 네트워크 요청 없음. 이 검사는 화면의 최초 표시와 오류 처리를 확인하며, 각 화면의 모든 버튼이나 실제 로그인 이후 작업을 증명하지 않는다.

대상: `/`, `/products/`, 실제·존재하지 않는 상품 상세, `/library/`, `/cart/`, `/checkout/`의 빈 상품·상품 지정, `/checkout/complete/`, `/account/`, 로그인·가입·비밀번호 찾기·재설정·OAuth 취소, `/admin/`, 관리자 상품 미리보기, `/cbt/`, 북마크·오답노트·내 기록·존재하지 않는 종목·시험 기록, `/question-bank/`, 없는 페이지.

처음 WebKit의 외부 Supabase GET이 샌드박스에서 차단되어 접근 제어 오류가 발생했다. 운영 쓰기 차단을 유지한 채 승인된 샌드박스 밖 재실행에서는 50건 모두 실패 요청 없이 통과했다. 사이트 코드를 변경하여 네트워크 제한을 우회하지 않았다.

[Edge 결과](../../tmp/site-audit/after-edge-smoke.json), [WebKit 결과](../../tmp/site-audit/after-webkit-smoke.json).

### 기능·실패 응답 검사: 각 엔진 11건

아래 검증은 실제 UI와 로컬 응답을 연결한 검사다. 외부 POST/PATCH/DELETE는 계속 차단하거나 응답을 대체했다.

| 시나리오 | 확인 결과 |
|---|---|
| 일반 회원 관리자 진입 | 접근 거부 표시, 관리자 함수 요청 없음 |
| 관리자 잘못된 문항 파일 | 행 오류 표시, 처리 중 상태 해제, DB 저장 버튼 비활성화 |
| 내 자료 준비/완료 상태 | 완료된 자료 1개만 다운로드 활성화, 준비 중 버튼 비활성화 |
| 자료 조회 503 | 구매 자료 조회 실패 안내 |
| 다운로드 409 | 자료 준비 중 안내, 버튼 상태 복구 |
| 장바구니 담기·삭제 | 실제 SKU `computer-literacy-2` 저장, 삭제 후 빈 상태 |
| 삭제 저장 용량 부족 | 실패 안내, 화면과 저장소의 기존 항목 1개 유지 |
| 결제 응답 합계 불일치 | 항목 합계 5,900원/총액 1원인 응답 거부, 결제창 열기 버튼 없음 |
| 비회원 시험 | 시작 → 첫 보기 선택 → 새로고침 후 답안 복원 → 제출 전 검토 → 최종 제출 → 50점/오답 1개 저장 |
| 시험 시작 저장 실패 | 안내 표시, 시험 화면으로 이동하지 않음, 미저장 기록 생성 없음 |
| 잘못된 종목 주소 | 렌더링 예외 없이 없는 종목 처리 |

[Edge 기능 결과](../../tmp/site-audit/after-edge-flows.json), [WebKit 기능 결과](../../tmp/site-audit/after-webkit-flows.json). 추가 저장소 재현은 [수정 전](../../tmp/site-audit/before-probe.json)/[수정 후](../../tmp/site-audit/after-probe.json), 장바구니 저장 실패는 [수정 후 결과](../../tmp/site-audit/after-cart-write.json).

### 서버 권한·금액 검사

- `supabase/functions/admin-action/index.ts`와 관리자 데이터·문항 함수는 인증된 사용자와 DB의 관리자 역할을 검사한다. 클라이언트 메뉴 표시만으로 권한을 부여하지 않는다.
- `payment-start`는 클라이언트 표시 금액을 받지 않고 `productSlugs`로 `create_direct_checkout`를 호출한다. DB 함수가 활성 상품·버전을 조회하고 `products.price_krw`로 주문/결제 시도 금액을 확정한다. 서버 응답도 항목 합계를 검사한다.
- `payment-sync`는 주문 소유자, PortOne의 통화·금액과 서버 결제 시도의 금액을 비교한다. 해당 결제 RPC의 상태 검사를 기존 계약 검사로 확인했다. 실제 PortOne 결제 승인 요청은 수행하지 않았다.
- `download-url`은 인증된 사용자 ID로 `resolve_download_artifact`를 호출한다. SQL 함수는 entitlement/주문 소유자, `paid`, `ready`, 활성 권한 등을 검사하고 비공개 파일의 60초 URL을 생성한다. 실제 서명 URL 발급은 수행하지 않았다.
- CBT 제출 API는 서버에서 세션을 확인하고 사용자 ID·client_id·진행 중 상태로 갱신 범위를 제한한다. AI 해설은 서버 계약 검사만 실행했으며 유료 생성 또는 운영 캐시 쓰기는 하지 않았다.

## 변경 파일

- `lib/auth-ui.ts`: 저장소 접근 실패를 처리하는 OAuth 복귀 경로 도우미.
- `components/auth-form.tsx`, `components/oauth-callback.tsx`: 도우미 사용, 세션 조회 rejection 처리.
- `lib/question-bank.ts`: 학습 저장소 구조 정규화, 문항 가져오기 입력 검사.
- `components/question-bank-client.tsx`: 저장 실패 안내와 시험 시작 보류.
- `components/question-bank-admin.tsx`: 가져오기 try/catch/finally, 이전 미리보기 초기화.
- `components/product-purchase-options.tsx`, `components/cart-client.tsx`: 장바구니 저장 실패 안내와 기존 상태 보존.
- `scripts/validate-browser-storage.mjs`, `package.json`: 실제 TS 함수를 실행하는 회귀 검사를 `npm run check`에 추가.
- `scripts/validate-auth-config.mjs`: 저장소 호출의 도우미 이동을 반영. 키 노출, SNS 제공자, skipBrowserRedirect, URL 이동, 안전한 next 복원 검사를 유지했다. 예전 직접 호출 문자열만 도우미 및 실제 저장소 호출 검사로 바꿨다.
- `docs/SITE_ERROR_AUDIT.md`, `docs/STORE_MOBILE_QA.md`: 이번 결과 기록.

캡처 도구와 HTML은 작업공간 `tmp/`에 있다: `site-audit-capture.cjs`, `site-audit-storage-write.cjs`, `site-audit-smoke.cjs`, `site-audit-flows.cjs`, `site-audit-report.cjs`, `site-audit/`.

## 남은 검증과 운영 경계

실제 Google/Kakao 인증, 회원 가입 메일·재설정 메일, 로그인 계정의 운영 학습 기록 저장, 관리자 DB 쓰기, PortOne 결제 승인, NAS 발급 PDF의 실제 다운로드, 실기기 Safari는 실행하지 않았다. 기존 운영 마이그레이션 이력과 배포된 Edge 함수가 이 체크아웃과 일치하는지까지 이 로컬 검사만으로 확정하지 않는다. 저장소가 계속 차단된 브라우저에서는 장바구니·학습 기록의 영속 저장을 사용할 수 없으며 새 안내가 그 실패를 명시한다.

로컬 앱은 `http://127.0.0.1:3017/`이며 같은 공유기의 휴대전화에서는 기존 안내대로 `http://192.168.0.6:3017/`에 접속할 수 있다. 실제 휴대전화 접속은 아직 미검증이다. 운영 배포 없이 결과를 검토할 수 있도록 로컬 서버를 유지했다.
