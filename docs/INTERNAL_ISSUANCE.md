# PASSMATE V6 Internal Issuance Registry

## Scope

V6는 발행 완료된 PDF의 내부 운영기록을 별도 Registry로 관리한다.

고객 화면에는 이 구조를 노출하지 않는다.

## Registry

`issuance_artifacts`는 성공한 issuance job 1개당 1개 생성된다.

기록:

- 내부 참조값
- order / order_item / product / version / job 관계
- generation
- private Storage key
- SHA-256
- size
- lifecycle
- integrity 상태

고객 이름, 이메일, 전화번호 같은 PII는 저장하지 않는다.

## Lifecycle

```text
job succeeded
  → artifact active

같은 자료의 새 generation succeeded
  → 이전 active = superseded
  → 새 generation = active

order refunded
  → 해당 order의 artifact = revoked
```

과거 generation은 삭제하지 않고 운영 추적을 위해 보존한다.

## Audit

`issuance_artifact_events`는 append-only 운영 이벤트를 기록한다.

- registered
- superseded
- revoked
- integrity_verified
- integrity_mismatch
- integrity_unavailable

관리자가 수행한 무결성 확인은 기존 `admin_action_events`에도 남는다.

## Integrity verification

관리자 화면의 **무결성 확인**은 signed URL을 만들지 않는다.

```text
Admin JWT
→ admin-action Edge Function
→ service-role로 private object 직접 download
→ SHA-256 + byte size 계산
→ registry expected 값과 비교
→ verified / mismatch / unavailable 기록
```

`verified` 상태는 DB에서도 observed hash/size가 registry 값과 정확히 같을 때만 허용한다.

## Customer separation

고객의 `내 자료`와 `PDF 다운로드` 코드는 V6 Registry를 직접 조회하지 않는다.

고객 다운로드 권한의 source of truth는 계속:

- active entitlement
- paid/ready order
- succeeded issuance job

이다.

V6는 운영 추적/점검 레이어이며 판매·다운로드 권한을 우회하지 않는다.

## Exit Gate

- succeeded job → registry 자동 생성
- 새 generation → 이전본 superseded
- refund → registry revoked
- admin/customer 직접 table 접근 차단
- admin 목록 조회
- private object hash/size 실제 검증
- mismatch/unavailable audit
- 고객 UI 비노출
