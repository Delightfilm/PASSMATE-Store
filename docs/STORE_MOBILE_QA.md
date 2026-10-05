# 스토어 모바일 최적화 — 2026-10-04

> 2026-10-05 공통 푸터 추가 수정: 대표·사업장 주소·메일을 확정 설정에 반영하고, 참고 화면의 간결한 링크/사업자 구조를 적용했다. 전화번호는 사용자 요청으로 비공개이며 법적 표시 미충족으로 남긴다. 정책 본문은 아직 확정되지 않아 404 정책 링크를 만들지 않는다. 이번 푸터 캡처는 워크스페이스 `reports/learning-home-release-20261005/footer-contact-*`에 기록한다.

이번 로컬 검증은 홈/스토어/CBT를 Chromium 360/390/430/1280px 12건, WebKit 360/390/430px 9건으로 진행했다. 가로 넘침·JS 오류 0, 홈/푸터 텍스트 대비 최저 6.702:1. 푸터 링크 전체를 별도 측정해 최소 44×44px, 최소 글자 14px을 확인했다. 검사·타입 검사·외부 데이터 요청 없는 빌드를 통과했다. 실제 운영 결과와 이메일 라우팅 상태는 배포 후 `reports/learning-home-release-20261005/FOOTER_CONTACT_UPDATE.md`에 기록한다.

> 2026-10-05 학습 홈 전환: 기존 스토어 홈은 `/store/`로 보존했습니다. 최신 검증·캡처·커밋별 롤백은 [LEARNING_HOME_RELEASE_QA.md](./LEARNING_HOME_RELEASE_QA.md)에 이어서 정리했습니다. 미확정 정책 본문과 결제 동의 DB 변경은 제외했습니다.

## 변경 전 운영 화면

360 / 390 / 430px에서 홈, 상품 목록, 상품 상세, 내 자료 경로를 캡처했다. 원본과 측정값은 워크스페이스 PASSMATE의 `tmp/store-mobile/before-*.png`, `before-metrics.json`에 보관한다.

- 세 폭 모두 가로 넘침은 없었다.
- 헤더는 로고, 서비스 전환, 메뉴를 한 줄에 배치하며 총 높이 57px. 로고 링크 폭 40px.
- 홈 대표 상품과 비교 첫 카드가 같은 핵심노트다. 히어로 설명 14px, 좌우 여백 14px, 표지 폭 약 1/3. 비교 가격과 CTA는 수직 배치.
- 상품 목록 상세 링크 높이 19.5px. 보조 색은 화면별 하드코딩되어 있다.
- 상품 상세의 큰 표지가 구매 정보보다 앞에 긴 공간을 차지한다. 모바일 비교는 2열 표 형태이며 하단 고정 구매 바가 없다.
- 가격은 클라이언트 조회 전 텍스트 로딩 상태를 사용한다. 상품 목록/상세 초기 HTML에 운영 가격이 없다.
- 비로그인 내 자료는 로그인 페이지로 이동한다. 해당 전환에서 CLS 0.066~0.074, 회원가입/비밀번호 찾기 링크 높이 약 20px.

## 검증 범위

운영의 내 자료는 비로그인 진입 경로를 확인한다. 로그인한 자료 목록/빈 상태/준비 상태는 인증 및 API 응답을 가로채는 브라우저 fixture로 별도 확인하며 실계정 또는 실다운로드 검증과 구별한다. 운영 데이터 및 결제 상태는 수정하지 않는다.

## 구현

- `app/store-mobile.css`: 767px 이하 전용 레이아웃, 640px 이하 히어로 설명 한 줄/말줄임(원문은 DOM에 보존), 375px 이하 비교 CTA 풀폭. 768px 이상은 기존 디자인 유지.
- 본문 15px / 보조 13px / 뱃지 12px, 터치 44px, 좌우 16px. 브랜드 및 표지 색은 기존 색의 CSS 토큰 참조.
- 헤더 sticky 콘텐츠 56px(안전영역 별도), 로고/메뉴 상단 및 서비스 전환 아래. 요약노트/내 자료는 기존 메뉴 사용.
- 홈 대표 핵심노트 중복 제거, 표지 43% 가로 카드, 비교 카드 전체 링크 확대.
- 상세는 두 체크리스트 카드와 선택명/가격/장바구니/구매하기 고정 바. safe-area 및 본문/푸터 하단 패딩 반영.
- 가격 서버 조회와 초기 HTML 포함, 브라우저 초기/포커스/재시도 갱신 유지. 초기 가격이 없을 때 skeleton과 disabled 구매하기, 실패 시 다시 시도.
- 가격 슬롯 44px 고정 및 기준선 고정. font swap 이동을 피하도록 모바일 첫 표시는 기존 폰트의 준비 완료 후 표시.
- 모바일 비로그인 내 자료는 문서 이동으로 로그인 페이지에 진입. 인증/결제/다운로드 권한 규칙은 유지.

## 검증 결과 (로컬 운영 빌드)

| 폭 | 4개 페이지 가로 넘침 | CLS | 44px 미만 터치 | 홈 CTA 하단 |
|---|---|---|---|---|
| 360 | 없음 | 0 | 0개 | 700px 안 |
| 390 | 없음 | 0 | 0개 | 700px 안 |
| 430 | 없음 | 0 | 0개 | 700px 안 |

- 640 / 767px에서도 가로 넘침, 글자 크기, 터치 영역 검증.
- 보조 텍스트 측정 대비 최소 7.23:1. 본문/보조/뱃지 최소 크기 검사 통과.
- 768 / 1024 / 1280px의 네 화면(12쌍)은 전환 애니메이션을 완료한 스크린샷 기준 픽셀 차이 0.
- 브라우저 29개 흐름: 페이지 20개, 인증 내 자료 fixture 6개, 가격 지연/실패/재시도 fixture 3개.
- 가격 skeleton → 실패 → 재시도 성공에서 구매 바 높이 유지 및 CLS 0 확인.
- 패키지 전환 → 선택 이름/가격/checkout SKU 동기화, 로컬 장바구니 추가, 메뉴 열기/Escape, 하단 구매 바 고정 확인.
- 전체 `npm run check`, `npx tsc --noEmit`, `npx next build` 통과. 기존 cart contract 검사에서 공통 가격 hook 경로를 반영했다.
- 공개 운영 DB를 읽어 초기 HTML의 5,900원 / 9,900원 확인. 비공개 키 또는 운영 DB 변경 없음.
- iOS safe-area는 CSS 적용이며 실제 기기 검증은 수행하지 않았다. 인증 목록/가격 실패는 fixture이며 실계정 다운로드/결제를 수행하지 않았다.
- 운영 배포는 수행하지 않았다. 브랜치 `codex/store-mobile-optimization`의 로컬 구현/검증 상태다.

