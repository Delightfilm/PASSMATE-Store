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

## 운영 배포 후 증거 (2026-10-07 21:40 KST)

- PR40 https://github.com/Delightfilm/PASSMATE-Store/pull/40 MERGED.
  main commit aad4006fa09c64234245f283894a8ada7314614a.
- GitHub Build 및 Vercel Preview SUCCESS. Preview 이미지 API 무인증 POST 401.
- Vercel production dpl_7hrfgL9KfPNGjpXzQYyQ6Kej2FRi READY.
  https://passmate-store-myug2uste-cueits-projects.vercel.app 및
  https://www.mypassmate.com, https://mypassmate.com 별칭 연결 확인.
- 실제 운영 admin 페이지 200, JS chunk app/admin/page-c515cf7adb2b29ae.js에서
  직접 수정·복수 정답·기존 DB 문항 메뉴가 새 버전으로 제공됨을 확인.
- 실제 운영 이미지 API 무인증 POST 401, 관리자 로그인 안내 응답.
- 운영 DB 기존 공개 문항 1,138 / 신고 1 / correction 1 / attempt 31 /
  감사 이벤트 2 유지; 편집 asset registry 0. 검증용 테스트 문항은 남기지 않았다.
- NAS catalog 200, 기존 release 2026-10-04-image-choices 및 totals 유지.
  AI cache health 200. 현행 nginx 컨테이너 healthy와 마운트 확인:
  default.conf.official-candidates + 세 원본/복구/공식 release 읽기 전용.
- 브라우저 관리자 접속은 로그인 화면으로 이동. 실제 관리자 계정 저장/조회/
  신고 완료 E2E는 로그인 전까지 미검증이다. DB/RPC 테스트와 UI fixture 검증을
  이 실제 계정 E2E 증거와 혼동하지 않는다.
- NAS 쓰기 경로 추가 승인 및 전용 키 설정 전이다. 운영 사진 자르기·대체·추가
  완료 여부는 여전히 미완료이며, 이를 완료된 기능으로 보고하지 않는다.
- 원래 grouping-desktop.png / grouping-mobile.png 미추적 파일은 그대로 보존.

## 집중 편집 UI 후속 검증 (2026-10-07 KST)

- 실제 CBT 본문/보기 렌더러를 재사용한다. 본문·보기·해설은 해당 수정 버튼을
  누르면 입력으로 바뀌며, 사진 도구는 펼쳤을 때만 보인다.
- 모바일 전체 화면, 데스크톱 가운데 창, 하단 저장·복수 정답 체크를 제공한다.
- Edge/Chromium의 360/390/430/1280px 크기 조정에서 가로 넘침 없음,
  보이는 편집 버튼/체크 레이블 44px 이상, 최초 수정 사유 입력만 펼쳐짐을 확인.
- 로컬 실제 컴포넌트에서 본문 수정/닫기 후 유지, 보기 삭제/정답 재정렬,
  복수 정답 저장, 저장 실패 시 입력 보존을 확인. 웹/DB 쓰기 및 AI 호출은 없음.
- 독립 리뷰가 찾은 긴 문항 저장 결과 가림을 수정했다. 실제 40줄 표본에서
  성공/실패 안내가 하단 저장 바에 보이며, 실패는 alert로 전달된다.
- 독립 브라우저에서 실제 Tab/Shift+Tab/Return/Escape 키 입력으로 열기·닫기 후
  원래 편집 버튼 초점 복귀를 확인했다. 합성 locator click 결과와 구분한다.
- 계약/UI/이미지 처리/NAS 서버 테스트 및 전체 npm run check 통과.
  단위 테스트의 dialog 존재 검사는 실제 모달/초점 검증으로 주장하지 않는다.
- 임시 QA route 제거 후 npm run build exit 0, 24개 정적 페이지 생성 및
  TypeScript 검사 통과. 빌드 route 목록에 editor-qa-local이 없다.
- 실제 휴대폰/Safari/화면 키보드 및 로그인한 운영 관리자 저장 E2E는 미검증.
  NAS 사진 쓰기 서버/인증키 활성화는 이 UI 변경에 포함하지 않는다.
- 임시 로컬 QA route는 배포 전에 제거한다. 생산 배포 증거는 확인 후 추가한다.

## 사진 서버 후속 재개 순서

1. 열린 운영 관리자 화면에 사용자가 직접 로그인한다 (채팅 비밀번호 금지).
2. NAS 편집 사진 전용 서버 쓰기 경로 추가에 대한 action-time 승인을 확인한다.
3. 전용 토큰은 NAS와 Vercel server-only Secret에만 등록한다. 새 credential을
   브라우저로 입력해야 하면 사용자가 직접 입력/제출한다. 채팅·로그·Git에 공개 금지.
4. NAS 현재 default.conf.official-candidates를 다운로드/해시 백업하고, 새 전용
   서버와 두 location만 추가한다. 원본 release/tunnel/AI 저장소를 보존한다.
5. nginx -t, 서버 health, HTTPS PNG/SHA/MIME, 무인증 PUT 거부, 원본 catalog/
   이미지/AI health를 점검한다. 인증키 환경 변경 후 필요한 단일 배포만 진행한다.
6. 별도 비공개 QA fixture 또는 롤백 가능한 검증 대상에서 관리자 실제 이미지
   자르기/대체/추가/저장·재조회·로그·신고 완료를 검증하고 이 문서에 증거를 추가한다.

## 롤백

새 schemaVersion 2 저장 전에는 이전 Vercel/Edge로 되돌릴 수 있다.
새 형식 저장 후에는 새 correction 읽기 기능을 남긴 채 편집 UI/쓰기만 비활성화한다.
이전 4지선다 reader로 일괄 복귀하면 새 문항이 거부될 수 있다.
DB correction/감사/신고/학습 기록과 NAS 원본/편집 사진은 삭제하지 않는다.
NAS 배포 시 실제 현행 nginx 설정 백업, nginx -t, public PNG MIME·무인증 PUT
거부 및 기존 catalog/AI 경로 정상 응답을 모두 확인한 후 연결한다.
