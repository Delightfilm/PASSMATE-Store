# PASSMATE V7 Admin Console

## Scope

V7의 1차 목표는 SSH/SQL 없이 일상 운영 상태를 확인하고, 안전한 범위의 발행 재시도를 수행하는 것이다.

현재 포함:

- 운영 요약
- 최근 주문
- 결제/자료 상태
- 발행 Queue 상태
- dead-letter / retry-wait 재시도
- 상품/버전 현황 조회
- 관리자 action audit

아직 포함하지 않음:

- PG 실제 환불 실행
- 상품 가격/버전 publish mutation
- 고객 개인정보 상세 조회
- NAS 파일시스템 직접 제어

이 작업들은 별도 Gate 후 추가한다.

## Security boundary

브라우저:

\`\`\`text
Supabase user JWT
→ own profile role=admin 확인
→ Admin Edge Function
\`\`\`

Edge Function:

\`\`\`text
JWT 재검증
→ profile.role=admin 재검증
→ service-role RPC
→ DB에서 admin actor 재검증
\`\`\`

즉 UI에서 버튼을 숨기는 것만으로 권한을 통제하지 않는다.

관리자용 RPC는 모두:

- anon execute: false
- authenticated execute: false
- service_role execute: true

## Issuance retry

\`retry_wait\`:
- 기존 job의 \`next_attempt_at\`을 현재 시각으로 당긴다.

\`dead_letter\`:
- 과거 job은 그대로 보존
- generation을 +1한 새 job을 queued로 생성
- admin action audit 기록

주문의 fulfillment aggregate는 같은 artifact의 **최신 generation만** 반영한다.
따라서 G1 dead-letter → G2 queued가 되면 과거 G1이 주문을 계속 failed로 고정하지 않는다.

재발행 generation > 1은 구매 당시 정확한 버전이 archived 상태가 되어도 허용한다. 최초 generation은 기존대로 published 버전만 허용한다.

## Admin action audit

\`admin_action_events\`에 다음만 기록한다.

- actor user id
- action
- target type/id
- 최소 detail
- created_at

고객용 브라우저에서는 이 테이블을 직접 조회할 수 없다.

## Refund boundary

관리자 화면에서 DB 상태만 임의로 refunded로 바꾸는 버튼은 만들지 않는다.

실제 환불은 V3의 PG refund API가 먼저 성공한 뒤 검증된 provider event를 통해 DB 상태가 바뀌어야 한다.

## Exit Gate

- 실제 admin 계정으로 /admin 접근
- customer 계정은 /admin 차단
- order/job/catalog 조회
- retry_wait expedite
- dead_letter → new generation queued
- action audit 기록
- Security Advisor 0 findings


## V6 Internal Issuance Registry

관리자 콘솔에 `발행 기록` 조회가 추가된다.

- 내부 참조
- 상품/버전
- generation
- lifecycle
- integrity
- SHA-256 prefix
- size
- private Storage object 무결성 확인

무결성 확인은 고객용 signed URL을 생성하지 않고 Admin Edge Function이 private object를 직접 읽어 SHA-256/size를 비교한다.