## 산출물 및 재현

- 비교 보고서: 워크스페이스 `tmp/store-mobile/index.html` (서버 `http://127.0.0.1:3021/index.html`).
- 운영 변경 전 12장 / 변경 후 12장과 추가 태블릿·데스크톱 캡처, 내 자료 fixture 및 가격 skeleton/실패 캡처를 같은 폴더에 보관.
- 측정: `before-metrics.json`, `after-metrics.json`, `verification.json`, `desktop-before-metrics.json`, `after-desktop-metrics.json`, `desktop-diff.json`.
- 캡처: 워크스페이스 루트에서 `node tmp/store-mobile-capture.cjs http://localhost:3017 after`.
- 브라우저 검증: `node tmp/store-mobile-capture.cjs http://localhost:3017 verify`. 번들 Playwright 및 Edge 사용. API fixture는 실제 네트워크 요청을 가로채며 운영 데이터에 쓰지 않는다.

## 변경 파일 (17개)

- 앱: `app/layout.tsx`, `app/page.tsx`, `app/products/page.tsx`, `app/products/[slug]/page.tsx`, `app/tokens.css`, `app/store-mobile.css`.
- 컴포넌트: `components/site-header.tsx`, `components/home-products.tsx`, `components/product-card.tsx`, `components/product-purchase-options.tsx`, `components/product-price.tsx`, `components/library-client.tsx`.
- 가격: `lib/server-product-prices.ts`, `lib/use-product-prices.ts`.
- 검사/문서: `scripts/validate-cart-contract.mjs`, `docs/DESIGN_SYSTEM.md`, `docs/STORE_MOBILE_QA.md`.

## 2026-10-04 배포 전 추가 QA — 6개 요청

이 절의 “변경 전”은 1차 모바일 최적화를 마친 로컬 빌드이며, 앞 절의 운영 원본 캡처와 구분한다. 운영 배포, 운영 DB 쓰기, 실제 주문/결제, 실계정 다운로드를 수행하지 않았다. 가격 읽기와 로컬 네트워크/API fixture만 사용했다.

[추가 QA 캡처 비교](../../tmp/store-mobile-followup/index.html) · 브라우저 보고서 `http://127.0.0.1:3022/store-mobile-followup/index.html`

비교 보고서의 전체 53개 이미지 쌍이 실제로 로드되는 것도 검증했다. [보고서 미리보기](../../tmp/store-mobile-followup/report-preview.png).

| 항목 | 변경 전 | 변경 후 / 확인 결과 |
|---|---|---|
| 폰트 | 늦은 요청이 끝나지 않으면 1.65초 관측에서도 빈 화면 | 1.45초 타이머 + 폴백. 지연/실패 16개 모두 visible. 실측 1.451~1.465초 |
| 홈 문구 | 비교 카드는 1개인데 선택을 요구 | 모바일 제목/라벨과 핵심노트 CTA만 변경. 5,900원과 핵심노트 상세 링크 확인 |
| 계약 검사 | options에서 조회 이름을 확인하던 검사를 훅 이름으로 치환 | 원래 SQL/가격/수량 검사는 보존. 실제 훅 호출 및 CORE/PASS 가격·SKU 결합 검사, 회귀 변형 3개 차단 |
| 가격 캐시 | 서버 no-store, 브라우저 mount/focus 조회 | 정책 변경 없음. 이전 가격 → 갱신 가격 경합은 fixture로 재현 |
| WebKit | Chromium 중심 검증 | WebKit 26.5 / Playwright 1.62.1, 29개 흐름 통과. 실제 iOS Safari는 사용자 실기기 확인 필요 |
| 색 | 4개 파일의 422개 리터럴 / 183개 고유 값 | 값은 유지하고 tokens.css 참조로 이동. tokens.css 밖 색 리터럴 0. 데스크톱 12쌍 픽셀 차이 0 |

### 1. 폰트 로딩 안전장치

`lib/store-font-guard.ts`의 스크립트를 head에서 실행한다. `DOMContentLoaded`를 기다리기 전에 타이머를 등록하므로 HTML 준비 이벤트가 지연되어도 숨김 해제 기한이 시작된다. 최대 1.5초 예산 안에서 타이머와 다음 화면 표시가 실행될 여유를 두려고 1450ms로 예약했다. 폰트 준비 성공은 즉시 표시하고, 폰트 오류/Font Loading API 부재/타임아웃은 기본 폰트로 표시한다.

`store-font-fallback`에서는 모바일의 `--font-ui`를 system-ui / Apple SD Gothic Neo / Noto Sans KR 등 기존 폴백 스택으로 지정한다. 화면을 한 번 표시하면 늦게 도착한 웹폰트로 다시 바꾸지 않는다. ≤767px 스토어 경로와 내 자료의 로그인 경로에만 적용되며 ≥768px에는 숨김과 폴백 재정의가 적용되지 않는다.

- 360px에서 4개 경로 × 지연/실패 × WebKit/Edge = 16개. 폰트 woff2 요청을 실제로 가로챈 횟수도 확인했다.
- 지연은 요청을 완료시키지 않은 채 캡처했다. 실패는 네트워크 abort를 사용했다. 요청을 나중에 풀어 폰트 준비가 끝난 뒤에도 폴백 유지 확인.
- WebKit 지연 측정: 1453 / 1465 / 1451 / 1459ms. Edge: 1463.7 / 1464.2 / 1460.1 / 1464ms.
- [전후 측정 JSON](../../tmp/store-mobile-followup/after-font.json), 비교 보고서의 “폰트 지연/실패”.
- [전: WebKit 홈 360px](../../tmp/store-mobile-followup/before-font-webkit-delay-home-360.png) / [후: WebKit 홈 360px](../../tmp/store-mobile-followup/after-font-webkit-delay-home-360.png).

