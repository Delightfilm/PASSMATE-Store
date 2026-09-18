# PASSMATE V3 Payment Contract

## Goal

V3는 특정 PG에 종속되지 않는 결제 경계를 먼저 고정한다.

실제 PG는 이후 Toss Payments / PortOne 등 후보를 비교해 선택하고 adapter만 추가한다.

## Core rule

브라우저는 절대 주문을 `paid`로 만들 수 없다.

```text
Browser
  → checkout API / Edge Function
  → PG
  → server-side verification
  → service_role RPC
  → payment_attempts / payment_events
  → orders.status = paid
  → entitlement
  → issuance queue
```

## Tables

### payment_attempts

한 번의 실제 결제 시도를 나타낸다.

중복 방지:

- `provider + idempotency_key` unique
- `provider + merchant_order_id` unique
- `provider + provider_payment_id` unique when present

### payment_events

PG의 성공/실패/취소/환불 이벤트를 정규화해 기록한다.

중복 webhook 방지:

- `provider + provider_event_id` unique

raw webhook body는 DB에 저장하지 않는다.
검증에 사용한 body의 SHA-256 fingerprint만 저장한다.

## Start payment

`start_payment_attempt()`

서버가 검증하는 항목:

- order status가 pending 또는 failed
- direct order는 user_id 필수
- order item 존재
- 모든 order item이 published product version을 pin
- item 합계와 order total 일치
- provider/idempotency/merchant order id 형식

성공하면 order:

```text
pending|failed → payment_pending
```

## Apply provider event

`apply_payment_event()`

service-role only.

### paid

검증:

- attempt = pending
- order = payment_pending
- provider 일치
- provider payment id 존재
- verified amount = attempt amount = order amount

성공 transaction:

```text
attempt → paid
order → paid
entitlement grant/re-activate
enqueue_order_issuance()
```

### failed

```text
attempt → failed
order → failed
```

재시도는 새 payment attempt를 만든다.

### cancelled

결제 완료 전 취소만 허용한다.

```text
attempt → cancelled
order → cancelled
```

### refunded

V3에서는 전액 환불만 지원한다.

```text
attempt paid → refunded
order paid → refunded + revoked
```

기존 refund trigger가 entitlement/issuance revoke를 이어서 처리한다.

## Provider adapter

`lib/payment-provider.ts`의 `PaymentProviderAdapter`가 provider-specific 코드를 감싼다.

필수 구현:

- prepare()
- verifyAndNormalizeWebhook()
- refund()

provider-specific secret / webhook signing key는 server/Edge Function secret로만 관리한다.

## Exit Gate

- 실제 PG 1개 선정
- sandbox 결제 성공 → paid
- 금액 불일치 차단
- 동일 idempotency key 중복 생성 차단
- 동일 webhook event 중복 처리 차단
- 결제 실패/취소 정상 기록
- 전액 환불 → refunded/revoked
- 결제 성공 → entitlement + issuance queue
