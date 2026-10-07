# 관리자 수동 문항 편집 운영 반영 기록

검증일: 2026-10-07 (KST). 자동 내용 점검·전체 재수집·전체 재import는 하지 않는다.

## 구현 범위

- 신고 접수 유지, 신고 없는 NAS/기존 DB 공개 문항 직접 검색·수정.
- 본문·해설·보기 2–10개, 복수 정답 체크박스. 선택한 정답 중 하나면 정답.
- 문제/보기 사진 참조 삭제, 사진 자르기·추가·대체용 서버 코드 준비.
- 사유·수정자·시간·변경 전후 비공개 감사 로그; 신고 검수 완료 시 대기 목록에서 제외.
- 원본/ID/학습 상태/예전 점수 보존. 자동 재채점 없음.

## 검증 증거

- npm run check 및 TypeScript 검사, Next 프로덕션 빌드 통과.
- 수동 편집/변수 보기/허용 답안/이미지 URL·자료형 경계 테스트 통과.
- 실제 React 컴포넌트 콜백: 업로드 중 저장/보기 변경 잠금, 안정적 보기 키,
  unmount/late-response 차단, NAS와 UUID 기존 DB 문항 검색 통과.
- 이미지 전용 수정/보기 개수 변경 시 실제 이미지 렌더링, 기존 단일 정답의
  유료 AI 해설 fingerprint 보존 및 수정 내용별 새 키 테스트 통과.
- 실제 Sharp 디코딩/좌표 자르기와 SVG·크기·자료형 거부 테스트 통과.
- NAS 서버의 실제 HTTP 테스트: 무인증 PUT 401, 유효 PNG 저장/GET/HEAD,
  해시 불일치·잘못된 MIME·경로 탈출 거부, 불변 저장 통과.
- 로컬 브라우저에서 보기 5개와 정답 [0,4] 저장 결과 확인.
  360/390/430/1280px 가로 넘침 없음. 편집 버튼 최소 44px 보강.
- 운영 DB 롤백-only 트랜잭션: 저장, 멱등성, stale version 충돌, 권한,
  invalid payload/image, 신고 수정+완료+감사 로그 원자성 통과. QA 데이터 전부 롤백.

## 운영 반영 및 보존 기준

- Supabase 프로젝트 fmecqeadghrdisirucqm.
- migration 20261007114733_manual_question_editor 적용 완료.
- question-bank-admin Edge v6 ACTIVE, verify_jwt=true.
- 반영 직전: 기존 공개 DB 문항 1,138, 신고 1, correction 1, attempt 31, 감사 이벤트 2.
- 새 question_bank_edit_assets는 RLS+직접 권한 차단, service-only 접근이다.
  RLS no-policy INFO는 의도적인 fail-closed 상태다.
  기존 Supabase leaked-password protection WARN은 이번 변경과 별개이며 변경하지 않았다.
- 이전 Edge v5 원본은 로컬 .codex-editor-backup/edge-before.json에 보존 (Git 제외).
- NAS 기존 nginx/tunnel/AI 저장소·릴리스는 변경하지 않았다.
- NAS 편집 사진 서버의 운영 연결/전용 인증키 설정은 승인 및 별도 검증 전까지 미완료.
  따라서 사진 자르기/대체/추가 기능의 운영 완료라고 판단하지 않는다.
- Vercel 배포 URL/버전/실제 운영 점검은 아래 후속 증거로 갱신한다.

## 롤백

새 schemaVersion 2 저장 전에는 이전 Vercel/Edge로 되돌릴 수 있다.
새 형식 저장 후에는 새 correction 읽기 기능을 남긴 채 편집 UI/쓰기만 비활성화한다.
이전 4지선다 reader로 일괄 복귀하면 새 문항이 거부될 수 있다.
DB correction/감사/신고/학습 기록과 NAS 원본/편집 사진은 삭제하지 않는다.
NAS 배포 시 실제 현행 nginx 설정 백업, nginx -t, public PNG MIME·무인증 PUT
거부 및 기존 catalog/AI 경로 정상 응답을 모두 확인한 후 연결한다.
