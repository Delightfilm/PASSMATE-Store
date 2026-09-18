# PASSMATE V5 Private Storage & Download Contract

## Goal

발행 완료된 PDF는 public URL로 노출하지 않는다.

\`\`\`text
NAS Worker
  → private Supabase Storage
  → issuance_jobs.result_storage_key
  → 고객이 내 자료에서 다운로드 요청
  → download-url Edge Function
  → 구매권한/주문/발행상태 검증
  → 60초 signed URL
  → PDF 다운로드
\`\`\`

## Bucket

- bucket: \`passmate-artifacts\`
- public: false
- MIME: \`application/pdf\`
- file size limit: 50 MiB
- 영구 public URL 금지
- 브라우저에서 Storage object 직접 조회 금지

Storage object path는 기존 Processor 계약을 그대로 사용한다.

\`\`\`text
issued/{product_code}/{product_version}/{order_id}/{job_id}-g{generation}.pdf
\`\`\`

이 경로에는 고객 이름/이메일/전화번호 등 PII를 넣지 않는다.

## Worker upload

\`SupabaseArtifactStore\`는 NAS Worker의 service-role credential로 Storage API에 업로드한다.

- 업로드는 private bucket으로만 수행
- \`x-upsert: false\`
- retry 중 동일 key가 이미 존재하면 기존 object bytes의 size/SHA-256이 동일한 경우만 idempotent success로 인정
- 동일 key인데 bytes가 다르면 발행 실패
- stale completion discard는 Storage API delete를 사용

일반 upload는 Supabase에서 지원하지만 큰 파일은 네트워크 안정성 때문에 resumable upload가 더 유리하다. 현재 PASSMATE PDF 범위에서는 standard upload adapter를 우선 구현하며, 실제 MASTER PDF 크기 측정 후 필요 시 TUS adapter로 교체한다.

## Download authorization

\`resolve_download_artifact(user_id, entitlement_id)\`는 service-role only다.

signed URL 발급 조건:

1. 로그인 사용자와 entitlement user가 일치
2. entitlement가 active
3. entitlement의 source order가 본인의 paid order
4. order fulfillment가 ready
5. matching issuance job이 succeeded
6. storage key/hash/size가 모두 존재

환불 시 기존 order/entitlement 규칙에 따라 revoked가 되어 새 signed URL을 받을 수 없다.

## Signed URL

\`download-url\` Edge Function에서만 생성한다.

- JWT required
- TTL: 60초
- 다운로드 attachment 응답
- signed URL 자체는 DB/log에 저장하지 않음
- 발급 사실만 \`download_events\`에 기록
- 브라우저에는 일회성 URL만 반환

Supabase signed URL은 만료 전까지 유효하므로 TTL을 짧게 유지한다.

## Customer UI

\`내 자료\`에서는 고객에게 내부 Storage/발행 구조를 노출하지 않는다.

표시:

- 자료 준비 중
- 다운로드 가능
- PDF 다운로드

## Remaining E2E

NAS 접근 가능 시:

1. 실제 PDF를 \`SupabaseArtifactStore\`로 업로드
2. issuance job complete
3. order fulfillment = ready
4. 고객 entitlement로 download-url 호출
5. 60초 signed URL 생성
6. 브라우저 PDF 다운로드
7. 환불 후 새 URL 발급 차단