### 2. 모바일 홈 문구

후보:

1. **완성패키지 구성도 살펴보세요.** — 적용.
2. 핵심노트에 개념과 문제를 더하세요.

모바일 비교 섹션 라벨은 “완성패키지”, 제목은 후보 1로 변경했다. 대표 상품에는 핵심노트 상품명, 실제 조회 가격 5,900원, “핵심노트 자세히 보기” 링크가 함께 보인다. 링크는 `/products/computer-literacy-2`이며 상세의 최초 선택은 CORE다. 모바일 CTA 하단은 Chromium 545~555px, WebKit 550~565px로 첫 700px 안에 들어온다.

데스크톱의 “상품 비교 / 내 학습에 맞는 구성을 고르세요. / 상품 상세 보기”는 그대로다. `store-mobile-copy`와 `store-desktop-copy` 표시 전환은 ≤767px에만 적용한다.

[홈 360px 전](../../tmp/store-mobile/followup-before-webkit-home-360.png) / [후](../../tmp/store-mobile/followup-after-webkit-home-360.png). 보고서에서 390/430px도 선택할 수 있다.

### 3. 장바구니 검사 diff와 가격 권한

기존 options 내부의 `fetchLiveProductPrices` 호출을 공용 `useProductPrices`로 이동했으므로 검사도 실제 호출 경로를 따라가도록 바꿨다. 기존 불변 조건(PACKAGE_PRICES/getPackagePrice 금지, 활성 상품 가격 조회, 중복 수량 금지, 중복 SKU/상충 패키지 금지, advisory lock, idempotency, DB 금액 합산, canonical slug)은 삭제하지 않았다.

이름 검사만으로는 잘못된 SKU 연결을 잡지 못하므로 `validate-store-price-binding.mjs`를 추가했다. TypeScript 원본을 실행하고 React 서버 렌더링을 사용하되 네트워크와 React 상태는 로컬 대역으로 제어한다. 실제 훅이 요청한 두 SKU를 조회하는지, SKU 하나가 누락되면 가격을 비우고 실패로 처리하는지, CORE/PASS 선택 시 해당 SKU의 가격과 checkout 링크가 맞는지, 새 가격 조회 중 구매를 막는지 확인한다. 테스트 가격은 **6111/9777**로 하여 5900/9900을 복사하는 구현은 통과하지 못한다.

가격을 CORE 가격으로 잘못 연결 / 선택 SKU를 CORE로 고정 / 실제 조회를 제거한 변형 3개를 **메모리에서만** 실행해 모두 AssertionError로 차단됨을 확인했다.

원본 HEAD 대비 `scripts/validate-cart-contract.mjs`의 전체 diff:

```diff
diff --git a/scripts/validate-cart-contract.mjs b/scripts/validate-cart-contract.mjs
index 4822d91..75f95e4 100644
--- a/scripts/validate-cart-contract.mjs
+++ b/scripts/validate-cart-contract.mjs
@@ -1,10 +1,13 @@
 import fs from "node:fs";
+import assert from "node:assert/strict";
+import { validateStorePriceBinding } from "./validate-store-price-binding.mjs";
 
 const read = (path) =>
   fs.readFileSync(new URL(path, import.meta.url), "utf8");
 
 const cart = read("../lib/cart.ts");
 const pricing = read("../lib/live-product-prices.ts");
+const priceHook = read("../lib/use-product-prices.ts");
 const options = read("../components/product-purchase-options.tsx");
 const cartClient = read("../components/cart-client.tsx");
 const checkout = read("../components/checkout-client.tsx");
@@ -50,7 +53,8 @@ if (cart.includes("quantity:") || cartClient.includes("item.quantity")) {
 }
 
 if (
-  !options.includes("fetchLiveProductPrices") ||
+  !options.includes("useProductPrices") ||
+  !priceHook.includes("fetchLiveProductPrices") ||
   !cartClient.includes("fetchLiveProductPrices")
 ) {
   throw new Error("Product options and cart must refresh prices from Supabase.");
@@ -87,4 +91,26 @@ for (const required of [
   }
 }
 
-console.log("PASSMATE cart + dynamic pricing contract OK");
+// Keep the original SQL/idempotency guards and explicitly pin server authority.
+for (const required of [
+  'new Set(["productSlug", "productSlugs", "idempotencyKey"])',
+  'Object.keys(body).some((field) => !allowedRequestFields.has(field))',
+  'admin.rpc("create_direct_checkout",',
+  'p_product_slugs: productSlugs',
+  'items.reduce((sum, item) => sum + item.amountKrw, 0) !== row.amount_krw',
+]) {
+  if (!paymentStart.includes(required)) throw new Error("Server price authority missing: " + required);
+}
+for (const required of ["where p.slug = v_slug", "and p.is_active = true", "for share;", "unit_price_krw"]) {
+  if (!migration.includes(required)) throw new Error("SKU price validation missing: " + required);
+}
+await validateStorePriceBinding();
+// Mutations stay in memory: demonstrate that the new guards reject regressions.
+for (const [from, to] of [
+  ["const selectedPrice = prices[selectedSlug]", "const selectedPrice = prices[coreSlug]"],
+  ["const selectedSlug = getPackageSlug(slug, kind)", 'const selectedSlug = getPackageSlug(slug, "core")'],
+  ["const next = await fetchLiveProductPrices(requested)", "const next = {}"],
+]) {
+  await assert.rejects(validateStorePriceBinding((_, source) => source.replace(from, to)), { name: "AssertionError" });
+}
+console.log("PASSMATE cart + dynamic pricing contract OK (live hook, CORE/PASS SKU binding, refresh disabled, server authority)");
```

[별도 diff 파일](STORE_CART_CONTRACT.diff). 새 동작 검사의 전체 원본은 `scripts/validate-store-price-binding.mjs`에 있다.

서버 금액 경로(저장소 코드 기준):

