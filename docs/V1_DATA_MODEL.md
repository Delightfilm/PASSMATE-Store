# PASSMATE V1 Data Model

## Purpose

V1은 결제나 PDF 발행을 구현하는 단계가 아니라, 이후 기능이 흔들리지 않도록 회원·상품·주문·구매권한의 기준 데이터를 먼저 고정하는 단계다.

## Core entities

```text
auth.users
   │ 1:1
   ▼
profiles

products ──< product_versions

auth.users ──< orders ──< order_items >── products
    │
    └────────< entitlements >──────────── products
```

### profiles
Supabase Auth 사용자에 대응하는 앱 프로필.

- `id`: auth.users.id
- `display_name`: 고객 표시 이름
- `role`: customer/admin
- 고객은 자신의 display_name만 변경 가능
- role 변경은 서버/service-role에서만 수행

### products
스토어에서 판매하는 상품의 비즈니스 정보.

- `code`: 내부 상품코드. 예: PM-C2
- `slug`: URL 식별자
- `price_krw`: 원화 판매가
- `is_active`: 공개 상품 여부

### product_versions
동일 상품의 콘텐츠 버전.

예:
- PM-C2 / 2027-v1.0
- PM-C2 / 2027-v1.1

MASTER PDF와 실제 발행 파일 정보는 후속 버전에서 별도 발행 도메인으로 분리한다.

### orders
결제 전후의 주문 헤더.

V3 결제 연동 전까지는 서버에서만 생성하도록 유지한다.

### order_items
주문 시점의 상품/가격 스냅샷.

가격이 나중에 바뀌어도 기존 주문의 `unit_price_krw`는 유지한다.

### entitlements
사용자가 실제로 접근할 수 있는 구매권한.

주문과 다운로드를 직접 결합하지 않고 entitlement를 중간에 두어 환불, 재발행, 상품 버전 변경에 대응한다.

## RLS principle

- 익명 사용자: 활성 상품과 공개 버전만 조회
- 로그인 사용자: 자신의 profile/order/order_items/entitlements만 조회
- 일반 고객: 상품/주문/권한 직접 수정 불가
- 관리자 동작: 후속 Admin 서버 또는 service-role을 통해 수행

## Initial catalog

| Code | Slug | Edition | Price | Product | Version status |
|---|---|---:|---:|---|---|
| PM-C2 | computer-literacy-2 | 2027 | 6,900 KRW | Active | Draft |

상품은 스토어에서 소개할 수 있지만 실제 콘텐츠 버전은 출시 Gate를 통과할 때까지 `draft`로 유지한다.
