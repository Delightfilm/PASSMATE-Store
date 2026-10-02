# PASSMATE Admin Workspace

## Goal

관리자가 SSH/SQL 없이 상품 데이터, 주문, 발행 상태를 운영할 수 있게 한다.

## Current UI

SmartStore형 좌측 메뉴 Workspace:

- 홈
- 상품 관리
- 콘텐츠 · 버전
- 주문 관리
- 발행 · 다운로드
- 테스트 센터
- 관리자 설정

상품 관리에서 현재 가능한 작업:

- 상품 검색/상태 필터
- 제목/설명/연도/배지/가격/구성품 수정
- 신규 상품 생성
- 판매 공개 상태 변경
- 비공개 상품 Preview

관리자 설정에서 현재 가능한 작업:

- 최근 `admin_action_events` 100건 조회
- 상품 생성/수정, 발행 재시도/재생성, artifact 무결성 확인 이력 추적

신규 상품은 항상 **비공개 + draft**로 생성한다.
published 버전이 없는 상품은 DB에서 active 전환을 거부한다.

Preview는 static export 제약 때문에 다음 단일 경로를 사용한다.

```text
/admin/products/preview/?code=<PRODUCT_CODE>
```

## Admin identity

현재 지정 관리자:

- Kakao OAuth 계정
- DB profile role=admin
- 지정 계정 allowlist 조건 추가

권한은 UI 이메일 비교만으로 결정하지 않는다.

```text
User JWT
→ profile role
→ Admin Edge Function
→ DB admin actor assertion
→ service-backed RPC
```

상품 create/update RPC는 anon/authenticated 직접 execute를 허용하지 않고 service role 경로에서만 실행한다.
운영 변경 이력도 브라우저가 테이블을 직접 읽지 않고, 관리자 role을 확인한 `admin-data` Edge Function을 통해서만 조회한다.

## Issuance operations

- 최근 주문 조회
- Queue/job 조회
- retry_wait 즉시 재시도
- dead_letter 새 generation 발행
- artifact registry 조회
- private Storage object SHA-256/size 무결성 확인

과거 generation/audit는 삭제하지 않는다.

## Boundaries

현재 관리자에서 직접 처리하지 않는 것:

- 임의 DB 상태 변경으로 환불 처리
- NAS 파일시스템 직접 조작
- 고객 결제정보 열람
- hard-delete

실제 환불은 PG 성공/검증 후 DB event로 반영해야 한다.

## Remaining E2E

- 지정 Kakao 계정 실제 브라우저 운영 확인
- non-admin 접근 차단 확인
- 상품 create/edit/preview 실제 흐름 확인
- 실제 관리자 작업 후 운영 변경 이력 표시 확인
- real dead-letter retry
- 실결제 이후 주문/발행 상태 확인
- 실제 Storage artifact 무결성 verify

## CBT Mate 문제은행 가져오기

- 관리자 \`문제은행 관리\`에서 PASSMATE bundle JSON을 검증하고 100문항 단위로 운영 Supabase에 저장한다.
- \`sourceHash\`는 검색·비교용 인덱스이며 고유키가 아니다. 같은 내용이 여러 회차에 출현한 경우 모든 원본 문항을 보존한다.
- 실제 원본 출현 단위는 크롤러의 \`question_uid\`이며, \`(import_batch_id, question_uid)\`는 네트워크 재시도에 의한 같은 배치의 중복 삽입만 방지한다.
- 저장 직후 문항 상태는 \`needs_review\`다. 관리자가 \`문제은행에 공개\`를 실행하면 해당 배치가 \`published\`가 되고 \`/question-bank/\`에서 회차별·단원별로 조회된다.
- 같은 \`question_uid\`를 다시 가져와 공개하면 과거 행은 삭제하지 않고 \`draft\`로 보존하며 최신 행만 공개한다.
- 이미지 문항은 bundle의 \`visual_refs\`와 \`visual_assets[].source_url\`을 함께 저장한다.
- 검증 실패 시 관리자 화면에서 JSON 오류 보고서를 내려받을 수 있다.
- 신고 문항 편집과 수정/검수 이력 보존은 [QUESTION_REVIEW.md](QUESTION_REVIEW.md)를 따른다.