1. `components/checkout-client.tsx:206`에서 payment-start에 `productSlugs`와 `idempotencyKey`만 보낸다. 화면 가격/상품명을 보내지 않는다.
2. `supabase/functions/payment-start/index.ts:9,129,151`: 허용 필드 외 입력(클라이언트 금액 포함) 거절 → `create_direct_checkout`에 SKU 목록 전달.
3. `supabase/migrations/20260919063638_cart_checkout.sql:312`: `products.slug = v_slug AND is_active`, `FOR SHARE`, KRW 확인. `:361,364`에서 주문 단가를 DB `price_krw`로 저장하고 합산한다.
4. payment-start `:184,216`: 항목 금액 합계와 서버 총액 일치 확인 후 `row.amount_krw` 반환. checkout `:289`는 이 값을 PortOne `totalAmount`로 사용한다.
5. `supabase/functions/payment-sync/index.ts:147`: PortOne에서 읽은 결제 금액이 서버 payment_attempt 금액과 다르면 `payment_amount_mismatch`로 거절한다.

이 검사는 로컬 코드/계약 검증이다. 운영 함수·DB에 실제 적용된 버전 및 실결제 흐름을 호출해서 확인하지는 않았다. 결제 코드/SQL은 수정하지 않았다.

### 4. 가격 캐싱 — 확인만, 개선 미적용

- 서버 `getServerProductPrices`: `cache: "no-store"`, 요청 타임아웃 5000ms. 재검증 TTL이나 `next.revalidate` 설정이 없다. 매 새 HTTP 렌더 요청에서 DB 활성 SKU 가격을 조회한다.
- 홈/목록도 이 함수를 사용한다. 상세는 `dynamic = "force-dynamic"`. 최종 `.next/prerender-manifest.json`에 홈/상품 가격 페이지가 없음을 확인했다(Next build의 상세 ● 표시만으로 정적 캐시라고 판단하지 않음).
- 로컬 production HTTP 응답 3개 모두 `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`.
- 초기 HTML 실측: 홈 CORE 5900 / PASS 9900, 목록 CORE 5900, 상세 CORE 5900 / PASS 9900.
- 브라우저 훅은 mount, window focus, 실패 시 사용자의 retry에서 조회한다. **주기적 폴링 없음**. 탭을 계속 보고 있으면 자동 갱신 주기는 정해져 있지 않다. Next 클라이언트 탐색/뒤로 가기로 기존 화면 상태가 재사용될 때에도 새 HTTP HTML을 받는 것과는 다를 수 있다.

DB 가격이 서버 조회와 브라우저 조회 사이에 바뀌면 이전 금액이 잠깐 보일 수 있다. 갱신 중 기존 금액을 유지하며 구매 버튼은 disabled, 문구는 “구매하기”로 유지한다. 새 응답을 받은 뒤 가격을 바꾸고 버튼을 활성화한다. SSR 조회가 실패해 가격이 없을 때에만 skeleton을 표시한다. 브라우저 조회 실패 시 기존 금액을 제거하고 “가격을 불러오지 못했어요 · 다시 시도”를 표시한다.

로컬 API fixture로 SSR 5900 → 브라우저 6111 경합을 재현했다. 이전 가격 유지+disabled → 새 가격+활성 링크, 구매 바 117px 유지. **DB에 6111원을 쓰지 않았다.** [갱신 중](../../tmp/store-mobile-followup/cache-old-price-refreshing-360.png) / [갱신 완료](../../tmp/store-mobile-followup/cache-new-price-ready-360.png), [측정](../../tmp/store-mobile-followup/cache-verification.json).

제안만 남김: 가격 변경 알림/버전이 필요하면 SSR 가격 버전과 조회 버전을 비교해 변경 안내 후 새 금액을 확인하도록 할 수 있다. 열린 탭의 오래된 표시를 줄이려면 visibility 복귀 조회 또는 짧은 polling/SWR 간격을 정하되 읽기 비용과 표시 안정성을 함께 검토해야 한다. 초기 가격과 hydration 사이의 순간 차이를 줄이려면 SSR 가격을 일정 freshness 기간 동안 사용하도록 합의할 수 있으나, 변경 반영이 그만큼 늦어진다. **이번에는 어느 정책도 적용하지 않았다.** 현재 서버의 주문 금액 권한은 유지한다.

### 5. WebKit / iOS 코드 점검 / 실기기 접속

- Playwright 1.62.1의 WebKit 26.5와 Edge 각각 **29개**: 360/390/430/640/767px × 4 경로 20개 + 인증 내 자료 ready/empty 6개 + 가격 skeleton→실패→재시도 3개.
- 요청한 360/390/430px 네 경로 전후 24장, 인증 내 자료 전후 12장. 같은 엔진/폭끼리 비교했다.
- 모든 모바일 측정에서 가로 넘침, 44×44 미만 링크/버튼, 최소 글자 크기 위반 0. 보조 텍스트 대비 최소 **7.23:1**.
- 헤더 top=0, 높이 56px(안전영역 inset이 0인 자동화 환경). 구매 바 bottom=innerHeight. 화면 높이 900→700→900px에서도 확인.
- 가격 skeleton, 실패, 재시도 성공 모두 구매 바 높이 **117px**. [skeleton](../../tmp/store-mobile-followup/webkit-after/price-skeleton-360.png) / [실패](../../tmp/store-mobile-followup/webkit-after/price-failure-360.png) / [성공](../../tmp/store-mobile-followup/webkit-after/price-success-360.png).
- Chromium의 가격 상태 전환 CLS=0. 일반 모바일 캡처도 CLS=0. **WebKit은 layout-shift PerformanceObserver API 미지원**이므로 숫자 CLS를 성공이라고 표시하지 않고 null로 기록했다. 높이/좌표 안정성과 캡처는 별도 확인했다. 초기 캡처 도구가 WebKit 미지원 상태를 0으로 기록하던 부분은 지원 탐지를 추가하고 전후 metrics를 null로 정정했다.
- [WebKit 결과](../../tmp/store-mobile-followup/webkit-after/verification.json), [Edge 결과](../../tmp/store-mobile-followup/edge-after/verification.json), [픽셀 비교](../../tmp/store-mobile-followup/mobile-diff.json).

