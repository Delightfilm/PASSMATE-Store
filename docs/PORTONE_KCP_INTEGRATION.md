# PASSMATE PortOne V2 + NHN KCP Integration

## Decision

```text
PASSMATE → PortOne V2 → NHN KCP
```

테스트 채널 이름:

```text
PASSMATE KCP TEST
```

2026-09-19 기준 PortOne V2 NHN KCP 테스트 채널 생성까지 완료했다.

## Runtime configuration

Browser/payment identifiers:

- `PORTONE_STORE_ID`
- `PORTONE_KCP_CHANNEL_KEY`

Server-only:

- `PORTONE_API_SECRET`
- `PORTONE_WEBHOOK_SECRET`

Secret은 Chat/GitHub/client bundle에 노출하지 않는다.

## payment-start

JWT-required.

```text
authenticated user
→ server provider config
→ create_direct_checkout()
→ server catalog/version/price
→ order + item + payment attempt
→ paymentId/storeId/channelKey 반환
```

클라이언트가 보낸 가격/상품명을 결제 금액의 Source of Truth로 사용하지 않는다.

## payment-sync

JWT-required purchaser reconciliation.

```text
paymentId ownership
→ PortOne API re-fetch
→ Store ID / KRW / exact amount
→ apply_payment_event()
```

브라우저에서 "결제 성공"이 반환된 것만으로 paid 처리하지 않는다.

## payment-webhook

Supabase JWT 대신 PortOne Standard Webhooks 서명을 검증한다.

```text
raw body + headers
→ webhook HMAC verification
→ Store ID gate
→ PortOne authoritative re-fetch
→ payment identity/currency/amount
→ apply_payment_event()
```

raw webhook body는 저장하지 않고 fingerprint/정규화 event만 기록한다.

## Current verified live state — 2026-09-19

- payment Edge Functions는 ACTIVE
- PortOne/KCP 테스트 채널 생성 완료
- live DB에 pending payment attempt 2건 존재
- payment event 0건
- active entitlement 0건
- issuance job 0건

따라서 **실제 sandbox paid event는 아직 확인되지 않았다.**

Edge Function 버전 숫자는 재배포 시 증가할 수 있으므로 이 문서에서는 특정 버전 숫자를 계약 기준으로 사용하지 않는다. 코드/해시/동작을 기준으로 검증한다.

## Remaining Gate

1. Store ID / Channel Key 서버 설정 확인
2. V2 API Secret 서버 설정 확인
3. Webhook Secret 서버 설정 확인
4. PortOne 테스트 Webhook URL 등록
5. sandbox 카드 결제 성공 → paid
6. 실패/취소/full-refund
7. payment-sync와 signed webhook race 수렴
8. entitlement 1회 grant
9. issuance queue 1회 enqueue

NAS가 아직 연결되지 않았으면 paid 후 issuance job이 queued에서 대기하는 것은 정상이다.

## Public Sale Rule

위 sandbox Gate를 통과하기 전에는 공개 판매를 활성화하지 않는다.
