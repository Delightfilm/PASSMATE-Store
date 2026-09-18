# PASSMATE PortOne V2 + NHN KCP Integration

## Current decision

초기 고정비 최소화를 위해 V3의 1차 결제 경로는:

```text
PASSMATE → PortOne V2 → NHN KCP
```

이다.

## Public identifiers

브라우저 결제창을 열 때 필요한 값:

- `PORTONE_STORE_ID`
- `PORTONE_KCP_CHANNEL_KEY`

두 값은 결제 요청에 사용되는 식별자다. GitHub에 하드코딩하지 않고 환경변수로 관리한다.

## Server secret

- `PORTONE_API_SECRET`

PortOne V2 REST API 조회/환불 등에 사용한다.
절대 브라우저에 노출하지 않는다.

## payment-start Edge Function

인증된 Supabase JWT만 허용한다.

순서:

```text
JWT verify
→ provider config check
→ product slug
→ create_direct_checkout()
→ DB price/version validation
→ order + order_item + payment_attempt
→ browser payment payload
```

PortOne Store ID 또는 KCP Channel Key가 없으면 주문을 만들기 전에 503으로 중단한다.

## payment-webhook Edge Function

PortOne webhook은 Supabase JWT를 보내지 않으므로 gateway JWT 검증을 사용하지 않는다.

대신 webhook payload의 결제 상태를 그대로 신뢰하지 않는다.

```text
webhook receive
→ paymentId extract
→ PortOne V2 API GET /payments/{paymentId}
→ authoritative status/amount
→ apply_payment_event()
```

`PORTONE_API_SECRET`이 없으면 fail-closed 503이다.

PortOne webhook signature 검증은 credential 준비 후 추가 방어층으로 붙일 수 있다. 현재 설계는 PortOne 공식 문서가 허용하는 payment re-fetch 검증 전략을 사용한다.

## Launch blocker

실결제 연결 전에 필요한 사용자 측 값:

1. PortOne Store ID
2. NHN KCP Channel Key
3. PortOne V2 API Secret
4. PortOne webhook URL 등록

PM-C2의 `2027-v1.0` product version은 현재 draft 상태이므로 실제 checkout RPC는 의도적으로 결제를 시작하지 않는다. 출시 Gate가 통과된 뒤 published로 전환한다.