iOS CSS 점검: `viewportFit: "cover"`, 헤더의 top safe-area, 좌우 컨테이너 safe-area, 구매 바의 좌우/bottom safe-area, 상세/푸터의 구매 바+safe-area 하단 여백이 적용되어 있다. 라이브러리 최소 높이는 `100svh`를 사용해 주소창 변화가 컨텐츠를 흔들지 않도록 했다. 스토어에 전체 높이를 강제로 100vh로 고정한 구조는 없다. 구매 바는 vh 계산 대신 fixed bottom=0으로 맞춘다. 모바일 PageTransition의 transform 애니메이션은 꺼져 있어 fixed 바의 기준 부모가 바뀌지 않는다. 관리자/CBT의 별도 100vh 규칙은 이번 스토어 최적화 범위에서 수정하지 않았다.

Windows WebKit은 iOS 기기/주소창/홈 인디케이터를 재현하지 않는다. 자동화의 safe-area 값은 0이다. 노치 inset, 실기기 주소창 접힘, 홈 인디케이터, 회전, 스크롤 시 바 위치는 아래 주소로 사용자 실기기 확인이 남아 있다.

현재 PC는 **이더넷 192.168.0.6**, 공유기 192.168.0.1에 연결되어 있다. Wi-Fi 어댑터는 유효한 LAN 주소가 없고 Tailscale 100.117.139.29는 이 용도의 주소가 아니다. 폰을 **PC와 같은 공유기의 Wi-Fi**에 연결하고 **http://192.168.0.6:3017/** 를 연다. PC가 유선이어도 같은 공유기면 가능하다.

로컬 서버는 현재 `0.0.0.0:3017`로 실행 중이다. 재실행할 때 앱 폴더에서:

```powershell
npx next build
npm run start -- --port 3017 --hostname 0.0.0.0
```

폰에서 `/`, `/products/`, `/products/computer-literacy-2/`, `/library/`를 확인한다. LAN IP가 바뀌면 `ipconfig`의 이더넷/Wi-Fi IPv4를 사용한다. 접속이 안 되면 게스트 Wi-Fi의 기기 격리 여부와 Windows의 **개인 네트워크** Node 허용을 확인한다. 방화벽 설정은 이번 작업에서 변경하지 않았다. HTTP LAN에서 OAuth 로그인/실결제는 검증하지 않았다.

### 6. 색 참조 변경과 라이트 테마 보존

[전체 리터럴/원래 줄/토큰 대응표](STORE_COLOR_INVENTORY.md). `app/globals.css` 402개, 기존 `tokens.css` 7개, `app/ui-refinements.css` 11개, `components/logo.tsx` 2개: 총 422개, 고유 값 183개. 브랜드/텍스트/배경/테두리/상태/투명도/그림자는 tokens.css에서 정의한다. 기존 blue/ink/muted/success/error 등의 의미 토큰을 유지하고, 서로 다른 기존 색은 억지로 합치지 않고 별도 팔레트 참조로 보존했다.

표지의 네이비/민트/연두 및 로고 그림의 고정 팔레트는 **색 값을 그대로 유지**했다. 출판 표지와 브랜드 도형의 고유 색이라 임의로 변경하지 않았다. 참조만 cover-* / logo-ink / 해당 팔레트 변수로 바꿨다. public/의 래스터 로고/이미지 픽셀은 수정하지 않았다. 새 다크 테마는 구현하지 않았다.

치환된 변수를 실제 값으로 되돌려 비교하면 globals.css(색 정의의 tokens 이동 제외), ui-refinements.css, logo.tsx가 기존 원본과 완전히 같음을 확인했다. 라이트 화면 실측:

- 데스크톱 768/1024/1280px × 홈/목록/상세/로그인 12쌍: **픽셀 차이 0**.
- WebKit 모바일: 홈만 의도한 카피 차이. 목록/상세/로그인 및 내 자료 ready/empty 15쌍: **픽셀 차이 0**.
- [데스크톱 diff](../../tmp/store-mobile-followup/desktop-diff.json). 전체 app/components 텍스트 소스 재검색에서 tokens.css 밖 색 리터럴 0.

### 최종 검사 / 변경 파일 / 남은 확인

`npm run check`, `npx tsc --noEmit`, `npx next build` 모두 최종 소스에서 종료 코드 0. 가격 변경 fixture/폰트 차단/브라우저 회귀는 별도 도구로 검증했다. 운영 배포/DB migration/결제 요청은 실행하지 않았다.

추가 작업에서 변경한 저장소 파일:

- `app/layout.tsx`, `app/store-mobile.css`: 폰트 가드와 모바일 카피 표시.
- `lib/store-font-guard.ts`: 타임아웃/폴백.
- `components/home-products.tsx`: 모바일 제목/대표 상품 CTA.
- `app/globals.css`, `app/ui-refinements.css`, `app/tokens.css`, `components/logo.tsx`: 값 보존 토큰 참조.
- `scripts/validate-cart-contract.mjs`, `scripts/validate-store-price-binding.mjs`: 원래 계약 보존 및 동작/회귀 검사.
- `docs/STORE_MOBILE_QA.md`, `docs/STORE_COLOR_INVENTORY.md`, `docs/STORE_CART_CONTRACT.diff`, `docs/DESIGN_SYSTEM.md`: 결과/명세/전체 조사와 diff.

누적 모바일 작업은 앞 절의 17개 + globals/ui-refinements/logo/font-guard/새 검사/색 조사/계약 diff 7개 = **24개 저장소 파일**. 워크스페이스 tmp 도구/캡처는 별도이며 supabase/.temp/는 기존 상태를 보존했다.

브레이크포인트: 모바일 폰트/카피/레이아웃 **max-width:767px**, 설명 한 줄 **max-width:640px**, 좁은 카드 CTA **max-width:375px**. ≥768px에는 기존 디자인을 유지한다. 색 토큰 참조 교체는 전역이지만 기존 계산값과 픽셀을 보존한다.

남은 확인: 실기기 iOS Safari의 주소창/노치/홈 인디케이터/회전, 실계정 내 자료와 파일 다운로드, 실제 배포 버전의 서버 SKU 계약/결제. 가격 캐시 개선은 제안만 남았으며 열린 탭의 가격 갱신은 현재 mount/focus/retry 시점에만 일어난다. 이 브랜치는 아직 운영 배포 전이며, 별도 CBT 수정 기반 브랜치에서 시작했으므로 향후 PR/배포에서 변경 범위를 분리해 검토해야 한다.

## 2026-10-04 사이트 전체 오류 추가 검토

[SITE_ERROR_AUDIT.md](./SITE_ERROR_AUDIT.md)에 범위, 변경 파일, 서버 권한·금액 코드 경로, 남은 실계정/결제 검증을 기록했다. [캡처 비교](../../tmp/site-audit/index.html)는 6개 수정 전후 쌍과 Edge/WebKit 기능 캡처 22개를 포함하며, 이미지 34개가 모두 로드되는 것을 확인했다.

SNS 저장소 접근 차단 2건, 잘못된 학습 기록으로 북마크/계정 화면 충돌 2건, 장바구니·학습 저장 용량 부족, 잘못된 관리자 문항 JSON 처리를 수정했다. 정상 기록과 중복 문항은 보존하고 오류 파일의 운영 저장은 차단한다. 장바구니 삭제 저장 실패 시 기존 항목을 유지하며, 시험 시작 기록을 저장하지 못하면 시험 화면으로 이동하지 않는다.

Edge/WebKit의 25개 경로 × 390/1280px 검사 100건과 각 엔진 11개 기능 시나리오가 통과했다. 네트워크/권한 실패와 결제 금액 불일치는 로컬 응답으로 재현했다. 최종 `npm run check`, `npx tsc --noEmit`, `npx next build`는 모두 exit 0. CSS·브레이크포인트 변경은 없으며, 운영 배포·운영 DB 쓰기·실제 결제·자료 발급은 수행하지 않았다.

## 2026-10-04 스토어 문구·위계 정리

### 구현 전 목록과 적용 범위

[STORE_COPY_INVENTORY.md](./STORE_COPY_INVENTORY.md)에 공통 영역, 모든 대상 페이지, 조건부 빈 화면·오류·진행 상태, 접근성 이름과 표지 인쇄 문구를 표로 정리하고 **구현 전에 사용자에게 제시했다**. 판단 기준은 “지우면 사용자가 잃는 정보가 있는가?”였다. 가격·구성품·버전·계정 식별·오류 해결 안내·행동 버튼은 유지하고, 반복 아이브로·설명·상태 칩을 정리했다.

문구는 데스크톱·모바일 공통이다. 사용자가 추가 답변에서 **데스크톱에도 두께 변경 허용**을 명시하여 제목 700 / 카드·섹션 제목 600 / 본문·보조 400을 공통 적용했다. 다른 레이아웃 변경은 새 `app/store-copy.css`의 **max-width:767px**에 한정한다. ≥768px에 레이아웃 선언을 추가하지 않았다. 앞 절의 모바일 최적화와 사이트 오류 수정은 이번 변경 전 기준에 포함된다.

### 항목별 전후

| 페이지/항목 | 변경 전 | 변경 후 |
|---|---|---|
| 홈 | 브랜드·연도 아이브로, 대표/비교/학습 라벨, 긴 설명 반복 | 제목·한 줄 설명·상품·가격·CTA 중심; “시험에 필요한 핵심만, 더 빠르게.”는 홈 히어로에 표시 |
| 목록 | PASSMATE LIBRARY, 상품 대표 라벨 | 제목과 발행 예정 안내만 유지; 상품 제목·가격·구성 보존 |
| 상세 | 부제·체크리스트·비교표/모바일 카드·하단 3단계가 같은 구성 반복 | 분류 “핵심노트”, 고유 설명, 패키지 구성 비교와 구매 동작 유지; 중복 세트 제거 |
| 장바구니 | PASSMATE CART, 긴 서버 금액 설명 | 제목 및 “결제 전 최신 가격을 확인합니다.”; 실제 구성 정보 유지 |
| 결제 | CHECKOUT, 4단계, 주문명/코드/합계 설명 중복 | 상품별 제목·버전·가격, 합계, 상태 안내, 결제 동의, 계정과 행동 버튼 유지 |
| 결제 결과 | 결과 아이브로, 상태 칩, 서버 구현 설명 | 실제 결과 제목·필요한 후속 안내·자료 이동 버튼; 상태 칩은 sr-only |
| 내 자료 | MY PASSMATE, 긴 설명, 2027 PASSMATE, 구매/상태 칩, 분리된 날짜·버전 | 제목 / “2026.10.04 구매 · v1.0.0” / 버튼으로 정리 |
| 내 자료 준비 | “자료 준비 중” 상태와 버튼이 반복 | 비활성 “준비 중”, aria-label="자료 준비 중" 및 허용된 한 줄 안내 |
| 내 자료 다운로드 | PDF 다운로드 | 문구 유지, aria-label="PDF 다운로드" 추가; 요청·준비 판정·disabled 조건 유지 |
| 로그인/가입 | 영문 아이브로와 목적 설명 | 제목·SNS/이메일 선택·필드·오류·행동 버튼 유지 |
| 모바일 헤더 | 상단과 서비스 전환 구분선 중복, 큰 전환 영역 | 구분선 아래 한 줄, 전환 영역 40px, 알약 33px + ::before 44px 터치; 활성 white/ink |
| 모바일 푸터 | 두 슬로건과 큰 세로 간격 | 로고 + “합격까지 함께하는 요약노트.” + 저작권 |

결제 화면의 360px 캡처에서 발견한 상품별 금액 줄바꿈은 모바일 `.checkout-item-row b`의 `flex:none; white-space:nowrap`으로 수정했다. 브랜드 팔레트와 폰트는 유지하며 새 스타일은 기존 CSS 변수만 참조한다.

### 캡처 비교 / 삭제 문구 개수

[전후 비교 화면](../../tmp/store-copy/index.html) 또는 로컬 브라우저 [비교 화면 열기](http://127.0.0.1:3022/store-copy/index.html). 페이지·폭·엔진을 선택하면 원본 PNG를 나란히 볼 수 있다. 홈/목록/상세/장바구니/결제/내 자료/로그인/가입 및 결제 결과 9개 페이지:

- Edge Chromium: 360/390/430/768/1280px **45쌍**.
- Playwright WebKit: 360/390/430px **27쌍**.
- 전체 **72쌍 / 144장**, 모바일 **54쌍**. 계정·구매 정보는 fixture이며 결제 화면은 서버 응답을 모의한 동의 전 상태다. 결제 결과 기본 비교는 조회 실패 상태다.

| 페이지 | 모바일 삭제 | 데스크톱 삭제 |
|---|---:|---:|
| 홈 | 6 | 7 |
| 상품 목록 | 3 | 3 |
| 상품 상세 | 9 | 9 |
| 장바구니 | 2 | 2 |
| 결제 | 9 | 9 |
| 내 자료 | 9 | 9 |
| 로그인 | 3 | 3 |
| 회원가입 | 3 | 3 |
| 결제 결과 | 4 | 4 |

삭제 개수는 **의미 있는 표시 블록** 단위다. 반복 카드의 같은 문구는 각각 계산하며, 숫자+이름으로 구성된 단계 한 줄은 한 건이다. 축약·메타 병합은 제외한다. 각 페이지에 공통 푸터의 슬로건 삭제 1건을 포함했다. 내 자료는 다운로드 가능/준비 중 2카드 fixture 기준이다. 비표시 조건부 빈 화면·비회원 안내의 삭제는 위 기본 화면 개수에 포함하지 않는다. 홈 데스크톱에는 핵심노트 비교 카드의 추가 라벨 한 개가 있어 개수가 다르다.

### 재검사

[수치·검사 결과](../../tmp/store-copy/summary.json), [Edge 원본 측정](../../tmp/store-copy/after-edge.json), [WebKit 원본 측정](../../tmp/store-copy/after-webkit.json).

- 모바일 54건 모두 `document.documentElement.scrollWidth <= innerWidth`, 오류 0.
- 모든 표시 링크·버튼·입력·동의 라벨의 유효 터치 영역 ≥44×44px. 서비스 탭 ::before 확장 영역에서 `elementFromPoint`가 해당 링크를 반환하는 것을 양 엔진에서 확인했다. 체크박스는 18px 그림 대신 전체 44px 이상 동의 라벨이 터치 영역이다.
- 보조 텍스트 최소 대비 **7.56:1**, 일반 UI 텍스트 최소 **5.74:1**. 대비 4.5 미만 없음. 이 검사는 실제 계산 색과 조상 배경을 합성한 수치 검사다. 표지 인쇄 팔레트와 `aria-hidden` Google 브랜드 글자 장식은 UI 보조 텍스트 검사에서 제외했다.
- 전체 텍스트 최소 12px, 보조 텍스트 최소 13px. 본문·입력은 모바일 15px 이상이며, 메타/라벨/버튼은 보조·컨트롤 기준을 적용했다. 페이지 제목 700, 카드/섹션 제목 600을 모바일·데스크톱에서 확인했다.
- 스크롤 후 헤더 top=0. 전환 영역 실측 40px. safe-area 토큰을 사용하는 기존 헤더·푸터·구매 바 규칙 유지.
- 결제 동의는 체크 전 비활성 → 동의 라벨 클릭 후 활성 → 체크 해제 후 비활성으로 검증했다. 결제 버튼은 클릭하지 않았다.
- 내 자료 날짜/버전, 가능·준비 버튼의 disabled/aria-label 확인. 다운로드 함수·준비 판정은 수정하지 않았다.
- 데스크톱 18건에서 살아남은 동일 텍스트의 폰트 크기/색 및 공통 컨테이너의 배경·테두리·패딩·display·gap이 기준과 같음을 확인했다. 삭제/축약된 텍스트와 이에 따라 달라지는 줄바꿈·내용 높이, 허용한 font-weight는 비교 예외다. **픽셀 차이 0을 주장하지 않는다.**
- `store-copy-contract.cjs after`의 TypeScript AST 비교: 인증/장바구니/결제/자료 컴포넌트의 처리 함수·effects, 관련 contract 라이브러리 해시가 작업 전과 일치했다. 결제 동의·download disabled 등의 기존 바인딩을 보존했다. 필수 검사를 약화하거나 삭제하지 않았다.
- 최종 `npm run check`, `npx tsc --noEmit`, `npx next build` 종료 코드 0. [check 로그](../../tmp/store-copy/check.log), [타입 로그](../../tmp/store-copy/tsc.log), [빌드 로그](../../tmp/store-copy/build.log).

### 법적 표기와 남은 확인

**유지:** “위 상품과 {금액} 결제에 동의합니다.” 체크박스 문구와 확인 동작. 별도의 법적 충분성 판단은 하지 않았다.

**빠져 있음:** 사업자 정보, 사업자등록번호, 통신판매업 신고번호, 환불 정책 링크, 별도 이용/결제 약관 링크. 현재 화면에 없으며 번호·정책·약관을 새로 만들지 않았다. 사용자가 필요 여부를 판단해야 한다.

내 자료 계약은 패키지별 entitlement와 단일 PDF 발급/다운로드이며 **파일명 목록 필드가 없다**. 따라서 복수 파일의 실제 이름을 제목 아래에 표시하는 요구는 현재 데이터에서 검증할 수 없다. 임의 파일명이나 상품 구성명을 실제 다운로드 파일명처럼 표시하지 않았다. 향후 실제 파일 목록이 제공되면 UI에 추가할 수 있다. 계약 변경은 이번 범위 밖이다.

Playwright WebKit은 실기기 iOS Safari 검증을 대체하지 않는다. 실계정 인증·실결제·실파일 다운로드·복수 파일 표시는 수행하지 않았다. 브라우저 Supabase/결제 요청은 fixture로 가로채고, POST는 차단하거나 로컬 응답으로 대체했다. 운영 배포·운영 DB 쓰기·실제 결제·권한/다운로드 로직 변경은 없었다. 기존 폰트 가드·가격 skeleton·SSR/캐시 정책도 변경하지 않았다.

데스크톱(768/1280px) 장바구니의 기존 “결제하기” 버튼 텍스트 대비는 **1.37:1**로 낮다. 이번 모바일 스타일에서는 흰색 토큰 참조로 개선했지만, 데스크톱 색 변경은 문구·두께 외 디자인 유지 조건에 포함되지 않으므로 기존 값을 보존했다. [summary.json](../../tmp/store-copy/summary.json)의 `desktopContrastRisks`에 기록했다. 앞의 대비 통과 수치는 모바일 검사 범위다.

2026-10-05 재개 후 최종 캡처 72건과 처리 함수/계약 보존 검사를 다시 확인했다. 비교 보고서 서버는 로컬 미리보기용으로 다시 시작했으며 운영 배포는 없다.

### 이번 변경 파일

- `app/store-copy.css`(신규), `app/layout.tsx`: 공통 두께 및 ≤767px 전용 레이아웃.
- `app/page.tsx`, `app/products/page.tsx`, `app/products/[slug]/page.tsx`, `app/cart/page.tsx`, `app/library/page.tsx`: 중복 문구 삭제·축약.
- `components/home-products.tsx`, `components/product-card.tsx`, `components/product-purchase-options.tsx`: 상품 문구 정리.
- `components/library-client.tsx`, `components/download-button.tsx`: 날짜·버전 표시와 시각 상태/접근성 문구.
- `components/cart-client.tsx`, `components/checkout-client.tsx`, `components/checkout-complete-client.tsx`, `components/auth-form.tsx`: 표시 JSX 정리.
- `components/site-header.tsx`, `components/site-footer.tsx`: 모바일 적용 범위 및 푸터 문구.
- `docs/STORE_COPY_INVENTORY.md`(신규), `docs/STORE_MOBILE_QA.md`, `docs/DESIGN_SYSTEM.md`: 목록·검증·명세.

검증 도구와 PNG/HTML/JSON/로그는 워크스페이스 `tmp/store-copy*`에 별도 보관했다. 저장소의 다른 기존 변경과 `supabase/.temp/`는 보존했다.

## 푸터 배치 재조정 — 2026-10-05

사용자 피드백에 따라 어두운 푸터를 흰 배경으로 되돌리고 브랜드/슬로건 → 가로 구분선 → 사업자 정보 → 저작권 순서로 재배치했다. PC 메뉴는 오른쪽, 767px 이하에서는 2열이다. 모바일 줄바꿈 앞에 불필요한 구분점이 생기지 않도록 처리했다. 기존 상호·등록번호·대표·주소·신고번호·공개 이메일을 보존했으며, 인증·결제·다운로드·DB·메일 전달 설정은 변경하지 않았다. 미확정 정책 본문/링크는 만들지 않았다.

- 변경 파일: `components/site-footer.tsx`, `components/business-information.tsx`, `app/legal.css`, `app/tokens.css`, `docs/DESIGN_SYSTEM.md`, `docs/STATUS.md`, 이 문서.
- 로컬 Chromium 홈/스토어/CBT 360·390·430·1280px 12건, WebKit 모바일 9건: 가로 넘침·검사 대상 터치 영역/최소 폰트 위반·페이지 오류 0건. 보조 텍스트 최소 대비 6.70:1. 별도로 푸터 모든 링크 44×44px 이상, 텍스트 14px 이상을 확인했다.
- Chromium 전체 페이지 CLS 최대 0.052, 홈 최대 0.00304. WebKit은 Layout Shift 관측 API를 지원하지 않아 CLS를 측정하지 못했다.
- `npm run check`, `npx tsc --noEmit`, `npx next build` 통과. 법적 검사의 경고 6개는 기존 미확정 정책 4개·비공개 전화·미확정 운영시간이다.
- 전/후 PNG 및 JSON: 워크스페이스 `reports/learning-home-release-20261005/`의 `footer-contact-*`(전), `footer-light-*`(후). 운영 배포/최종 캡처 결과는 해당 폴더의 `FOOTER_LAYOUT_REVISION.md`에 기록한다.
- 이번 푸터 수정 커밋만 revert하면 이전 어두운 푸터로 돌아간다. 학습 홈·스토어·사업자 정보 값·메일 전달 설정에는 영향을 주지 않는다.

## 사용자 첨부 HTML 푸터 적용 — 2026-10-05 (최신)

`PASSMATE Home.dc.html`의 푸터 배치를 적용했다. 짙은 배경의 상단 저작권/실제 메뉴 링크 → 구분선 → 항목별 사업자 정보 격자다. 로고·슬로건·하단 별도 저작권은 첨부안에 맞춰 제거했다. 통신판매업 신고번호는 `lib/business-info.ts`에서 사용자 정정값 **2026-서울노원-1344**로 변경했다. 그 외 사업자 정보·메일 전달·결제·인증·다운로드·시험 계약은 보존했다.

- 최대 폭 1120px, PC 좌우 24px / ≤767px 좌우 16px. 최소 240px 열의 자동 격자로 360/390/430px에서는 1열, 1280px에서는 4열이다. 모바일 메뉴는 2열이다.
- 첨부안의 13px 대신 기존 최소 14px 기준을 유지했다. 푸터 전용 색상 토큰 사용, 터치 44px·safe-area·시험 푸터 숨김을 유지했다. 미확정 정책과 빈 전화/운영시간은 렌더링하지 않았다.
- `npm run check`, `npx tsc --noEmit`, `npx next build` 통과. 기존 법적 미확정 항목 6개는 경고로 남았다.
- 로컬 홈/스토어/CBT Chromium 12건(360/390/430/1280px), WebKit 9건(모바일): 가로 넘침·검사 대상 터치/폰트 위반·페이지 오류 0건.
- 푸터 `dt/dd`를 포함한 전체 텍스트와 모든 링크를 양 엔진 360/390/430/1280px에서 별도로 측정: 최소 글자 14px, 최소 대비 **6.99:1**, 터치 위반 0건, `#` 링크 0건, 정정 신고번호 표시 확인.
- Chromium 로컬 전체 페이지 CLS 최대 0.052. WebKit은 관측 API 미지원으로 측정 불가. 운영 결과와 전/후 캡처는 워크스페이스 `reports/learning-home-release-20261005/FOOTER_HTML_UPDATE.md`에 기록한다. `footer-html-local-*` PNG/JSON에 이번 로컬 결과를 보관했다.
- 변경 파일: 푸터/사업자 정보 컴포넌트, `app/legal.css`, `app/tokens.css`, `lib/business-info.ts`, 디자인/상태/이 QA 문서. 이 수정 커밋만 revert하면 직전 밝은 푸터와 이전 신고번호 값으로 돌아간다.
