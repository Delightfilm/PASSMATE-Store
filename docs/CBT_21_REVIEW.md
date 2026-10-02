# CBT MATE 21개 개선: 변경 및 검증 보고서

작성일: 2026-10-02 (한국 시간). 기준 커밋: f39bec9323c3ce93fe2928826fdc3f2565a00fb8.
작업 브랜치: codex/cbt-21-review.

## 적용 범위와 완료 상태

실제 Next.js CBT 컴포넌트를 수정했다. 정적 목업 index.html은 이번 변경 대상이 아니다.
운영 DB에는 테스트 쓰기를 하지 않았고, 운영 진행 중 응시를 열지 않았다.
운영 배포/main 병합은 하지 않는다. Preview에서 검토 후 테스트 DB QA가 필요하다.
별도 hosted Supabase 테스트 DB 연결은 아직 확인되지 않아 서버 모의시험 시작은 비활성 상태다.
운영 DB를 바라볼 가능성이 있는 Preview에서는 CBT 동기화·신고·서버 제출을 차단한다.

통과: production build, 기존 계약 검증, React UI 검사, 격리 PostgreSQL 100회 시작 검사, 아래 로컬 브라우저 검증.
미완료: hosted Supabase Auth/RLS 통합, 실제 두 DB 연결의 동시 제출, 실제 iPhone safe-area, 로그인 상태 Preview E2E.
격리 PostgreSQL 검사는 PGlite의 한 연결에서 실행했다. 실제 동시 연결 시험을 대신하지 않는다.

## 파일 목록 / 작업 순서 / 위험 / 되돌리기 단위

| 단위 | 순서 | 파일 | 위험 및 되돌리기 |
|---|---|---|---|
| 서버 시험지·번호·안전장치 | P0: 2,3 → P1/P2 안전 연동 | lib/cbt-presentation.ts, lib/cbt-server-client.ts, lib/cbt-test-server.ts, lib/question-bank.ts, app/api/cbt/identity/route.ts, app/api/cbt/attempts/start/route.ts, app/api/cbt/attempts/[attemptId]/answer/route.ts, app/api/cbt/attempts/[attemptId]/submit/route.ts, next.config.ts | 높음. 테스트 DB 전용 플래그/프로젝트 검증. 커밋 5d159e4 단위. UI 연동 커밋을 먼저 되돌린 뒤 서버 커밋을 되돌린다. |
| UI·탐색·접근성 | P0: 1,4 → P1: 5–12 → P2: 13–21 | app/cbt/[certSlug]/page.tsx, app/globals.css, components/auth-nav.tsx, components/cbt-exam-ui.tsx, components/question-bank-client.tsx | 중간. 헤더 틀/브랜드 토큰/권리 고지는 유지. 폭 전환 보완 커밋부터 되돌린 뒤 UI 연동 전체를 함께 revert한다. |
| SQL·검증 | 각 단계에서 실행 | docs/cbt-test-migration.DRAFT.sql, docs/cbt-test-qa.sql, scripts/validate-cbt-test-db.mjs, scripts/validate-cbt-ui.mjs, scripts/validate-question-bank-contract.mjs | 테스트용 DRAFT만 제공. hosted DB에는 적용하지 않았다. 테스트 DB를 적용 전 스냅샷으로 복구하거나 폐기한다. 운영의 권한을 임의로 복원하는 롤백은 하지 않는다. |
| 보고 | 마지막 | docs/CBT_21_REVIEW.md, docs/STATUS.md | 낮음. 문서 커밋으로 추적. |

아래 “전/후 코드”는 기준 커밋과 작업 결과에서 추출한 **실제 전체 unified diff**의 해당 파일/식별자를 참조한다.
보고서 끝에 전체 diff와 테스트 DB SQL 전문을 포함했다. 설명을 위해 만들어 낸 코드를 실제 발췌로 제시하지 않는다.

## 항목별 원인 → 수정 → 전/후 코드 위치

### P0

| 번호·이미지 | 확인한 원인 | 수정 | 실제 전/후 코드 위치 |
|---|---|---|---|
| 1 · 06-A,09-8 | 상단 숨김 1100px와 하단 노출 900px가 달라 빈 구간 발생 | 안 2: 하단 4탭을 1100px까지 확장. 헤더 기본 틀을 유지하며 모든 중간 폭에 이동 수단 확보 | globals.css의 @media (max-width:1100px), question-bank-bottom-nav |
| 2 · 01-②③,04-①②,07-6 | 클라이언트가 전체 문항을 섞어 60개 추출해 과목별 수/순서가 불규칙 | 서버 cbt_start가 과목별 20개씩 선택, 과목 내 순서만 seed로 섞고 ordered IDs/config를 고정. 20개 미만이면 INSERT 전에 예외. 구성 카드도 각 20으로 표시 | question-bank-client.tsx의 모의시험 시작/구성 카드 전후; 새 SQL cbt_start; cbt-presentation.ts의 MOCK_SUBJECTS |
| 3 · 01-①,04-③,06-C,07-1 | 계정 표시 이름은 profiles.display_name인데 안내는 auth user_metadata를 읽음. 응시 번호는 local attempt ID에서 잘라 표시 | profiles를 실제 읽고 시작 시 name snapshot 저장. server HMAC 일별 번호 예약 및 UNIQUE(day,number), UNIQUE(user,day). 기존 번호 없는 기록은 –. CBT 이메일 숨김 | question-bank-client.tsx의 displayName, MockExamGuide, ExamScreen/ResultScreen; auth-nav.tsx; SQL cbt_prepare_identity |
| 4 · 05-A,09-7 | 탭 상태만 바꾸고 가로 스크롤 컨테이너를 이동하지 않음 | 첫 로드/선택 변경 및 ResizeObserver로 폭 변경 시 container.scrollTo로 가운데 배치. 페이지 세로 위치는 유지. 6px 링 여백과 가장자리 페이드 | cbt-presentation.ts centerInScroller; question-bank-client.tsx tabsRef/useEffect; globals.css cbt-detail-tabs-wrap |

### P1

| 번호·이미지 | 확인한 원인 | 수정 | 실제 전/후 코드 위치 |
|---|---|---|---|
| 5 · 01-④,07-5 | Toast effect가 매초 다시 생성되는 onDone에 의존해 timeout을 계속 취소/재설정 | 최신 callback은 ref에 보관, effect는 message만 의존, 2700ms 후 소멸. role=status 유지, 고정 이동 바 위로 배치 | question-bank-client.tsx function Toast; globals.css cbt-toast |
| 6 · 03-①②③⑤,07-2,08-1② | 모바일 이동/답안지 버튼이 본문 일반 흐름, 헤더 과밀/시간 위계 약함 | 시간 20px, 유형/이름/번호 표시, 설정/시험 메뉴/제출 구분. ≤620px 두 줄 헤더와 safe-area 고정 이전/답안지/다음 | question-bank-client.tsx ExamScreen, cbt-exam-bottom-bar; globals.css 620px overrides |
| 7 · 01-⑥,03-⑥,07-2,08-3 | 하나의 버튼이 중간 채점 확인과 나가기를 함께 담당 | 시험 ⋯에 중간 채점/나가기 분리. 나가기 확인은 답안 저장·시간 계속 안내. 확정 뒤 pending 답안 저장을 기다리고, 확인된 문서 이동만 exit 가드를 통과. 기존 중간 채점은 응답 문항의 정오와 정답률 표시, 제출하지 않음 | question-bank-client.tsx exam menu/leave/interim. 정책 허용 여부는 확인 필요 |
| 8 · 01-③⑤,03-④,07-6⑦,08-4 | 전체 과목을 긴 답안지에 나열하고 행 간격 큼 | 과목 선택·미응답만·현재 행 내부 스크롤·나중에 보기. row48+gap4 ≈52px, 칩44. 서버 모의시험의 고정 순서로 1–20/21–40/41–60 | question-bank-client.tsx AnswerSheet/sections/filter; globals.css cbt-answer-row/scroll |
| 9 · 02-B | 스트립 모드 카드만 별도 좁은 폭/가운데 정렬, 이웃10개 slice | 같은1180 컨테이너, 전체 문항을 가로 스크롤하며 현재 번호 중심 이동. 배경/하단 정렬 통일 | question-bank-client.tsx cbt-number-strip의 slice 제거; globals.css cbt-live-layout.is-strip |
| 10 · 02-C | font class가 보기만 확대 | 본문·보기·답안지·요약의 text/meta/stem CSS 변수 적용. 기본16/12/21, 큼19/14/24, 아주 큼22/16/27 | globals.css exam-font-large/exam-font-xlarge, cbt-live-question/answer-sheet/exam-summary |
| 11 · 04-B~E | 단계 내용 높이가 달라 modal 위치 점프, 단계별 제목 focus 없음 | 안내 content min-height390 및 상단 정렬. 단계 변경 때 제목 focus(preventScroll) | cbt-exam-ui.tsx MockExamGuide; globals.css cbt-guide-content |
| 12 · 07-4 | 시험 표시와 계정 bookmark를 같은 저장소·라벨로 처리 | 시험내 reviewIds는 ◇ 나중에 보기, 계정 북마크는 문항 ⋯의 북마크 저장/삭제. managed row는 서비스 RPC로 review 변경 | question-bank-client.tsx toggleReview/persistManaged/question menu; question-bank.ts config reviewIds; SQL cbt_answer |

### P2 / 신규

| 번호·이미지 | 확인한 원인 | 수정 | 실제 전/후 코드 위치 |
|---|---|---|---|
| 13 · 05-C,D,09-1②③ | status만 보고 만료도 진행 중으로 표시. 이력 이름/문항수/액션 위계 부족 | endAt으로 화면만 만료 표시, 최신 미만료1개만 이어서 풀기. 만료는 결과 저장하기→기존 만료 모달→확정POST. 유형·문항수·12px 날짜·44px 우측 버튼. 이 종목 기록 탭 | cbt-presentation.ts expiredAttempt/attemptLabel; question-bank-client.tsx CertRecords; auth-nav.tsx resume |
| 14 · 05-B,09-4⑤ | 모든 선택 회차가 진한 파랑, 빠른 선택·수량 요약 없음 | 연한 선택 배경+체크, 전체/해제/최근5, n/총회차와 실제 필터 가용수. 카드 정렬. builder→custom 서버307 및 클라이언트 호환. 한글 경로는 decode→encode로 정규화하여 이중 인코딩 방지 | app/cbt/[certSlug]/page.tsx redirect; question-bank-client.tsx builder controls; globals.css |
| 15 · 06-B,09-6 | 텍스트 재시도가 테두리 ⋯보다 약하고 제목 중복 | 재시도 테두리 버튼, 해설 보조, ⋯ ghost. 카드에는 개수만, 체크박스44와10px 간격, filter border 통일 | question-bank-client.tsx WrongNotesScreen/QuestionRows; globals.css cbt-review-* |
| 16 · 06-C | 실패 badge ↻, legacy number 내부ID, 카드 stretch | 실패 ×+합격 기준 미달, 번호 – fallback, 과목 카드 상단 정렬 | question-bank-client.tsx ResultScreen; globals.css stats align-items:start |
| 17 · 05-A | 탭과 panel의 ARIA 연결/탭 내용 역할 없음, breadcrumb 작은 링크 | tabpanel/controls/labelledby. 방향키 자동 활성화: 내용 전환이 즉시 가능한 로컬 UI라 추가 확정키 불필요. Home/End, breadcrumb44, 모의시험 용어 | question-bank-client.tsx CertScreen tab/panel/HomeScreen; globals.css breadcrumb |
| 18 · 07-3,08-6 | 요약이 표시 전용 | 응답/미응답/나중에 보기 buttons가 해당 답안 필터. 모바일은 시트 열기. 진행률=응답수 | question-bank-client.tsx filterAnswers, cbt-exam-summary |
| 19 · 08-5 | 시간 정상 pill만 존재 | 601초 정상, ≤600 amber+닫기 배너, ≤300 오류색+굵은 시간. 경고문 병행, Set ref로 10/5분 한 번씩 announce. 기존 timeLeftSeconds/만료 조건 유지 | question-bank-client.tsx secondsLeft/timeAnnouncement; globals.css cbt-live-timer.is-warning/is-urgent. 신규DB컬럼 없음 |
| 20 · 08-7⑧ | 기존 코드는 이미 제출→점검→확인→POST였다. 점검이 페이지 형태 | native dialog 점검을 모바일 하단 시트/데스크톱 modal로. 미응답44px 오류색 번호 복귀, reviewIds 목록. 최종 확정 후만 finish POST. 중첩 modal의 titleId를 useId로 분리 | question-bank-client.tsx reviewOpen/Modal/finish; globals.css cbt-review-modal; SQL cbt_submit |
| 21 · 07-8 | 12px 단축키 문구가 토스트와 겹치고 이동 버튼이 내용 흐름 | native popover 단축키 보기 및 sticky 카드 하단 이전/다음. 모바일은 기존 새 고정 바 사용 | question-bank-client.tsx shortcut popover; globals.css cbt-live-question-footer |

## DB 설계 / 안전장치

새 attempts 컬럼은 추가하지 않는다. 기존 config JSONB에 mode, seed, questionIds(순서), practiceNumber,
displayNameSnapshot, reviewIds, lockedIds, serverManaged를 저장한다.
기존 end_at/status/answers를 #13/#19/#20에 재사용한다. 시간 경고와 만료 라벨 자체는 DB 쓰기 없이 계산한다.

- private number_secret/daily_numbers: RLS, anon/auth 권한 없음. 같은 계정/날 PK와 일별 번호 UNIQUE.
- HMAC(user UUID+Seoul date, DB private secret). 5자리 공간 100000개. 충돌은 빈 번호 탐색으로 해결.
  하루 100000계정이 ceiling이고, 현재는 일자별 짧은 advisory lock으로 번호 할당을 직렬화한다.
- RPC는 service_role만 EXECUTE, SECURITY INVOKER + search_path='' + 완전한 스키마명.
  service_role이 필요한 권한을 갖고 있어 SECURITY DEFINER 승격을 추가할 필요가 없다.
- 인증 사용자 ID는 서버가 bearer token의 getUser 결과에서 가져온다. 클라이언트가 준 user_id를 신뢰하지 않는다.
- authenticated는 attempts SELECT만 허용하고 직접 INSERT/UPDATE/DELETE를 revoke한다. 기존 owner SELECT RLS 유지.
- answer/submit는 FOR UPDATE와 소유자 검사. answer는 서버 deadline/status 확인.
- submit는 이미 submitted이면 첫 결과를 그대로 반환. 신규 갱신은 status=in_progress 조건.
  (user_id,client_id) UNIQUE, wrong-note 증가는 첫 제출만. GET route로 RPC를 호출하지 않는다.
- identity 예약은 명시적인 안내 준비 POST. 시험 응시는 시작 확정 POST 뒤에만 만들어진다.
- 서버 기능은 테스트 프로젝트 ref가 public URL과 일치하고 known production ref와 다를 때만 활성화.
  VERCEL_ENV=production은 거부한다. 서비스 secret은 NEXT_PUBLIC에 넣지 않는다.
- JSON 입력 배열/UUID/선택값/제한시간을 API와 SQL에서 검증. 서버는 published/4choices/정답범위가 유효한 문항만 추출.
- managed 답안 전송은 순서대로 처리하며 실패를 알린다. 제출은 pending 답안 저장 성공 뒤에 진행.
  canonical remote managed row로 새로고침 시 복원한다.

SQL 전문은 아래 “테스트 DB SQL”에 있다. 운영 실행 금지. SET app.cbt_test_database='true'는
담당자가 **별도 테스트 프로젝트임을 확인한 뒤** 실행한다. 이 사용자 설정 자체가 프로젝트를 식별하는 보안 장치는 아니며,
서버 프로젝트 ref 검증과 별도 연결 관리가 함께 필요하다.

과목 순서는 재료→작업 및 안전→색채로 결정했다.
총1138은19×60=1140보다2문항 적다. 어느 회차/과목이 부족한지는 실제 SELECT 결과 전까지 확인 필요.
현재 mock은 모든 published 회차의 과목 pool에서20개를 뽑으므로 회차마다20개가 아니어도 각 pool20개 이상이면 시작할 수 있다.

## 반응형 실측

로컬 production 빌드의 실제 종목 상세(custom,records), 비로그인 로컬 맞춤 시험지에서 측정.
각 폭 높이는844px. 데스크톱 증빙만1440×900. 탭 자체의 의도된 가로 스크롤은 제외.
터치/글자 수치는 표시된 CBT 본문 조작 요소 기준이다. 아래 링 검사는 종목 탭 첫/끝 포커스의
5px 외부 링 공간을 DOM rect로 측정했으며, 응시 답안지와 모달은390/1440 대표 화면을 추가 확인했다.
사이트의 모든 다른 화면/모든 focus 조합을 측정했다는 뜻은 아니다.
Preview 추가 점검에서 첫 로드는 정상이지만 데스크톱→모바일 폭 변경 때 탭 일부가 가려지는 현상을 확인했다.
컨테이너 ResizeObserver로 같은 reveal 함수를 다시 호출하도록 보완했다.

| 폭px | CBT 일반 메뉴 | 페이지 가로 넘침 | 터치 최소44 | 글자 최소12 | 선택탭 보임 | 탭 첫/끝 링 | 탭 이동 페이지Y |
|---:|---|---|---|---|---|---|---:|
|320|하단4탭|없음|통과|통과|통과|온전|0 유지|
|360|하단4탭|없음|통과|통과|통과|온전|0 유지|
|390|하단4탭|없음|통과|통과|통과|온전|0 유지|
|600|하단4탭|없음|통과|통과|통과|온전|0 유지|
|640|하단4탭|없음|통과|통과|통과|온전|0 유지|
|768|하단4탭|없음|통과|통과|통과|온전|0 유지|
|900|하단4탭|없음|통과|통과|통과|온전|0 유지|
|901|하단4탭|없음|통과|통과|통과|온전|0 유지|
|1024|하단4탭|없음|통과|통과|통과|온전|0 유지|
|1100|하단4탭|없음|통과|통과|통과|온전|0 유지|
|1101|상단메뉴|없음|통과|통과|통과|온전|0 유지|
|1148|상단메뉴|없음|통과|통과|통과|온전|0 유지|
|1200|상단메뉴|없음|통과|통과|통과|온전|0 유지|
|1280|상단메뉴|없음|통과|통과|통과|온전|0 유지|
|1432|상단메뉴|없음|통과|통과|통과|온전|0 유지|

응시 전용 화면은 일반 사이트 메뉴 대신 기존 응시 헤더를 사용한다.
응시 이동 바는 ≤620px에서 fixed이며 측정한320/360/390/600에서는 bottom=844다.

### 色の計算値

| 前景/背景 | 比率 |
|---|---:|
|#1D4ED8/흰색|6.70|
|#111827/흰색|17.74|
|#4B5563/흰색|7.56|
|#257343/#EFF9F1|5.40|
|#9A640B/#FFF7E8|4.69|
|#B5473C/#FFF2EF|4.88|
|#55C935/#111827|8.27|
|#6B7280/흰색(조작 경계)|4.83|

본문 텍스트 토큰은4.5 이상. #D1D5DB는 장식 카드 경계이며, 필요한 입력/보기/칩 경계는 더 진한 색을 사용.
라임은 네이비 숫자에 한정. 포커스 #1D4ED8은 흰색에서3 이상.
고대비 OS/실제 스크린리더/실제 iOS 홈 인디케이터 검증은 별도 필요.

## 수행한 QA / 미완료 QA

| 사용자 검사 | 실제 수행 / 결과 | 남은 검사 |
|---|---|---|
|①100회20/20/20·중복0·연속번호|격리 PostgreSQL100시작. 과목/ID60개·유일·순서·seed 검증 통과. 각pool19일 때 시작 거부/행 생성0 검증|hosted Preview 계정으로100회|
|②같은 계정/날 번호·다른 계정 unique|격리100계정 HMAC 번호 유일, 반복identity 동일 검증|hosted Auth 실계정2개 이상/날짜경계|
|③새로고침/이어서 복원|저장 seed/ordered IDs 검사, managed remote 우선복원 코드. 브라우저 로컬60문항 선택 상태 새로고침 복원|hosted managed 응시 새로고침/다중기기|
|④만료GET 무변경|격리 expired row SELECT 전후 status=in_progress 유지; answer거부; 확정submit 가능|hosted 실제 페이지 GET 전후SQL/네트워크|
|⑤두 탭 최초결과|격리 반복submit에 행1/첫answers·score·timestamp 유지. FOR UPDATE 코드 확인|실제 서로 다른 DB연결 동시POST(미완료)|
|⑥토스트/고정바|callback reset 원인 수정2700ms; 브라우저 토스트 나중에 소멸 확인(정확한2700ms실측 아님),15폭바/버튼 측정|실제 iOS safe-area와 음성status1회|
|⑦기록 만료읽기전용|SSR expired 라벨/버튼 및 store무변경 검사. SQL SELECT 무변경|hosted 화면열기 전후hash|
|⑧10/5분표시|SSR601/600/300초 정상/amber/error 문구 검증|실제 시간이 threshold를 지날 때 announce1회/백그라운드|
|⑨미응답번호복귀|모바일 점검35클릭→문제35,점검닫힘. 최종제출→확인modal→취소 확인. DBsubmit안함|hosted 저장 API까지 흐름|

추가 코드 검사: 실제 leave 함수를 실행해 저장 대기 중 이동0, 저장 성공 후 이동, 저장 실패 때 가드 유지·이동0·오류 알림을 검증했다.
최신 Preview에서 확정된 나가기 후 실제 종목 화면 이동을 확인했다. 한글/인코딩된 builder 경로와 반복 query 보존은 실제 route 함수 검사로 통과했다.
Preview soft navigation에서 확인 후 응시 화면에 남는 현상이 발견돼 확정 후 document replace로 전환했다. 원인 세부는 기존 history 가드/SPA 이동 상호작용 후보이며 서버 상태 변경과 무관하다.

추가 브라우저 확인: radio ←/→는 focus만 이동, Space 선택 후 문제카드/칩 같은 상태;
다른 행 선택해도 현재 문제 유지; settings아주큼/2단/B전환, 본문27px과60개 strip 확인;
Escape settings닫힘+opener포커스복귀; Home/End 탭 즉시 활성화; 모바일 나중에보기 요약 클릭 시1개 필터 시트.

### 재실행

```sh
npm run build
npm run check:question-bank
CBT_QA_PACKAGE_JSON='/absolute/path/to/qa-tools/package.json' node scripts/validate-cbt-test-db.mjs
```

PGlite/pgcrypto는 작업 폴더 outputs/qa-tools에만 설치했고 앱 package/lockfile에 추가하지 않았다.
격리 테스트 스크립트는 운영 Supabase URL/secret을 읽지 않는다.

### Hosted 테스트 DB 준비 후 수행할 절차

1. 빈 별도 프로젝트에 기존 CBT schema/owner RLS를 준비하고 비실제 문제/보기와19회차 테스트 fixture를 넣는다.
2. 테스트 계정2개를 만들고 profiles.display_name을 설정한다. 운영 사용자 데이터를 복사하지 않는다.
3. 프로젝트ref/호스트/DB snapshot을 확인한 후 DRAFT SQL의 명시적 confirmation을 설정하고 적용.
4. Vercel **Preview 전용** 환경변수: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
   SUPABASE_SECRET_KEY(서버전용), CBT_TEST_PROJECT_REF, NEXT_PUBLIC_CBT_SERVER_EXAMS=1.
   known 운영ref를 넣으면 서버가 거부한다. 환경변수를 바꾼 뒤 Preview를 다시 빌드.
5. UI100회 모의시험 시작은 테스트 계정에서만. cbt-test-qa.sql로 ordered IDs·과목 수·snapshot·unique 확인.
6. 종료시각이 짧은 **별도 테스트 fixture** 응시를 만들고 deadline 전후 UI를 확인한다.
   기존 서버 timer 계산/생산 데이터/클라이언트 clock을 임의 조작하지 않는다.
7. SQL로 attempt answers/status/end_at/submitted_at/score·행수를 기록한다.
   만료GET/새로고침/두 탭열기 이후 동일한지 비교. DevTools network에는 submitPOST가 없어야 한다.
8. 탭A·B에서 동일ID의 최종 확인을 거의 동시에 눌러 POST2개를 보낸다.
   DB row1,두응답score/answers/submittedAt같음,wrong-note카운트1회증가를 SQL로 확인.
   서버로그에는attemptID·요청ID·alreadySubmitted만 기록하고 token/email/문제정답은 출력하지 않는다.
9. 사용자B는 A의 answer/submit 거부. anon/authenticated attempts UPDATE와 RPC 직접호출 거부.
10. Preview UX/RLS/동시성 검사 모두 통과하기 전 production promote/main merge 금지.

## [확인 필요] / [결정 필요]

- [확인 필요] 별도 hosted 테스트 Supabase 연결. Connector에 보이는 프로젝트와 앱 기본 public 프로젝트ref가 달라 운영/테스트라고 단정하지 않는다.
- [확인 필요] 실제19회차×3과목 문항 수, published/보기4개/정답범위가 유효한 가용 pool.
- [확인 필요] 중간 채점의 정책: 현재 응답한 문항의 정오/정답률을 보여주는 연습 기능. 범위 허용 여부.
- [확인 필요] 공개 학습 데이터 SELECT에서 정답 접근 가능한 기존 구조는 이번21항목으로 분리하지 않았다. 정식 시험 보안 강화는 별도 작업.
- [확인 필요] 기존 mode 없는 복수 회차 기록은 mock/custom을 신뢰성 있게 역산할 수 없어 “이전 시험”으로 표시.
- [확인 필요] 실제 iOS safe-area, OS forced-colors, 스크린리더 live announcement, hosted 다중탭 race.
- [결정 필요] 하루100000계정 번호 상한을 초과할 때 5자리 확장. 현재 요구된5자리 유지.
- 선택 완료: 메뉴안2(하단≤1100), 탭자동활성화(즉시내용전환), 과목순서 재료→작업/안전→색채.
- 기존 선택칩 재클릭 해제 동작 유지. 이번 작업에서 새 선택 정책을 추가하지 않았다.

## 스크린샷

실제 로컬 Next.js UI, 익명·로컬 응시. 운영 응시가 아니다. 과목 순서는 기존 로컬 맞춤 시험지이며,
서버 고정 모의시험의20/20/20 순서는 위 격리SQL 검사로 검증했다.

- ../../outputs/cbt-21-review/exam-desktop.jpg —1440×900
- ../../outputs/cbt-21-review/exam-mobile.jpg —390×844
- ../../outputs/cbt-21-review/answer-mobile.jpg —390×844
- ../../outputs/cbt-21-review/review-mobile.jpg —390×844
- ../../outputs/cbt-21-review/records-mobile.jpg —390×844

## 실제 변경 전/후 코드 전체

기준 f39bec9 → 이 작업 결과. 각 항목 표의 파일·식별자로 해당 hunk를 찾는다.
SQL 전문은 다음 절에 별도 포함했다.

```diff
diff --git a/app/api/cbt/attempts/[attemptId]/answer/route.ts b/app/api/cbt/attempts/[attemptId]/answer/route.ts
new file mode 100644
index 0000000..9bcf828
--- /dev/null
+++ b/app/api/cbt/attempts/[attemptId]/answer/route.ts
@@ -0,0 +1,13 @@
+import { cbtError, cbtTestServer } from "@/lib/cbt-test-server";
+
+export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
+  try {
+    const { db, userId } = await cbtTestServer(request);
+    const { attemptId } = await params;
+    const body = await request.json();
+    if (!/^managed-[0-9a-f-]{36}$/i.test(attemptId) || typeof body.questionId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.questionId) || !(body.choice === null || Number.isInteger(body.choice) && body.choice >= 0 && body.choice <= 3) || !(body.review === null || typeof body.review === "boolean")) throw new Error("답안을 확인해 주세요.");
+    const { data, error } = await db.rpc("cbt_answer", { p_user: userId, p_attempt: attemptId, p_question: body.questionId, p_choice: body.choice, p_review: body.review });
+    if (error) throw new Error("답안을 저장하지 못했습니다. 시간이 종료되었거나 제출된 시험일 수 있습니다.");
+    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
+  } catch (error) { return cbtError(error); }
+}
diff --git a/app/api/cbt/attempts/[attemptId]/submit/route.ts b/app/api/cbt/attempts/[attemptId]/submit/route.ts
index 9524f39..78577ba 100644
--- a/app/api/cbt/attempts/[attemptId]/submit/route.ts
+++ b/app/api/cbt/attempts/[attemptId]/submit/route.ts
@@ -1,8 +1,19 @@
 import { createClient } from "@supabase/supabase-js";
 import { getPublicSupabaseConfig } from "@/lib/public-supabase-config";
+import { cbtError, cbtTestServer } from "@/lib/cbt-test-server";
 
 export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
+  if (process.env.NEXT_PUBLIC_CBT_PREVIEW_READ_ONLY === "1") return Response.json({ error: "별도 테스트 DB 연결 후 결과를 저장할 수 있습니다." }, { status: 503 });
   const { attemptId } = await params;
+  if (attemptId.startsWith("managed-")) {
+    try {
+      if (!/^managed-[0-9a-f-]{36}$/i.test(attemptId)) throw new Error("응시 번호를 확인해 주세요.");
+      const { db, userId } = await cbtTestServer(request);
+      const { data, error } = await db.rpc("cbt_submit", { p_user: userId, p_attempt: attemptId });
+      if (error) throw new Error("결과를 저장하지 못했습니다. 다시 시도해 주세요.");
+      return Response.json(data, { headers: { "Cache-Control": "no-store" } });
+    } catch (error) { return cbtError(error); }
+  }
   const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
   if (!token) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
 
diff --git a/app/api/cbt/attempts/start/route.ts b/app/api/cbt/attempts/start/route.ts
new file mode 100644
index 0000000..f0c3f52
--- /dev/null
+++ b/app/api/cbt/attempts/start/route.ts
@@ -0,0 +1,12 @@
+import { cbtError, cbtTestServer } from "@/lib/cbt-test-server";
+
+export async function POST(request: Request) {
+  try {
+    const { db, userId } = await cbtTestServer(request);
+    const body = await request.json();
+    if (!body || !/^[0-9a-f-]{36}$/i.test(body.certId) || !["mock", "custom", "past", "subject"].includes(body.mode) || !["submit", "instant"].includes(body.gradeMode) || ![null, 30, 60, 90].includes(body.minutes) || !Array.isArray(body.questionIds) || body.questionIds.length > 120 || !body.questionIds.every((id: unknown) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id))) throw new Error("시험 구성을 확인해 주세요.");
+    const { data, error } = await db.rpc("cbt_start", { p_user: userId, p_cert: body.certId, p_mode: body.mode, p_ids: body.questionIds, p_minutes: body.minutes, p_grade: body.gradeMode });
+    if (error) throw new Error(error.message.includes("20") ? "과목별 가용 문항이 20개 이상인지 확인해 주세요." : "시험 구성을 저장하지 못했습니다. 다시 시도해 주세요.");
+    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
+  } catch (error) { return cbtError(error); }
+}
diff --git a/app/api/cbt/identity/route.ts b/app/api/cbt/identity/route.ts
new file mode 100644
index 0000000..384d825
--- /dev/null
+++ b/app/api/cbt/identity/route.ts
@@ -0,0 +1,11 @@
+import { cbtError, cbtTestServer } from "@/lib/cbt-test-server";
+
+// Reserving a collision-free daily number is explicit preparation, never GET.
+export async function POST(request: Request) {
+  try {
+    const { db, userId } = await cbtTestServer(request);
+    const { data, error } = await db.rpc("cbt_prepare_identity", { p_user: userId });
+    if (error) throw new Error("연습용 번호를 준비하지 못했습니다.");
+    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
+  } catch (error) { return cbtError(error); }
+}
diff --git a/app/cbt/[certSlug]/page.tsx b/app/cbt/[certSlug]/page.tsx
index bd7217a..6326c6b 100644
--- a/app/cbt/[certSlug]/page.tsx
+++ b/app/cbt/[certSlug]/page.tsx
@@ -1,13 +1,20 @@
 import type { Metadata } from "next";
+import { redirect } from "next/navigation";
 import { QuestionBankClient } from "@/components/question-bank-client";
 
 export async function generateMetadata({ params }: { params: Promise<{ certSlug: string }> }): Promise<Metadata> {
   const { certSlug } = await params;
   const name = decodeURIComponent(certSlug).replace(/-/g, " ");
-  return { title: `${name} | CBT MATE`, description: `${name}의 회차별 기출과 단원별 문제를 풀고 모의고사를 만드세요.` };
+  return { title: `${name} | CBT MATE`, description: `${name}의 회차별 기출과 단원별 문제를 풀고 모의시험이나 맞춤 시험지를 시작하세요.` };
 }
 
-export default async function CertPage({ params }: { params: Promise<{ certSlug: string }> }) {
-  const { certSlug } = await params;
+export default async function CertPage({ params, searchParams }: { params: Promise<{ certSlug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
+  const [{ certSlug }, query] = await Promise.all([params, searchParams]);
+  if (query.tab === "builder") {
+    const canonical = new URLSearchParams();
+    for (const [key, value] of Object.entries(query)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) canonical.append(key, item);
+    canonical.set("tab", "custom");
+    redirect(`/cbt/${encodeURIComponent(decodeURIComponent(certSlug))}/?${canonical}`);
+  }
   return <QuestionBankClient mode="cert" certParam={certSlug} />;
 }
diff --git a/app/globals.css b/app/globals.css
index 473c205..0e64613 100644
--- a/app/globals.css
+++ b/app/globals.css
@@ -560,7 +560,7 @@ body.cbt-exam-active main{min-height:100vh}
 @media(max-width:768px){.cbt-cert-grid{grid-template-columns:1fr}.cbt-learning-filters{flex-wrap:wrap}.cbt-learning-row{grid-template-columns:1fr}.cbt-subject-stats>div,.cbt-rate-row{grid-template-columns:120px minmax(60px,1fr) 40px}.cbt-modal-actions{flex-direction:column-reverse}.cbt-modal-actions .button{width:100%}.cbt-interim-summary{grid-template-columns:1fr 1fr}.cbt-interim-summary strong{grid-row:auto;grid-column:1/-1}.cbt-exam-logo{display:none}.exam-page>.exam-topbar{grid-template-columns:1fr 1fr auto}}
 
 .mobile-cbt-nav{display:none}
-@media(max-width:900px){
+@media(max-width:1100px){
   .mobile-cbt-nav{position:fixed;inset:auto 0 0;z-index:60;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));padding-bottom:env(safe-area-inset-bottom);border-top:1px solid var(--line);background:#fff}
   .mobile-cbt-nav a{display:grid;place-items:center;min-height:56px;padding:8px 2px;color:var(--muted);font-size:12px;font-weight:700;text-align:center}
   .mobile-cbt-nav a[aria-current="page"]{color:var(--blue);background:var(--blue-soft)}
@@ -1139,3 +1139,118 @@ body{word-break:keep-all}
   .cbt-wrong-row .cbt-note-explanation{grid-row:2;justify-self:start}
 }
 @media(forced-colors:active){.cbt-answer-choice.is-chosen{border:3px solid Highlight}.cbt-answer-row.is-current{outline:2px solid Highlight;outline-offset:-2px}}
+
+/* CBT review 01–09: same tokens, explicit scroll gutters and compact controls. */
+.cbt-detail-tabs-wrap{position:relative;min-width:0}
+.cbt-detail-tabs-wrap:before,.cbt-detail-tabs-wrap:after{content:"";position:absolute;top:0;bottom:0;width:6px;z-index:1;pointer-events:none}
+.cbt-detail-tabs-wrap:before{left:0;background:linear-gradient(90deg,var(--soft),transparent)}
+.cbt-detail-tabs-wrap:after{right:0;background:linear-gradient(270deg,var(--soft),transparent)}
+.cbt-breadcrumb a{display:inline-flex;align-items:center;min-height:44px;min-width:44px}
+.builder-round-chips button.is-active{background:var(--blue-soft);color:var(--blue-dark);border-color:var(--blue)}
+.custom-builder{align-items:stretch}
+.custom-builder .builder-card{display:flex;flex-direction:column;min-width:0}
+.custom-builder .builder-field-label{margin-top:auto;padding-top:24px}
+.cbt-builder-availability{font-size:12px;color:var(--muted)}
+.mock-subject-list small{font-size:12px;color:#e5e7eb}
+.cbt-guide-content{min-height:390px;display:block}
+.cbt-guide-identity-details{display:grid;gap:12px;margin:20px 0;font-size:14px}
+.cbt-guide-identity-details>div{display:grid;grid-template-columns:100px minmax(0,1fr);gap:12px}
+.cbt-guide-identity-details dt{color:var(--muted)}
+.cbt-guide-identity-details dd{margin:0;font-weight:700}
+.cbt-cert-record{display:grid;grid-template-columns:minmax(0,1fr) auto 140px;gap:16px;align-items:center}
+.cbt-record-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px}
+.cbt-cert-record small{display:block;margin-top:8px;font-size:12px;color:var(--muted)}
+.cbt-cert-record .button{min-height:44px;font-size:12px;padding-inline:12px;white-space:normal}
+.cbt-record-status{min-width:88px;padding:8px 12px;border-radius:999px;background:var(--soft);color:var(--ink);font-size:12px;font-weight:800;text-align:center}
+.cbt-record-status.is-expired{background:var(--warning-soft);color:var(--warning)}
+.cbt-wrong-row{gap:10px}
+.cbt-wrong-row .cbt-row-actions .cbt-note-retry{min-height:44px;padding:0 16px;border:1px solid var(--blue);border-radius:999px;background:#fff;color:var(--blue-dark);font-size:12px;font-weight:800}
+.cbt-wrong-row .cbt-note-menu summary{border:0;background:transparent;color:var(--muted)}
+.cbt-learning-filters select{border-color:#6b7280}
+.cbt-result-next-grid{align-items:start}
+.exam-redesign{--cbt-text:16px;--cbt-meta:12px;--cbt-stem:21px;min-height:100dvh;background:#f4f6fd;padding-bottom:24px}
+.exam-redesign.exam-font-large{--cbt-text:19px;--cbt-meta:14px;--cbt-stem:24px}
+.exam-redesign.exam-font-xlarge{--cbt-text:22px;--cbt-meta:16px;--cbt-stem:27px}
+.exam-redesign .cbt-live-topbar{grid-template-columns:164px minmax(0,1fr) auto auto 44px auto;gap:12px}
+.cbt-exam-identity strong,.cbt-exam-identity small{overflow:visible;white-space:normal;text-overflow:clip}
+.cbt-exam-type{font-size:12px;font-weight:600;color:var(--muted)}
+.cbt-exam-menu-button,.cbt-question-menu-button{width:44px;height:44px;border:1px solid #6b7280;border-radius:14px;background:#fff;color:var(--ink);font-size:22px;cursor:pointer}
+.exam-redesign .exam-submit{height:44px;min-height:44px;padding-block:0}
+.cbt-live-timer strong{font-size:20px}
+.cbt-live-timer.is-warning{background:var(--warning-soft);color:var(--warning)}
+.cbt-live-timer.is-urgent{background:var(--error-soft);color:var(--error);border:1px solid var(--error)}
+.cbt-time-warning{display:flex;align-items:center;justify-content:space-between;gap:12px;width:min(1180px,calc(100% - 40px));margin:12px auto 0;padding:4px 12px;border:1px solid var(--warning);border-radius:14px;background:var(--warning-soft);color:var(--warning);font-size:12px;font-weight:700}
+.cbt-time-warning button{flex:none;width:44px;height:44px;border:0;background:transparent;color:inherit;font-size:22px;cursor:pointer}
+.cbt-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
+.cbt-exam-summary>button{min-height:44px;padding:0 12px;border:1px solid #6b7280;border-radius:999px;background:#fff;color:var(--ink);font-size:var(--cbt-meta);font-weight:750;cursor:pointer}
+.cbt-live-layout.is-b,.cbt-live-layout.is-b.is-focus{max-width:1180px}
+.exam-redesign .cbt-live-question h1{font-size:var(--cbt-stem)}
+.exam-redesign.exam-font-large .cbt-live-question h1,.exam-redesign.exam-font-xlarge .cbt-live-question h1{font-size:var(--cbt-stem)}
+.exam-redesign .cbt-live-question .choice-button,.exam-redesign.exam-font-large .cbt-live-question .choice-button,.exam-redesign.exam-font-xlarge .cbt-live-question .choice-button{font-size:var(--cbt-text)}
+.exam-redesign .cbt-answer-row .cbt-answer-choice{font-size:var(--cbt-text)}
+.exam-redesign .cbt-answer-head p,.exam-redesign .cbt-answer-section h3,.exam-redesign .cbt-answer-section h3 small,.exam-redesign .cbt-answer-legend,.exam-redesign .cbt-subject-chip,.exam-redesign .cbt-question-number span{font-size:var(--cbt-meta)}
+.cbt-answer-scroll,.cbt-number-strip nav{padding:6px;scroll-padding:6px;overscroll-behavior:contain}
+.cbt-answer-row{gap:8px;min-height:48px;padding:2px;margin-block:4px}
+.cbt-answer-choices{gap:8px}
+.cbt-answer-subject-tabs{display:flex;gap:4px;overflow-x:auto;padding:6px;flex-shrink:0;scroll-padding:6px}
+.cbt-answer-subject-tabs button{flex:1;min-width:44px;min-height:44px;padding:4px 6px;border:1px solid #6b7280;border-radius:999px;background:#fff;color:var(--muted);font-size:12px;font-weight:700;cursor:pointer}
+.cbt-answer-subject-tabs button[aria-pressed=true]{border-color:var(--blue);background:var(--blue-soft);color:var(--blue-dark)}
+.cbt-answer-filter{display:flex;justify-content:space-between;gap:8px;margin:0 0 8px}
+.cbt-answer-filter button{min-height:44px;padding:0 8px;border:0;border-radius:14px;background:transparent;color:var(--blue-dark);font-size:12px;cursor:pointer}
+.cbt-answer-filter button[aria-pressed=true]{background:var(--blue-soft);box-shadow:inset 0 0 0 1px var(--blue)}
+.cbt-empty-filter{font-size:12px;color:var(--muted)}
+.cbt-answer-section h3{flex-wrap:wrap}
+.cbt-number-strip nav{overflow-x:auto;scrollbar-width:thin}
+.cbt-live-question .exam-nav{display:flex;align-items:center;justify-content:space-between;gap:8px;position:sticky;bottom:0;margin:24px -25px -25px;padding:16px 25px;border-top:1px solid var(--line);background:#fff;border-radius:0 0 20px 20px}
+.cbt-shortcut-button{min-width:44px;min-height:44px;font-size:12px;padding-inline:12px}
+.cbt-shortcut-popup{max-width:calc(100% - 40px);padding:24px;border:1px solid #6b7280;border-radius:20px;background:#fff;color:var(--ink);box-shadow:var(--shadow)}
+.cbt-shortcut-popup h2{font-size:20px;margin:0 0 12px}
+.cbt-shortcut-popup li{font-size:14px;line-height:1.8}
+.record-row small{font-size:12px}
+.cbt-preview-notice{margin:12px auto;padding:12px;max-width:1180px;border:1px solid var(--warning);border-radius:14px;background:var(--warning-soft);color:var(--warning);font-size:12px}
+.question-bank-tabs button,.cbt-chip-list button,.builder-chip-row button{border-color:#6b7280}
+.cbt-checkbox input:focus-visible{outline:0}
+.cbt-checkbox input:focus-visible+span{outline-color:var(--blue)}
+.cbt-exam-bottom-bar{display:none}
+.cbt-toast{bottom:100px;pointer-events:none;max-width:calc(100% - 40px);text-align:center}
+.cbt-review-modal{width:min(900px,calc(100% - 40px));max-width:900px}
+.cbt-review-modal .cbt-submit-review{width:100%;margin:0;padding:0;border:0}
+.cbt-review-modal .cbt-review-heading h1{font-size:24px}
+.cbt-review-numbers.is-unanswered button{min-width:44px;min-height:44px;border-color:var(--error);background:var(--error-soft);color:var(--error)}
+.cbt-review-actions{position:sticky;bottom:0;background:#fff;padding-top:12px}
+@media(max-width:900px){
+  .exam-redesign .cbt-live-topbar{grid-template-columns:minmax(0,1fr) auto auto 44px auto}
+  .cbt-cert-record{grid-template-columns:minmax(0,1fr) auto;gap:12px}
+  .cbt-cert-record>.button,.cbt-cert-record>.record-unavailable{grid-column:2;grid-row:2;justify-self:end}
+  .cbt-cert-record>.cbt-record-status{grid-column:2;grid-row:1}
+}
+@media(max-width:620px){
+  .exam-redesign{padding-bottom:calc(92px + env(safe-area-inset-bottom))}
+  .exam-redesign .cbt-live-topbar{grid-template-columns:minmax(0,1fr) 44px 44px auto;gap:6px;padding:8px 14px}
+  .cbt-exam-identity{grid-column:1/-1;grid-row:1;gap:4px}
+  .cbt-exam-identity strong{font-size:14px}
+  .cbt-live-timer{grid-column:1;grid-row:2;justify-self:start;min-height:44px;flex-wrap:wrap}
+  .cbt-live-timer strong{font-size:20px}
+  .cbt-live-timer span,.cbt-live-timer small{display:none}
+  .cbt-settings-anchor{grid-column:2;grid-row:2}
+  .cbt-view-button{width:44px;padding:0}
+  .cbt-view-button span{display:none}
+  .cbt-exam-menu-button{grid-column:3;grid-row:2}
+  .exam-redesign .exam-submit{grid-column:4;grid-row:2}
+  .cbt-exam-summary,.cbt-live-layout,.cbt-time-warning{width:calc(100% - 28px)}
+  .cbt-exam-summary{gap:6px}
+  .cbt-exam-summary>button{padding-inline:8px;min-width:44px}
+  .cbt-live-question .exam-nav{display:none}
+  .cbt-mobile-answer-trigger{display:none}
+  .cbt-exam-bottom-bar{position:fixed;inset:auto 0 0;z-index:65;display:grid;grid-template-columns:1fr minmax(0,1.5fr) 1fr;gap:8px;padding:10px 14px calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:#fff}
+  .cbt-exam-bottom-bar button{min-width:44px;min-height:44px;border:1px solid var(--blue);border-radius:999px;background:#fff;color:var(--blue-dark);font-size:12px;font-weight:800;cursor:pointer}
+  .cbt-exam-bottom-bar button:last-child{background:var(--blue);color:#fff}
+  .cbt-exam-bottom-bar button:disabled{background:var(--soft);color:var(--muted);border-color:var(--line);cursor:default}
+  .cbt-live-layout .cbt-answer-sheet.is-open{padding:14px;max-height:88dvh}
+  .cbt-guide-content{min-height:390px}
+  .cbt-review-modal{position:fixed;inset:auto 0 0;width:100%;max-width:100%;max-height:92dvh;margin:0;padding:20px;border-radius:20px 20px 0 0}
+  .cbt-review-grid{grid-template-columns:minmax(0,1fr)}
+  .cbt-review-card{min-width:0}
+  .cbt-review-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
+  .cbt-toast{bottom:calc(86px + env(safe-area-inset-bottom))}
+}
diff --git a/components/auth-nav.tsx b/components/auth-nav.tsx
index 5eba2a1..5a99594 100644
--- a/components/auth-nav.tsx
+++ b/components/auth-nav.tsx
@@ -6,6 +6,7 @@ import { usePathname } from "next/navigation";
 import type { User } from "@supabase/supabase-js";
 import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
 import { readLocalStore, type LocalAttempt } from "@/lib/question-bank";
+import { expiredAttempt } from "@/lib/cbt-presentation";
 
 export function AuthNav({ service = "passmate" }: { service?: "passmate" | "cbt" }) {
   const [user, setUser] = useState<User | null>(null);
@@ -110,11 +111,13 @@ export function AuthNav({ service = "passmate" }: { service?: "passmate" | "cbt"
 
   useEffect(() => {
     if (service !== "cbt") return;
-    const sync = () => setOngoing(readLocalStore().attempts.find((item) => item.status === "in_progress") ?? null);
+    const sync = () => setOngoing(readLocalStore().attempts.filter((item) => item.status === "in_progress" && !expiredAttempt(item)).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0] ?? null);
     sync();
+    const timer = window.setInterval(sync, 1000);
     window.addEventListener("cbt-store", sync);
     window.addEventListener("storage", sync);
     return () => {
+      window.clearInterval(timer);
       window.removeEventListener("cbt-store", sync);
       window.removeEventListener("storage", sync);
     };
@@ -129,7 +132,7 @@ export function AuthNav({ service = "passmate" }: { service?: "passmate" | "cbt"
       <div className="auth-menu" ref={menuRef} onKeyDown={moveMenu} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false); }}>
         <button ref={triggerRef} type="button" className="auth-nav-link auth-menu-trigger" aria-label={user ? "계정 메뉴" : "메뉴"} aria-haspopup="true" aria-expanded={menuOpen} aria-controls="account-menu-panel" onClick={() => setMenuOpen((open) => !open)}><svg className="auth-menu-user-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c0-4 3-6.5 7.5-6.5s7.5 2.5 7.5 6.5" /></svg><span className="auth-menu-label">{user ? "내 계정" : "메뉴"}</span><svg className="auth-menu-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3 6 5 5 5-5" /></svg><span className="auth-menu-icon" aria-hidden="true">☰</span></button>
         <nav id="account-menu-panel" className="auth-menu-panel" aria-label="계정 및 서비스 메뉴" hidden={!menuOpen}>
-          {user && <span className="auth-menu-email">{user.email}</span>}
+          {user && service === "passmate" && <span className="auth-menu-email">{user.email}</span>}
           {service === "cbt" && ongoing && <ResumeLink attempt={ongoing} />}
           <Link className="auth-menu-store-link" href="/products/">요약노트</Link>
           <Link className="auth-menu-store-link" href="/library/">내 자료</Link>
diff --git a/components/cbt-exam-ui.tsx b/components/cbt-exam-ui.tsx
index 0c9cd6f..8889e21 100644
--- a/components/cbt-exam-ui.tsx
+++ b/components/cbt-exam-ui.tsx
@@ -71,13 +71,15 @@ export function ExamViewSettings({ fontSize, choiceLayout, position, onFontSize,
   </div>;
 }
 
-export function MockExamGuide({ name, onStart }: { name: string; onStart: () => void }) {
+export function MockExamGuide({ name, practiceNumber, date, certName, onStart }: { name: string; practiceNumber?: string; date?: string; certName: string; onStart: () => void }) {
   const [step, setStep] = useState(0);
+  const title = useRef<HTMLHeadingElement>(null);
+  useEffect(() => { title.current?.focus({ preventScroll: true }); }, [step]);
   const titles = ["수험자 정보 확인", "안내사항", "유의사항", "화면 사용법"];
   return <div className="cbt-guide">
     <ol className="cbt-guide-steps" aria-label="시험 전 안내 진행">{titles.map((title, index) => <li className={index === step ? "is-current" : index < step ? "is-done" : ""} aria-current={index === step ? "step" : undefined} key={title}><b>{index < step ? "✓" : index + 1}</b><span>{title}</span></li>)}</ol>
-    <div className="cbt-guide-content" aria-live="polite"><span className="eyebrow">{step + 1}/4</span><h3>{titles[step]}</h3>
-      {step === 0 && <><p>표시 이름을 확인해 주세요.</p><div className="cbt-guide-identity"><span>수험자</span><strong>{name}</strong></div><p>응시 번호는 시험을 시작한 뒤 화면 상단에 표시됩니다.</p></>}
+    <div className="cbt-guide-content"><span className="eyebrow">{step + 1}/4</span><h3 ref={title} tabIndex={-1}>{titles[step]}</h3>
+      {step === 0 && <><p>표시 이름을 확인해 주세요.</p><dl className="cbt-guide-identity-details"><div><dt>수험자</dt><dd>{name}</dd></div><div><dt>연습용 번호</dt><dd>{practiceNumber || "–"}</dd></div><div><dt>응시일</dt><dd>{date || "–"}</dd></div><div><dt>종목</dt><dd>{certName}</dd></div><div><dt>시험 구성</dt><dd>60문항 · 60분</dd></div></dl></>}
       {step === 1 && <ul><li>시험 시작을 확정하면 제한시간이 흐릅니다.</li><li>선택한 답안은 자동으로 저장됩니다.</li><li>제출 전에 미응답 문항과 다시 볼 문항을 점검할 수 있습니다.</li></ul>}
       {step === 2 && <><p className="cbt-guide-notice">{CBT_RIGHTS_NOTICE}</p><ul><li>개인 학습용 연습 화면입니다.</li><li>시간이 종료되면 답안을 수정할 수 없으며, 결과 저장은 확인 후 진행됩니다.</li></ul></>}
       {step === 3 && <><div className="cbt-guide-sample" aria-label="화면 사용법 예시"><div><b>1</b> 남은 시간 · 보기 설정 · 제출</div><section><b>2</b> 문제 카드와 보기 선택</section><aside><b>3</b> 답안지 · 번호 이동과 답 선택</aside><footer><b>4</b> 이전 · 다음</footer></div><p>문제 카드와 답안지 양쪽에서 답을 선택할 수 있습니다. 모바일에서는 답안지를 하단 시트로 엽니다.</p></>}
diff --git a/components/question-bank-client.tsx b/components/question-bank-client.tsx
index f93caa9..2124964 100644
--- a/components/question-bank-client.tsx
+++ b/components/question-bank-client.tsx
@@ -5,19 +5,21 @@ import { SiteHeader } from "@/components/site-header";
 import { AnswerChoices, CBT_RIGHTS_NOTICE, ExamViewSettings, MockExamGuide, toggleAnswerSelection } from "@/components/cbt-exam-ui";
 import Link from "next/link";
 import { useRouter } from "next/navigation";
-import { useCallback, useEffect, useMemo, useRef, useState } from "react";
+import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
 import type { User } from "@supabase/supabase-js";
 import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
 import { timeLeftSeconds } from "@/lib/exam-time";
+import { SERVER_EXAMS, cbtPost, serverAttempt } from "@/lib/cbt-server-client";
+import { MOCK_SUBJECTS, attemptLabel, centerInScroller, expiredAttempt, subjectName } from "@/lib/cbt-presentation";
 import {
-  certCategory, certSlug, EMPTY_STORE, findCert, hangulInitials, STORE_KEY,
+  CBT_PREVIEW_READ_ONLY, certCategory, certSlug, EMPTY_STORE, findCert, hangulInitials, STORE_KEY,
   loadPublishedDataset, makeId, mergeAccountStore, readLocalStore, submitIssueReport, syncAccountStore, writeLocalStore,
   type Cert, type Dataset, type GradeMode, type IssueReport, type LocalAttempt,
   type LocalStore, type Question, type QuestionTarget,
 } from "@/lib/question-bank";
 
 type Mode = "home" | "cert" | "exam" | "wrong-notes" | "bookmarks" | "history";
-type ModalName = "menu" | "interim" | "exit" | "submit" | "expired" | null;
+type ModalName = "question-menu" | "menu" | "interim" | "exit" | "submit" | "expired" | null;
 
 function shuffle<T>(items: T[]) { return [...items].sort(() => Math.random() - .5); }
 function formatSeconds(value: number) { const seconds = Math.max(0, value); return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`; }
@@ -31,6 +33,7 @@ export function QuestionBankClient({ mode = "home", certParam = "", attemptId =
   const [dataState, setDataState] = useState<"loading" | "live" | "error">("loading");
   const [user, setUser] = useState<User | null>(null);
   const [authReady, setAuthReady] = useState(false);
+  const [displayName, setDisplayName] = useState("수험자");
   const syncTimer = useRef<number | null>(null);
 
   const retryDataset = useCallback(() => {
@@ -50,20 +53,22 @@ export function QuestionBankClient({ mode = "home", certParam = "", attemptId =
     return () => data.subscription.unsubscribe();
   }, [retryDataset]);
   useEffect(() => { if (!user) return; void mergeAccountStore(readLocalStore()).then((next) => { setStore(next); writeLocalStore(next); }); }, [user]);
+  useEffect(() => { let active = true; setDisplayName("수험자"); if (user) void getSupabaseBrowserClient().from("profiles").select("display_name").eq("id", user.id).maybeSingle().then(({ data }) => { if (active) setDisplayName(data?.display_name?.trim() || "수험자"); }); return () => { active = false; }; }, [user?.id]);
   useEffect(() => { const refresh = (event: StorageEvent) => { if (event.key === STORE_KEY) setStore(readLocalStore()); }; window.addEventListener("storage", refresh); return () => window.removeEventListener("storage", refresh); }, []);
   const saveStore = useCallback((next: LocalStore) => { const current = readLocalStore(); const attempts = next.attempts.map((item) => item.status === "in_progress" ? current.attempts.find((saved) => saved.id === item.id && saved.status === "submitted") || item : item); const safe = { ...next, attempts }; const started = attempts.some((item) => item.status === "in_progress" && !current.attempts.some((saved) => saved.id === item.id)); setStore(safe); writeLocalStore(safe); if (user) { if (syncTimer.current) window.clearTimeout(syncTimer.current); if (started) void syncAccountStore(safe); else syncTimer.current = window.setTimeout(() => void syncAccountStore(safe), 400); } }, [user]);
 
   if (!hydrated || dataState === "loading") return <CbtSkeleton />;
   if (dataState === "error" || !dataset) return <PageShell><div className="cbt-load-error" role="alert"><h1>문제 데이터를 불러오지 못했습니다.</h1><p>잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 알려 주세요.</p><button type="button" className="button button-primary" onClick={retryDataset}>다시 시도</button></div></PageShell>;
   if (mode === "home") return <CbtHome dataset={dataset} />;
-  if (mode === "exam") return <ExamScreen dataset={dataset} store={store} saveStore={saveStore} certParam={certParam} attemptId={attemptId} user={user} />;
+  if (mode === "exam") return <ExamScreen dataset={dataset} store={store} saveStore={saveStore} certParam={certParam} attemptId={attemptId} user={user} displayName={displayName} />;
   if (mode === "wrong-notes" || mode === "bookmarks" || mode === "history") return <LearningScreen mode={mode} dataset={dataset} store={store} saveStore={saveStore} user={user} authReady={authReady} />;
   const cert = findCert(dataset, certParam);
   if (!cert) return <PageShell><EmptyState title="종목을 찾을 수 없습니다." body="종목 선택 화면에서 다시 선택해 주세요." href="/cbt/" action="종목 선택으로" /></PageShell>;
-  return <CertDetail dataset={dataset} cert={cert} store={store} saveStore={saveStore} user={user} />;
+  return <CertDetail dataset={dataset} cert={cert} store={store} saveStore={saveStore} user={user} displayName={displayName} />;
 }
 
-function PageShell({ children }: { children: React.ReactNode }) { return <section className="question-bank-page"><div className="container question-bank-container">{children}</div></section>; }
+function PageShell({ children }: { children: React.ReactNode }) { return <section className="question-bank-page"><div className="container question-bank-container"><CbtPreviewNotice />{children}</div></section>; }
+function CbtPreviewNotice() { return CBT_PREVIEW_READ_ONLY ? <p className="cbt-preview-notice" role="status">현재 Preview에는 테스트 DB가 연결되지 않았습니다. 선택 내용은 이 브라우저에만 저장되며 서버 제출·신고는 비활성 상태입니다.</p> : null; }
 function CbtSkeleton() { return <section className="question-bank-page"><div className="container question-bank-skeleton" aria-label="불러오는 중"><span /><strong /><i /><div><span /><span /></div></div></section>; }
 
 function CbtHome({ dataset }: { dataset: Dataset }) {
@@ -75,48 +80,75 @@ function CbtHome({ dataset }: { dataset: Dataset }) {
   const groups = categories.filter((item) => item !== "전체").map((item) => ({ name: item, certs: filtered.filter((cert) => cert.category === item) })).filter((group) => group.certs.length);
   function chooseCategory(value: string) { setCategory(value); const url = new URL(window.location.href); if (value === "전체") url.searchParams.delete("cat"); else url.searchParams.set("cat", value); window.history.replaceState({}, "", `${url.pathname}${url.search}`); }
   return <PageShell>
-    <div className="question-bank-hero cbt-home-hero"><div><span className="eyebrow">CBT MATE</span><h1>실전처럼 풀고, 약점을 바로 확인하세요.</h1><p>종목을 선택한 뒤 회차별 기출이나 모의고사를 시작하세요.</p></div><span className="question-bank-status">기출 {dataset.questions.length.toLocaleString()}문항</span></div>
+    <div className="question-bank-hero cbt-home-hero"><div><span className="eyebrow">CBT MATE</span><h1>실전처럼 풀고, 약점을 바로 확인하세요.</h1><p>종목을 선택한 뒤 회차별 기출이나 모의시험을 시작하세요.</p></div><span className="question-bank-status">기출 {dataset.questions.length.toLocaleString()}문항</span></div>
     <label className="cbt-search"><span className="cbt-search-icon" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="종목명을 검색하세요 (예: 정보처리기사)" aria-label="종목 검색" /></label>
     {certs.length > 1 && <div className="cbt-category-chips" aria-label="종목 카테고리">{categories.map((item) => <button className={category === item ? "is-active" : ""} onClick={() => chooseCategory(item)} key={item}>{item}</button>)}</div>}
-    {groups.length ? groups.map((group) => <section className="cbt-cert-group" key={group.name}>{certs.length > 1 && <div className="cbt-section-head"><h2>{group.name}</h2><span>{group.certs.length.toLocaleString()}개</span></div>}<div className="cbt-cert-grid">{group.certs.map((cert) => <Link href={`/cbt/${encodeURIComponent(certSlug(cert))}/${builder ? "?tab=builder" : ""}`} className="cbt-cert-card" key={cert.id}>{certs.length > 1 && <small>{cert.category}</small>}<strong>{cert.name}</strong><span>회차 {dataset.exams.filter((exam) => exam.certId === cert.id).length.toLocaleString()}개 · 문제 {dataset.questions.filter((question) => question.certId === cert.id).length.toLocaleString()}문항</span></Link>)}</div></section>) : <EmptyState title="검색 결과가 없습니다." body="다른 종목명이나 카테고리로 찾아보세요." action="검색 초기화" onAction={() => { setQuery(""); chooseCategory("전체"); }} />}
+    {groups.length ? groups.map((group) => <section className="cbt-cert-group" key={group.name}>{certs.length > 1 && <div className="cbt-section-head"><h2>{group.name}</h2><span>{group.certs.length.toLocaleString()}개</span></div>}<div className="cbt-cert-grid">{group.certs.map((cert) => <Link href={`/cbt/${encodeURIComponent(certSlug(cert))}/${builder ? "?tab=custom" : ""}`} className="cbt-cert-card" key={cert.id}>{certs.length > 1 && <small>{cert.category}</small>}<strong>{cert.name}</strong><span>회차 {dataset.exams.filter((exam) => exam.certId === cert.id).length.toLocaleString()}개 · 문제 {dataset.questions.filter((question) => question.certId === cert.id).length.toLocaleString()}문항</span></Link>)}</div></section>) : <EmptyState title="검색 결과가 없습니다." body="다른 종목명이나 카테고리로 찾아보세요." action="검색 초기화" onAction={() => { setQuery(""); chooseCategory("전체"); }} />}
   </PageShell>;
 }
 
-function CertDetail({ dataset, cert, store, saveStore, user }: { dataset: Dataset; cert: Cert; store: LocalStore; saveStore: (store: LocalStore) => void; user: User | null }) {
+function CertDetail({ dataset, cert, store, saveStore, user, displayName }: { dataset: Dataset; cert: Cert; store: LocalStore; saveStore: (store: LocalStore) => void; user: User | null; displayName: string }) {
   const router = useRouter();
   const certExams = useMemo(() => dataset.exams.filter((exam) => exam.certId === cert.id).sort((a, b) => b.year - a.year || b.round.localeCompare(a.round)), [dataset, cert]);
   const subjects = useMemo(() => dataset.subjects.filter((subject) => subject.certId === cert.id), [dataset, cert]);
   const years = Array.from(new Set(certExams.map((exam) => exam.year))).sort((a, b) => b - a);
-  const [tab, setTabState] = useState<"exams" | "subjects" | "mock" | "builder" | "records">("exams"); const [year, setYear] = useState(years[0] || 0);
+  const [tab, setTabState] = useState<"exams" | "subjects" | "mock" | "custom" | "records">("exams"); const [year, setYear] = useState(years[0] || 0);
+  const tabsRef = useRef<HTMLDivElement>(null);
   const [selectedExamId, setSelectedExamId] = useState(certExams[0]?.id || ""); const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]); const [selectedExamIds, setSelectedExamIds] = useState(certExams.map((exam) => exam.id));
   const [yearExpanded, setYearExpanded] = useState(false); const [startExamId, setStartExamId] = useState(""); const [gradeMode, setGradeMode] = useState<GradeMode>("submit");
   const [count] = useState(60); const [order, setOrder] = useState<"ordered" | "random">("random"); const [target, setTarget] = useState<QuestionTarget>("all"); const [timeLimit, setTimeLimit] = useState<number | null>(60); const [toast, setToast] = useState("");
   const [builderCounts, setBuilderCounts] = useState<Record<string, number>>(() => Object.fromEntries(subjects.map((subject) => [subject.id, 20])));
   const [showGuide, setShowGuide] = useState(false);
   const [guideOpen, setGuideOpen] = useState(false);
-  const displayName = typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "수험자";
-  useEffect(() => { const value = new URLSearchParams(window.location.search).get("tab"); if (value === "subjects" || value === "mock" || value === "builder" || value === "records") setTabState(value); }, []);
+  const [identity, setIdentity] = useState<{ practiceNumber: string; displayName: string; date: string } | null>(null);
+  const [starting, setStarting] = useState(false);
+  useEffect(() => { const value = new URLSearchParams(window.location.search).get("tab"); if (value === "builder") setTab("custom"); else if (value === "subjects" || value === "mock" || value === "custom" || value === "records") setTabState(value); }, []);
+  useEffect(() => {
+    const container = tabsRef.current;
+    const reveal = () => { const active = container?.querySelector<HTMLElement>('[aria-selected="true"]'); if (container && active) centerInScroller(active, container); };
+    reveal();
+    if (!container) return;
+    const observer = new ResizeObserver(reveal);
+    observer.observe(container);
+    return () => observer.disconnect();
+  }, [tab]);
   function setTab(value: typeof tab) { setTabState(value); const url = new URL(window.location.href); if (value === "exams") url.searchParams.delete("tab"); else url.searchParams.set("tab", value); window.history.replaceState({}, "", `${url.pathname}${url.search}`); }
-  function begin(questionIds: string[], examIds: string[], mode: GradeMode, minutes: number | null, exact = false, subjectIds = selectedSubjects) { const ids = exact ? questionIds : order === "random" ? shuffle(questionIds).slice(0, count) : questionIds.slice(0, count); if (!ids.length) { setToast("선택한 범위에 출제 가능한 문제가 없습니다."); return; } const id = makeId("attempt"); const now = new Date(); const attempt: LocalAttempt = { id, config: { certId: cert.id, certSlug: certSlug(cert), examIds, subjectIds, count: ids.length, order: exact ? "ordered" : order, target, gradeMode: mode, timeLimitMinutes: minutes }, questionIds: ids, answers: {}, lockedIds: [], startedAt: now.toISOString(), endAt: minutes ? new Date(now.getTime() + minutes * 60000).toISOString() : null, status: "in_progress" }; saveStore({ ...store, attempts: [attempt, ...store.attempts] }); router.push(`/cbt/${encodeURIComponent(certSlug(cert))}/exam/${id}/`); }
+  async function begin(questionIds: string[], examIds: string[], mode: GradeMode, minutes: number | null, exact = false, subjectIds = selectedSubjects) { const ids = exact ? questionIds : order === "random" ? shuffle(questionIds).slice(0, count) : questionIds.slice(0, count); if (!ids.length) { setToast("선택한 범위에 출제 가능한 문제가 없습니다."); return; } if (SERVER_EXAMS) {
+    setStarting(true);
+    try { const row = await cbtPost<Parameters<typeof serverAttempt>[0]>("/api/cbt/attempts/start/", { certId: cert.id, mode: tab === "custom" ? "custom" : tab === "subjects" ? "subject" : "past", questionIds: ids, minutes, gradeMode: mode }); const attempt = serverAttempt(row); const latest = readLocalStore(); saveStore({ ...latest, attempts: [attempt, ...latest.attempts] }); router.push(`/cbt/${encodeURIComponent(certSlug(cert))}/exam/${attempt.id}/`); } catch (error) { setToast(error instanceof Error ? error.message : "시험을 시작하지 못했습니다."); } finally { setStarting(false); } return;
+  } const id = makeId("attempt"); const now = new Date(); const attempt: LocalAttempt = { id, config: { mode: tab === "custom" ? "custom" : tab === "subjects" ? "subject" : "past", certId: cert.id, certSlug: certSlug(cert), examIds, subjectIds, count: ids.length, order: exact ? "ordered" : order, target, gradeMode: mode, timeLimitMinutes: minutes }, questionIds: ids, answers: {}, lockedIds: [], startedAt: now.toISOString(), endAt: minutes ? new Date(now.getTime() + minutes * 60000).toISOString() : null, status: "in_progress" }; saveStore({ ...store, attempts: [attempt, ...store.attempts] }); router.push(`/cbt/${encodeURIComponent(certSlug(cert))}/exam/${id}/`); }
   function beginBuilder() { const scopedSubjects = selectedSubjects.length ? selectedSubjects : subjects.map((subject) => subject.id); const ids = scopedSubjects.flatMap((subjectId) => { const available = pool.filter((question) => question.subjectId === subjectId); const ordered = order === "random" ? shuffle(available) : available.sort((a, b) => a.no - b.no); return ordered.slice(0, Math.max(0, builderCounts[subjectId] || 0)).map((question) => question.id); }); begin(ids, selectedExamIds, gradeMode, timeLimit, true); }
   function beginExam() { const exam = certExams.find((item) => item.id === startExamId); if (exam) begin(dataset.questions.filter((question) => question.examId === exam.id).sort((a, b) => a.no - b.no).map((question) => question.id), [exam.id], gradeMode, exam.durationMinutes, true); }
-  function beginMock() { const available = dataset.questions.filter((question) => question.certId === cert.id); begin(shuffle(available).slice(0, Math.min(60, available.length)).map((question) => question.id), certExams.map((exam) => exam.id), "submit", 60, true, []); }
+  const mockAvailable = MOCK_SUBJECTS.every((rule) => { const matched = subjects.filter((subject) => subject.name === rule.internal || subject.name === rule.name); return matched.length === 1 && dataset.questions.filter((question) => question.subjectId === matched[0].id && question.choices.length === 4 && question.answer >= 0 && question.answer <= 3).length >= 20; });
+  async function prepareMock() {
+    if (!mockAvailable || starting) return;
+    setStarting(true);
+    try { const prepared = await cbtPost<{ practiceNumber: string; displayName: string; date: string }>("/api/cbt/identity/"); setIdentity(prepared); if (showGuide) setGuideOpen(true); else setStartExamId("__mock__"); }
+    catch (error) { setToast(error instanceof Error ? error.message : "시험 정보를 준비하지 못했습니다."); } finally { setStarting(false); }
+  }
+  async function beginMock() {
+    if (starting) return; setStarting(true);
+    try { const row = await cbtPost<Parameters<typeof serverAttempt>[0]>("/api/cbt/attempts/start/", { certId: cert.id, mode: "mock", questionIds: [], minutes: 60, gradeMode: "submit" }); const attempt = serverAttempt(row); const latest = readLocalStore(); saveStore({ ...latest, attempts: [attempt, ...latest.attempts] }); router.push(`/cbt/${encodeURIComponent(certSlug(cert))}/exam/${attempt.id}/`); }
+    catch (error) { setToast(error instanceof Error ? error.message : "시험을 시작하지 못했습니다."); } finally { setStarting(false); }
+  }
   const allBuilderQuestions = dataset.questions.filter((question) => question.certId === cert.id && selectedExamIds.includes(question.examId) && (!selectedSubjects.length || selectedSubjects.includes(question.subjectId)));
   const attempted = new Set(store.attempts.flatMap((attempt) => Object.keys(attempt.answers)));
   const pool = allBuilderQuestions.filter((question) => target === "all" || (target === "unanswered" && !attempted.has(question.id)) || (target === "wrong" && !!store.wrongNotes[question.id]) || (target === "bookmark" && store.bookmarks.includes(question.id)));
   const shownYears = yearExpanded ? years : years.slice(0, 6); const rounds = certExams.filter((exam) => exam.year === year); const selectedExam = certExams.find((exam) => exam.id === selectedExamId);
-  const mockExam = { id: "__mock__", certId: cert.id, year: new Date().getFullYear(), round: "모의시험", title: `${cert.name} 모의시험`, durationMinutes: 60, passScore: 60, questionCount: Math.min(60, dataset.questions.filter((question) => question.certId === cert.id).length) };
+  const mockExam = { id: "__mock__", certId: cert.id, year: new Date().getFullYear(), round: "모의시험", title: `${cert.name} 모의시험`, durationMinutes: 60, passScore: 60, questionCount: 60 };
   return <PageShell>
     <nav className="cbt-breadcrumb" aria-label="현재 위치"><Link href="/cbt/">CBT MATE</Link><span>›</span><Link href={`/cbt/?cat=${encodeURIComponent(cert.category || certCategory(cert.name))}`}>{cert.category || certCategory(cert.name)}</Link><span>›</span><b>{cert.name}</b></nav>
     <div className="question-bank-hero"><div><span className="eyebrow">시험 준비</span><h1>{cert.name}</h1><p>원하는 방식으로 문제를 풀고 학습 기록을 이어가세요.</p></div></div>
-    <div className="question-bank-tabs" role="tablist" aria-label="학습 방식" onKeyDown={(event) => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')); const index = tabs.indexOf(event.target as HTMLButtonElement); const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length; tabs[next]?.click(); tabs[next]?.focus(); tabs[next]?.scrollIntoView({ block: "nearest", inline: "nearest" }); }}>{([['exams','회차별 기출'],['subjects','단원별'],['mock','모의시험'],['builder','맞춤 시험지'],['records','내 기록']] as const).map(([value, label]) => <button type="button" role="tab" aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} className={tab === value ? "is-active" : ""} onClick={() => setTab(value)} key={value}>{label}</button>)}</div>
+    <div className="cbt-detail-tabs-wrap"><div ref={tabsRef} className="question-bank-tabs" role="tablist" aria-label="학습 방식" onKeyDown={(event) => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')); const index = tabs.indexOf(event.target as HTMLButtonElement); const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length; tabs[next]?.click(); tabs[next]?.focus({ preventScroll: true }); if (tabs[next]) centerInScroller(tabs[next], event.currentTarget); }}>{([['exams','회차별 기출'],['subjects','단원별'],['mock','모의시험'],['custom','맞춤 시험지'],['records','이 종목 기록']] as const).map(([value, label]) => <button type="button" role="tab" id={`cbt-tab-${value}`} aria-controls="cbt-detail-panel" aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} className={tab === value ? "is-active" : ""} onClick={() => setTab(value)} key={value}>{label}</button>)}</div></div>
+    <div role="tabpanel" id="cbt-detail-panel" aria-labelledby={`cbt-tab-${tab}`}>
     {tab === "exams" && <div className="question-bank-grid"><section className="question-library-card"><CardHead no="01" title="연도와 회차 선택" desc="시험을 시작할 회차를 골라주세요." /><h3 className="cbt-field-label">연도 선택</h3><div className="cbt-chip-list">{shownYears.map((item) => <button type="button" className={year === item ? "is-active" : ""} aria-pressed={year === item} onClick={() => { setYear(item); setSelectedExamId(certExams.find((exam) => exam.year === item)?.id || ""); }} key={item}>{item}년</button>)}</div>{years.length > 6 && <button className="cbt-more" onClick={() => setYearExpanded(!yearExpanded)}>{yearExpanded ? "접기" : "더 보기"}</button>}<h3 className="cbt-field-label">회차 선택</h3><div className="cbt-chip-list">{rounds.map((exam) => <button type="button" className={selectedExamId === exam.id ? "is-active" : ""} aria-pressed={selectedExamId === exam.id} onClick={() => setSelectedExamId(exam.id)} key={exam.id}>{exam.round}</button>)}</div></section><aside className="question-selection-panel"><span className="eyebrow">선택한 시험</span>{selectedExam ? <><h2>{cert.name} {selectedExam.year}년 {selectedExam.round}</h2><p>시작 전 문항 수와 채점 방식을 확인합니다.</p><div className="question-selection-actions"><button className="button button-primary" onClick={() => setStartExamId(selectedExam.id)}>시험 시작</button></div></> : <EmptyState title="회차를 선택해 주세요." body="왼쪽에서 연도와 회차를 차례로 선택하면 시작할 수 있습니다." />}</aside></div>}
     {tab === "subjects" && <div className="question-bank-grid"><section className="question-library-card cbt-subject-card"><CardHead no="02" title="단원 선택" desc="풀고 싶은 단원을 1개 이상 선택하세요." /><div className="cbt-select-all"><button onClick={() => setSelectedSubjects(selectedSubjects.length === subjects.length ? [] : subjects.map((subject) => subject.id))}>{selectedSubjects.length === subjects.length ? "전체 해제" : "전체 선택"}</button><span>{selectedSubjects.length.toLocaleString()}개 선택</span></div><div className="cbt-subject-list">{subjects.map((subject) => { const checked = selectedSubjects.includes(subject.id); const total = dataset.questions.filter((question) => question.subjectId === subject.id).length; return <label className={`cbt-subject-row${checked ? " is-selected" : ""}`} key={subject.id}><CustomCheckbox checked={checked} onChange={() => setSelectedSubjects(checked ? selectedSubjects.filter((id) => id !== subject.id) : [...selectedSubjects, subject.id])} /><strong>{subject.name}</strong><small>{total.toLocaleString()}문항</small></label>; })}</div></section><aside className="question-selection-panel"><span className="eyebrow">단원 연습</span><h2>선택한 단원으로 연습</h2><p>여러 단원을 묶어 한 번에 풀 수 있습니다.</p><div className="question-selection-actions"><button className="button button-primary" disabled={!selectedSubjects.length} onClick={() => begin(dataset.questions.filter((question) => selectedSubjects.includes(question.subjectId)).map((question) => question.id), certExams.map((exam) => exam.id), "submit", null)}>시험 시작</button>{!selectedSubjects.length && <small className="cbt-guidance">단원을 1개 이상 선택해 주세요.</small>}</div></aside></div>}
-    {tab === "builder" && <div className="question-builder-grid custom-builder"><section className="builder-card"><div className="custom-builder-heading"><div><span className="eyebrow">맞춤 출제</span><h2>맞춤 시험지</h2><p>원하는 범위와 문항 수로 시험지를 구성해 보세요.</p></div><span className="builder-limit-chip">최대 120문항</span></div><fieldset className="cbt-builder-group"><legend>회차 선택</legend><div className="builder-chip-row">{certExams.map((exam) => <button type="button" className={selectedExamIds.includes(exam.id) ? "is-active" : ""} aria-pressed={selectedExamIds.includes(exam.id)} onClick={() => setSelectedExamIds(selectedExamIds.includes(exam.id) ? selectedExamIds.filter((id) => id !== exam.id) : [...selectedExamIds, exam.id])} key={exam.id}>{exam.year}년 {exam.round}</button>)}</div></fieldset><fieldset className="cbt-builder-group"><legend>출제 대상</legend><div className="builder-chip-row">{([['all','전체'],['unanswered','안 푼 문제'],['wrong','틀렸던 문제'],['bookmark','북마크']] as const).map(([value, label]) => <button type="button" className={target === value ? "is-active" : ""} aria-pressed={target === value} onClick={() => setTarget(value)} key={value}>{label}</button>)}</div></fieldset><label className="builder-field-label">문제 순서<select value={order} onChange={(event) => setOrder(event.target.value as typeof order)}><option value="random">섞어서</option><option value="ordered">회차순</option></select></label></section><aside className="builder-summary-card custom-builder-summary"><span className="eyebrow">시험지 구성</span><h2>문항 수와 진행 방식</h2><div className="builder-subject-counts">{subjects.map((subject) => <div className="builder-subject-count" key={subject.id}><div><label htmlFor={`builder-count-${subject.id}`}>{subject.name}</label><small>가용 {dataset.questions.filter((question) => question.subjectId === subject.id).length.toLocaleString()}문항</small></div><QuestionCountInput id={`builder-count-${subject.id}`} label={subject.name} value={builderCounts[subject.id] ?? 0} onChange={(value) => setBuilderCounts((counts) => ({ ...counts, [subject.id]: value }))} /></div>)}</div><div className="builder-total"><span>총 문항 수</span><strong>{Object.values(builderCounts).reduce((sum, value) => sum + value, 0)}문항</strong></div>{Object.values(builderCounts).reduce((sum, value) => sum + value, 0) > 120 && <p className="builder-warning" role="alert">120문항을 넘었습니다. 한 문제씩 학습 모드로 풀어 보세요.</p>}<div className="builder-summary-fields"><label>제한시간<select value={timeLimit === null ? "none" : timeLimit} onChange={(event) => setTimeLimit(event.target.value === "none" ? null : Number(event.target.value))}><option value="60">60분</option><option value="30">30분</option><option value="90">90분</option><option value="none">제한 없음</option></select></label><label>채점 방식<select value={gradeMode} onChange={(event) => setGradeMode(event.target.value as GradeMode)}><option value="submit">제출 후 채점</option><option value="instant">즉시 채점</option></select></label></div><div className="builder-action-row"><button className="button button-primary" disabled={!selectedExamIds.length || !pool.length || Object.values(builderCounts).reduce((sum, value) => sum + value, 0) < 1 || Object.values(builderCounts).reduce((sum, value) => sum + value, 0) > 120} onClick={beginBuilder}>시험지 시작</button>{user && <button className="button button-secondary" onClick={() => { const builderTotal = Object.values(builderCounts).reduce((sum, value) => sum + value, 0); const config = { certId: cert.id, certSlug: certSlug(cert), examIds: selectedExamIds, subjectIds: selectedSubjects, count: builderTotal, order, target, gradeMode, timeLimitMinutes: timeLimit }; saveStore({ ...store, presets: [...store.presets, { name: `${cert.name} 맞춤 시험지`, config }] }); setToast("맞춤 시험지를 저장했습니다."); }}>시험지 저장</button>}</div></aside></div>}
-    {tab === "mock" && <div className="mock-exam-layout"><section className="mock-exam-card mock-preflight"><span className="eyebrow">실전 연습 · 모의시험 구성</span><h2>{cert.name}</h2><strong className="mock-preflight-total">{mockExam.questionCount}문항 · {mockExam.durationMinutes}분</strong><p>100점 만점 · 합격 기준 {mockExam.passScore}점 이상</p><div className="mock-subject-list">{subjects.map((subject) => <div key={subject.id}><span>{subject.name}</span><strong>{dataset.questions.filter((question) => question.subjectId === subject.id).length.toLocaleString()}문항 풀</strong></div>)}</div><p className="mock-exam-note">과목별 문항 수는 전체 문제 풀에서 무작위 출제한 결과에 따라 달라집니다.</p><div className="mock-candidate"><span>수험자 <b>{displayName}</b></span><span>응시 번호는 시작 후 표시됩니다.</span></div></section><aside className="mock-exam-start"><span className="eyebrow">시험 준비</span><h2>준비되셨나요?</h2><p>시작하면 제한시간이 흐릅니다. 시험 중 답안은 자동 저장됩니다.</p><p className="mock-rights">{CBT_RIGHTS_NOTICE}</p><details className="mock-rights-details"><summary>자세히</summary><p>문제와 해설을 허락 없이 복제하거나 다른 곳에 배포하지 마세요.</p></details><label className="mock-guide-toggle"><input type="checkbox" checked={showGuide} onChange={(event) => setShowGuide(event.target.checked)} />시험 전 안내 보기</label><button className="button button-primary" disabled={!mockExam.questionCount} onClick={() => showGuide ? setGuideOpen(true) : setStartExamId("__mock__")}>{showGuide ? "안내 보기 →" : "시험 시작"}</button><small>전체 {dataset.questions.filter((question) => question.certId === cert.id).length.toLocaleString()}문항에서 무작위 출제 · 개인 학습용 연습</small></aside></div>}
+    {tab === "custom" && <div className="question-builder-grid custom-builder"><section className="builder-card"><div className="custom-builder-heading"><div><span className="eyebrow">맞춤 출제</span><h2>맞춤 시험지</h2><p>원하는 범위와 문항 수로 시험지를 구성해 보세요.</p></div><span className="builder-limit-chip">최대 120문항</span></div><fieldset className="cbt-builder-group"><legend>회차 선택</legend><div className="cbt-select-all"><button type="button" onClick={() => setSelectedExamIds(selectedExamIds.length === certExams.length ? [] : certExams.map((exam) => exam.id))}>{selectedExamIds.length === certExams.length ? "전체 해제" : "전체 선택"}</button><button type="button" onClick={() => setSelectedExamIds(certExams.slice(0, 5).map((exam) => exam.id))}>최근 5회만</button><span>{selectedExamIds.length}/{certExams.length}회차 선택</span></div><div className="builder-chip-row builder-round-chips">{certExams.map((exam) => <button type="button" className={selectedExamIds.includes(exam.id) ? "is-active" : ""} aria-pressed={selectedExamIds.includes(exam.id)} onClick={() => setSelectedExamIds(selectedExamIds.includes(exam.id) ? selectedExamIds.filter((id) => id !== exam.id) : [...selectedExamIds, exam.id])} key={exam.id}>{selectedExamIds.includes(exam.id) && "✓ "}{exam.year}년 {exam.round}</button>)}</div><p className="cbt-builder-availability">선택 범위에서 가용 {pool.length.toLocaleString()}문항</p></fieldset><fieldset className="cbt-builder-group"><legend>출제 대상</legend><div className="builder-chip-row">{([['all','전체'],['unanswered','안 푼 문제'],['wrong','틀렸던 문제'],['bookmark','북마크']] as const).map(([value, label]) => <button type="button" className={target === value ? "is-active" : ""} aria-pressed={target === value} onClick={() => setTarget(value)} key={value}>{label}</button>)}</div></fieldset><label className="builder-field-label">문제 순서<select value={order} onChange={(event) => setOrder(event.target.value as typeof order)}><option value="random">섞어서</option><option value="ordered">회차순</option></select></label></section><aside className="builder-summary-card custom-builder-summary"><span className="eyebrow">시험지 구성</span><h2>문항 수와 진행 방식</h2><div className="builder-subject-counts">{subjects.map((subject) => <div className="builder-subject-count" key={subject.id}><div><label htmlFor={`builder-count-${subject.id}`}>{subject.name}</label><small>가용 {pool.filter((question) => question.subjectId === subject.id).length.toLocaleString()}문항</small></div><QuestionCountInput id={`builder-count-${subject.id}`} label={subject.name} value={builderCounts[subject.id] ?? 0} onChange={(value) => setBuilderCounts((counts) => ({ ...counts, [subject.id]: value }))} /></div>)}</div><div className="builder-total"><span>총 문항 수</span><strong>{Object.values(builderCounts).reduce((sum, value) => sum + value, 0)}문항</strong></div>{Object.values(builderCounts).reduce((sum, value) => sum + value, 0) > 120 && <p className="builder-warning" role="alert">120문항을 넘었습니다. 한 문제씩 학습 모드로 풀어 보세요.</p>}<div className="builder-summary-fields"><label>제한시간<select value={timeLimit === null ? "none" : timeLimit} onChange={(event) => setTimeLimit(event.target.value === "none" ? null : Number(event.target.value))}><option value="60">60분</option><option value="30">30분</option><option value="90">90분</option><option value="none">제한 없음</option></select></label><label>채점 방식<select value={gradeMode} onChange={(event) => setGradeMode(event.target.value as GradeMode)}><option value="submit">제출 후 채점</option><option value="instant">즉시 채점</option></select></label></div><div className="builder-action-row"><button className="button button-primary" disabled={!selectedExamIds.length || !pool.length || Object.values(builderCounts).reduce((sum, value) => sum + value, 0) < 1 || Object.values(builderCounts).reduce((sum, value) => sum + value, 0) > 120} onClick={beginBuilder}>시험지 시작</button>{user && <button className="button button-secondary" onClick={() => { const builderTotal = Object.values(builderCounts).reduce((sum, value) => sum + value, 0); const config = { certId: cert.id, certSlug: certSlug(cert), examIds: selectedExamIds, subjectIds: selectedSubjects, count: builderTotal, order, target, gradeMode, timeLimitMinutes: timeLimit }; saveStore({ ...store, presets: [...store.presets, { name: `${cert.name} 맞춤 시험지`, config }] }); setToast("맞춤 시험지를 저장했습니다."); }}>시험지 저장</button>}</div></aside></div>}
+    {tab === "mock" && <div className="mock-exam-layout"><section className="mock-exam-card mock-preflight"><span className="eyebrow">실전 연습 · 모의시험 구성</span><h2>{cert.name}</h2><strong className="mock-preflight-total">{mockExam.questionCount}문항 · {mockExam.durationMinutes}분</strong><p>100점 만점 · 합격 기준 {mockExam.passScore}점 이상</p><div className="mock-subject-list">{MOCK_SUBJECTS.map((subject, index) => <div key={subject.name}><span>{subject.name} <small>{index * 20 + 1}–{(index + 1) * 20}</small></span><strong>20문항</strong></div>)}</div><p className="mock-exam-note">과목별 20문항 · 총 60문항</p><div className="mock-candidate"><span>수험자 <b>{displayName}</b></span><span>연습용 번호 {identity?.practiceNumber || "–"}</span></div></section><aside className="mock-exam-start"><span className="eyebrow">시험 준비</span><h2>준비되셨나요?</h2><p>시작하면 제한시간이 흐릅니다. 시험 중 답안은 자동 저장됩니다.</p><p className="mock-rights">{CBT_RIGHTS_NOTICE}</p><details className="mock-rights-details"><summary>자세히</summary><p>문제와 해설을 허락 없이 복제하거나 다른 곳에 배포하지 마세요.</p></details><label className="mock-guide-toggle"><input type="checkbox" checked={showGuide} onChange={(event) => setShowGuide(event.target.checked)} />시험 전 안내 보기</label><button className="button button-primary" disabled={!SERVER_EXAMS || !mockAvailable || starting || !user} onClick={prepareMock}>{showGuide ? "안내 보기 →" : "시험 시작"}</button><small>{!SERVER_EXAMS ? "별도 테스트 DB 연결 후 시작할 수 있습니다." : !user ? "로그인 후 시작할 수 있습니다." : !mockAvailable ? "과목별 가용 문항이 20개 이상이어야 합니다." : "모든 회차에서 과목별 무작위 출제 · 개인 학습용 연습"}</small></aside></div>}
     {tab === "records" && <Records cert={cert} dataset={dataset} store={store} />}
-    {startExamId && <StartModal exam={startExamId === "__mock__" ? mockExam : certExams.find((exam) => exam.id === startExamId)!} gradeMode={gradeMode} setGradeMode={setGradeMode} onClose={() => setStartExamId("")} onStart={startExamId === "__mock__" ? beginMock : beginExam} />}
-    {guideOpen && <Modal title="시험 전 안내" onClose={() => setGuideOpen(false)}><MockExamGuide name={displayName} onStart={() => { setGuideOpen(false); setStartExamId("__mock__"); }} /></Modal>}
+    </div>
+    {startExamId && <StartModal exam={startExamId === "__mock__" ? mockExam : certExams.find((exam) => exam.id === startExamId)!} gradeMode={gradeMode} setGradeMode={setGradeMode} onClose={() => setStartExamId("")} busy={starting} onStart={startExamId === "__mock__" ? beginMock : beginExam} />}
+    {guideOpen && <Modal title="시험 전 안내" onClose={() => setGuideOpen(false)}><MockExamGuide name={identity?.displayName || displayName} practiceNumber={identity?.practiceNumber} date={identity?.date} certName={cert.name} onStart={() => { setGuideOpen(false); setStartExamId("__mock__"); }} /></Modal>}
     <Toast message={toast} onDone={() => setToast("")} />
   </PageShell>;
 }
@@ -129,19 +161,31 @@ function QuestionCountInput({ id, label, value, onChange }: { id: string; label:
   </div>;
 }
 
-function StartModal({ exam, gradeMode, setGradeMode, onClose, onStart }: { exam: Dataset["exams"][number]; gradeMode: GradeMode; setGradeMode: (mode: GradeMode) => void; onClose: () => void; onStart: () => void }) { return <Modal title="지금 시험을 시작할까요?" onClose={onClose}><p>{exam.questionCount.toLocaleString()}문항 · {exam.durationMinutes.toLocaleString()}분</p><p>시작하면 제한시간이 흐릅니다.</p>{exam.id !== "__mock__" && <fieldset className="cbt-mode-options"><legend>채점 방식 선택</legend><label><input type="radio" name="grade-mode" checked={gradeMode === "submit"} onChange={() => setGradeMode("submit")} />한번에 채점</label><label><input type="radio" name="grade-mode" checked={gradeMode === "instant"} onChange={() => setGradeMode("instant")} />즉시 채점</label></fieldset>}<div className="cbt-modal-actions"><button className="button button-ghost" onClick={onClose}>취소</button><button className="button button-primary" onClick={onStart}>시작 확정</button></div></Modal>; }
+function StartModal({ exam, gradeMode, setGradeMode, onClose, onStart, busy = false }: { busy?: boolean; exam: Dataset["exams"][number]; gradeMode: GradeMode; setGradeMode: (mode: GradeMode) => void; onClose: () => void; onStart: () => void }) { return <Modal title="지금 시험을 시작할까요?" onClose={onClose}><p>{exam.questionCount.toLocaleString()}문항 · {exam.durationMinutes.toLocaleString()}분</p><p>시작하면 제한시간이 흐릅니다.</p>{exam.id !== "__mock__" && <fieldset className="cbt-mode-options"><legend>채점 방식 선택</legend><label><input type="radio" name="grade-mode" checked={gradeMode === "submit"} onChange={() => setGradeMode("submit")} />한번에 채점</label><label><input type="radio" name="grade-mode" checked={gradeMode === "instant"} onChange={() => setGradeMode("instant")} />즉시 채점</label></fieldset>}<div className="cbt-modal-actions"><button className="button button-ghost" onClick={onClose}>취소</button><button className="button button-primary" disabled={busy} onClick={onStart}>{busy ? "준비 중…" : "시작 확정"}</button></div></Modal>; }
 
-function ExamScreen({ dataset, store, saveStore, certParam, attemptId, user }: { dataset: Dataset; store: LocalStore; saveStore: (store: LocalStore) => void; certParam: string; attemptId: string; user: User | null }) {
+function ExamScreen({ dataset, store, saveStore, certParam, attemptId, user, displayName: accountName }: { dataset: Dataset; store: LocalStore; saveStore: (store: LocalStore) => void; certParam: string; attemptId: string; user: User | null; displayName: string }) {
   const router = useRouter(); const attempt = store.attempts.find((item) => item.id === attemptId); const cert = findCert(dataset, certParam) || dataset.certs.find((item) => item.id === attempt?.config.certId);
   const questions = attempt?.questionIds.map((id) => dataset.questions.find((question) => question.id === id)).filter((item): item is Question => !!item) || [];
   const [selected, setSelected] = useState(0); const [secondsLeft, setSecondsLeft] = useState<number | null>(null); const [modal, setModal] = useState<ModalName>(null); const [toast, setToast] = useState(""); const [submitting, setSubmitting] = useState(false); const [reportQuestion, setReportQuestion] = useState<Question | null>(null); const [reshuffle, setReshuffle] = useState(false); const [layoutMode, setLayoutMode] = useState<"a" | "b">("a"); const [fontSize, setFontSize] = useState<"base" | "large" | "xlarge">("base"); const [choiceLayout, setChoiceLayout] = useState<"one" | "two" | "focus">("one"); const [sheetOpen, setSheetOpen] = useState(false); const [reviewOpen, setReviewOpen] = useState(false); const finishedIds = useRef(new Set<string>()); const sheetOpener = useRef<HTMLElement | null>(null); const warned = useRef(false); const question = questions[selected];
+  const [sheetFilter, setSheetFilter] = useState<"all" | "answered" | "unanswered" | "review">("all");
+  const [sheetSubject, setSheetSubject] = useState<string | null>(null);
+  const [warningDismissed, setWarningDismissed] = useState(false);
+  const [timeAnnouncement, setTimeAnnouncement] = useState("");
+  const announced = useRef(new Set<number>());
+  const pendingAnswers = useRef<Promise<void>>(Promise.resolve());
+  const confirmedExit = useRef(false);
+  const [savingAnswer, setSavingAnswer] = useState(false);
+  const [shortcutsOpen, setShortcutsOpen] = useState(false);
+  useEffect(() => { setSelected(0); setSheetSubject(null); setWarningDismissed(false); announced.current.clear(); warned.current = false; }, [attemptId]);
+  useEffect(() => { if (secondsLeft === null || !attempt?.endAt || secondsLeft <= 0) return; const threshold = secondsLeft <= 300 ? 5 : secondsLeft <= 600 ? 10 : null; if (threshold && !announced.current.has(threshold)) { announced.current.add(threshold); setTimeAnnouncement(`${threshold}분 남았습니다. 미응답 문항을 점검하세요.`); } }, [secondsLeft, attempt?.endAt]);
   useEffect(() => { if (!sheetOpen) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSheetOpen(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [sheetOpen]);
   useEffect(() => { if (!sheetOpen) { sheetOpener.current?.focus(); sheetOpener.current = null; return; } const sheet = document.querySelector<HTMLElement>(".cbt-answer-sheet.is-open"); sheet?.querySelector<HTMLElement>(".cbt-answer-close")?.focus(); const trap = (event: KeyboardEvent) => { if (event.key !== "Tab" || !sheet) return; const buttons = Array.from(sheet.querySelectorAll<HTMLButtonElement>('button:not(:disabled):not([tabindex="-1"])')); const first = buttons[0]; const last = buttons.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }; window.addEventListener("keydown", trap); return () => window.removeEventListener("keydown", trap); }, [sheetOpen]);
   useEffect(() => { document.body.classList.toggle("cbt-exam-active", attempt?.status === "in_progress"); return () => document.body.classList.remove("cbt-exam-active"); }, [attempt?.status]);
   useEffect(() => { try { const saved = localStorage.getItem("cbt-answer-position"); if (saved === "a" || saved === "b") setLayoutMode(saved); } catch { /* Storage can be disabled. */ } }, []);
   function setAnswerPosition(position: "a" | "b") { setLayoutMode(position); setSheetOpen(false); try { localStorage.setItem("cbt-answer-position", position); } catch { /* Keep the in-memory preference. */ } }
-  useEffect(() => { document.querySelector<HTMLElement>('.cbt-answer-row.is-current')?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [selected, sheetOpen, layoutMode]);
-  useEffect(() => { if (!attempt || attempt.status !== "in_progress") return; const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; }; const back = () => { window.history.pushState({ cbtGuard: true }, "", window.location.href); setModal("exit"); }; window.history.pushState({ cbtGuard: true }, "", window.location.href); window.addEventListener("beforeunload", beforeUnload); window.addEventListener("popstate", back); return () => { window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("popstate", back); }; }, [attempt?.id, attempt?.status]);
+  useEffect(() => { if (question) setSheetSubject(question.subjectId); }, [selected, question?.subjectId]);
+  useEffect(() => { const container = document.querySelector<HTMLElement>(".cbt-answer-scroll"); const row = container?.querySelector<HTMLElement>(".cbt-answer-row.is-current"); if (container && row) { const rect = row.getBoundingClientRect(), bounds = container.getBoundingClientRect(); if (rect.top < bounds.top + 6 || rect.bottom > bounds.bottom - 6) container.scrollTop += rect.top - bounds.top - 6; } const strip = document.querySelector<HTMLElement>(".cbt-number-strip nav"); const active = strip?.querySelector<HTMLElement>('[aria-current="step"]'); if (strip && active) centerInScroller(active, strip); }, [selected, sheetOpen, layoutMode, sheetSubject, sheetFilter]);
+  useEffect(() => { if (!attempt || attempt.status !== "in_progress") return; confirmedExit.current = false; const beforeUnload = (event: BeforeUnloadEvent) => { if (confirmedExit.current) return; event.preventDefault(); event.returnValue = ""; }; const back = () => { if (confirmedExit.current) return; window.history.pushState({ cbtGuard: true }, "", window.location.href); setModal("exit"); }; window.history.pushState({ cbtGuard: true }, "", window.location.href); window.addEventListener("beforeunload", beforeUnload); window.addEventListener("popstate", back); return () => { window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("popstate", back); }; }, [attempt?.id, attempt?.status]);
   const finish = useCallback(async () => {
     if (!attempt || attempt.status !== "in_progress" || finishedIds.current.has(attempt.id)) return;
     finishedIds.current.add(attempt.id);
@@ -149,12 +193,14 @@ function ExamScreen({ dataset, store, saveStore, certParam, attemptId, user }: {
     try {
       const session = (await getSupabaseBrowserClient().auth.getSession()).data.session;
       if (user && !session) throw new Error("로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.");
-      const score = scoreAttempt(attempt, questions);
+      await pendingAnswers.current;
+      const latestAttempt = readLocalStore().attempts.find((item) => item.id === attempt.id) || attempt;
+      const score = scoreAttempt(latestAttempt, questions);
       let result: { answers: Record<string, number>; submittedAt: string; score: number; alreadySubmitted: boolean };
       if (session) {
         const response = await fetch(`/api/cbt/attempts/${encodeURIComponent(attempt.id)}/submit/`, {
           method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
-          body: JSON.stringify({ ...attempt, score }),
+          body: JSON.stringify({ ...latestAttempt, score }),
         });
         if (!response.ok) throw new Error("결과를 저장하지 못했습니다. 다시 시도해 주세요.");
         result = await response.json();
@@ -166,7 +212,7 @@ function ExamScreen({ dataset, store, saveStore, certParam, attemptId, user }: {
       }
       const latest = readLocalStore();
       const wrongNotes = { ...latest.wrongNotes };
-      if (!latest.attempts.some((item) => item.id === attempt.id && item.status === "submitted")) {
+      if (!result.alreadySubmitted && !latest.attempts.some((item) => item.id === attempt.id && item.status === "submitted")) {
         questions.forEach((item) => { const correct = result.answers[item.id] === item.answer; const old = wrongNotes[item.id]; if (!correct) wrongNotes[item.id] = { wrongCount: (old?.wrongCount || 0) + 1, lastWrongAt: result.submittedAt, memo: old?.memo || "", mastered: false }; else if (old) wrongNotes[item.id] = { ...old, mastered: true }; });
       }
       const submitted: LocalAttempt = { ...attempt, answers: result.answers, status: "submitted", submittedAt: result.submittedAt, score: result.score };
@@ -179,59 +225,95 @@ function ExamScreen({ dataset, store, saveStore, certParam, attemptId, user }: {
   }, [attempt, questions, saveStore, user]);
   useEffect(() => { if (!attempt?.endAt || attempt.status !== "in_progress") return; const tick = () => { const left = timeLeftSeconds(attempt.endAt); setSecondsLeft(left); if (left === 0) setModal("expired"); else if (left !== null && left <= 60 && !warned.current) { warned.current = true; setToast("종료까지 1분 미만 남았습니다."); } return left; }; if (tick() === 0) return; const timer = window.setInterval(() => { if (tick() === 0) window.clearInterval(timer); }, 1000); return () => window.clearInterval(timer); }, [attempt?.endAt, attempt?.status]);
   function updateAttempt(next: LocalAttempt) { saveStore({ ...store, attempts: store.attempts.map((item) => item.id === next.id ? next : item) }); }
-  const answerQuestion = useCallback((questionId: string, index: number) => { if (!attempt || timeLeftSeconds(attempt.endAt) === 0 || attempt.lockedIds.includes(questionId) || !attempt.questionIds.includes(questionId)) return; const answers = attempt.config.gradeMode === "instant" ? { ...attempt.answers, [questionId]: index } : toggleAnswerSelection(attempt.answers, questionId, index); updateAttempt({ ...attempt, answers, lockedIds: attempt.config.gradeMode === "instant" ? [...attempt.lockedIds, questionId] : attempt.lockedIds }); setToast(answers[questionId] === undefined ? "선택을 해제했습니다." : "답안을 저장했습니다."); }, [attempt, store]);
+  function persistManaged(questionId: string, choice: number | null, review: boolean | null) {
+    setSavingAnswer(true);
+    const work = pendingAnswers.current.catch(() => undefined).then(async () => {
+      const row = await cbtPost<Parameters<typeof serverAttempt>[0]>(`/api/cbt/attempts/${encodeURIComponent(attemptId)}/answer/`, { questionId, choice, review });
+      const next = serverAttempt(row), latest = readLocalStore();
+      saveStore({ ...latest, attempts: latest.attempts.map((item) => item.id === next.id ? next : item) });
+      setToast("답안을 저장했습니다.");
+    }).finally(() => setSavingAnswer(false));
+    pendingAnswers.current = work;
+    void work.catch((error) => setToast(error instanceof Error ? error.message : "답안을 저장하지 못했습니다."));
+  }
+  const answerQuestion = useCallback((questionId: string, index: number) => {
+    const latest = readLocalStore(), current = latest.attempts.find((item) => item.id === attemptId);
+    if (!current || current.status !== "in_progress" || timeLeftSeconds(current.endAt) === 0 || current.lockedIds.includes(questionId) || !current.questionIds.includes(questionId)) return;
+    const answers = current.config.gradeMode === "instant" ? { ...current.answers, [questionId]: index } : toggleAnswerSelection(current.answers, questionId, index);
+    if (current.serverManaged) { persistManaged(questionId, answers[questionId] ?? null, null); return; }
+    saveStore({ ...latest, attempts: latest.attempts.map((item) => item.id === current.id ? { ...current, answers, lockedIds: current.config.gradeMode === "instant" ? [...current.lockedIds, questionId] : current.lockedIds } : item) });
+    setToast(answers[questionId] === undefined ? "선택을 해제했습니다." : "답안을 저장했습니다.");
+  }, [attemptId, saveStore]);
   const answer = useCallback((index: number) => { if (question) answerQuestion(question.id, index); }, [answerQuestion, question]);
-  const toggleBookmark = useCallback(() => { if (!question) return; const active = store.bookmarks.includes(question.id); saveStore({ ...store, bookmarks: active ? store.bookmarks.filter((id) => id !== question.id) : [...store.bookmarks, question.id] }); setToast(active ? "북마크를 해제했습니다." : "북마크에 추가했습니다."); }, [question, saveStore, store]);
-  function leave(discard: boolean) { if (!attempt || !cert) return; if (discard) saveStore({ ...store, attempts: store.attempts.filter((item) => item.id !== attempt.id) }); router.replace(`/cbt/${encodeURIComponent(certSlug(cert))}/`); }
-  function retry(ids: string[]) { if (!attempt || !cert) return; const id = makeId("attempt"); const now = new Date(); const next: LocalAttempt = { ...attempt, id, questionIds: reshuffle ? shuffle(ids) : ids, answers: {}, lockedIds: [], startedAt: now.toISOString(), endAt: attempt.config.timeLimitMinutes ? new Date(now.getTime() + attempt.config.timeLimitMinutes * 60000).toISOString() : null, submittedAt: undefined, score: undefined, status: "in_progress" }; saveStore({ ...store, attempts: [next, ...store.attempts] }); router.replace(`/cbt/${encodeURIComponent(certSlug(cert))}/exam/${id}/`); }
-  useEffect(() => { if (!attempt || attempt.status !== "in_progress") return; const keyboard = (event: KeyboardEvent) => { if (event.defaultPrevented || modal || sheetOpen || reviewOpen || (event.target as HTMLElement)?.closest('input,textarea,select,[role="radiogroup"],[role="dialog"],dialog')) return; if (/^[1-4]$/.test(event.key)) answer(Number(event.key) - 1); else if (event.key === "ArrowLeft") setSelected((value) => Math.max(0, value - 1)); else if (event.key === "ArrowRight") setSelected((value) => Math.min(questions.length - 1, value + 1)); else if (event.key.toLowerCase() === "b") toggleBookmark(); }; window.addEventListener("keydown", keyboard); return () => window.removeEventListener("keydown", keyboard); }, [answer, attempt, questions.length, toggleBookmark, modal, sheetOpen, reviewOpen]);
+  const toggleReview = useCallback(() => {
+    const latest = readLocalStore(), current = latest.attempts.find((item) => item.id === attemptId);
+    if (!question || !current || current.status !== "in_progress" || timeLeftSeconds(current.endAt) === 0) return;
+    const active = (current.reviewIds || []).includes(question.id);
+    if (current.serverManaged) { persistManaged(question.id, null, !active); return; }
+    const reviewIds = active ? (current.reviewIds || []).filter((id) => id !== question.id) : [...(current.reviewIds || []), question.id];
+    saveStore({ ...latest, attempts: latest.attempts.map((item) => item.id === current.id ? { ...current, reviewIds } : item) });
+    setToast(active ? "나중에 보기 표시를 해제했습니다." : "나중에 볼 문제로 표시했습니다.");
+  }, [question, attemptId, saveStore]);
+  function saveBookmark() { if (!question) return; const latest = readLocalStore(); saveStore({ ...latest, bookmarks: [...new Set([...latest.bookmarks, question.id])] }); setModal(null); setToast("북마크에 저장했습니다."); }
+  async function leave() { if (!attempt || !cert) return; try { await pendingAnswers.current; confirmedExit.current = true; window.location.replace(`/cbt/${encodeURIComponent(certSlug(cert))}/`); } catch (error) { confirmedExit.current = false; setToast(error instanceof Error ? error.message : "답안 저장을 확인한 뒤 다시 나가 주세요."); } }
+  async function retry(ids: string[]) { if (!attempt || !cert) return; if (attempt.serverManaged) { try { const row = await cbtPost<Parameters<typeof serverAttempt>[0]>("/api/cbt/attempts/start/", { certId: cert.id, mode: "custom", questionIds: reshuffle ? shuffle(ids) : ids, minutes: attempt.config.timeLimitMinutes, gradeMode: attempt.config.gradeMode }); const next = serverAttempt(row), latest = readLocalStore(); saveStore({ ...latest, attempts: [next, ...latest.attempts] }); router.replace(`/cbt/${encodeURIComponent(certSlug(cert))}/exam/${next.id}/`); } catch (error) { setToast(error instanceof Error ? error.message : "다시 풀기를 시작하지 못했습니다."); } return; } const id = makeId("attempt"); const now = new Date(); const next: LocalAttempt = { ...attempt, id, config: { ...attempt.config, mode: "custom" }, reviewIds: [], practiceNumber: undefined, displayNameSnapshot: accountName, questionIds: reshuffle ? shuffle(ids) : ids, answers: {}, lockedIds: [], startedAt: now.toISOString(), endAt: attempt.config.timeLimitMinutes ? new Date(now.getTime() + attempt.config.timeLimitMinutes * 60000).toISOString() : null, submittedAt: undefined, score: undefined, status: "in_progress" }; saveStore({ ...store, attempts: [next, ...store.attempts] }); router.replace(`/cbt/${encodeURIComponent(certSlug(cert))}/exam/${id}/`); }
+  useEffect(() => { if (!attempt || attempt.status !== "in_progress") return; const keyboard = (event: KeyboardEvent) => { if (event.defaultPrevented || modal || shortcutsOpen || sheetOpen || reviewOpen || (event.target as HTMLElement)?.closest('input,textarea,select,[role="radiogroup"],[role="dialog"],dialog')) return; if (/^[1-4]$/.test(event.key)) answer(Number(event.key) - 1); else if (event.key === "ArrowLeft") setSelected((value) => Math.max(0, value - 1)); else if (event.key === "ArrowRight") setSelected((value) => Math.min(questions.length - 1, value + 1)); else if (event.key.toLowerCase() === "b") toggleReview(); }; window.addEventListener("keydown", keyboard); return () => window.removeEventListener("keydown", keyboard); }, [answer, attempt, questions.length, toggleReview, modal, shortcutsOpen, sheetOpen, reviewOpen]);
   if (!attempt || !cert || !questions.length) return <PageShell><EmptyState title="응시 기록을 찾을 수 없습니다." body="저장되지 않았거나 삭제된 시험입니다." href="/cbt/" action="종목 선택으로" /></PageShell>;
-  if (attempt.status === "submitted") return <ResultScreen displayName={typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "수험자"} dataset={dataset} cert={cert} attempt={attempt} questions={questions} reshuffle={reshuffle} setReshuffle={setReshuffle} onRetry={retry} onReport={setReportQuestion} reportQuestion={reportQuestion} onReportClose={() => setReportQuestion(null)} store={store} saveStore={saveStore} toast={toast} setToast={setToast} />;
+  if (attempt.status === "submitted") return <ResultScreen displayName={attempt.displayNameSnapshot || accountName} dataset={dataset} cert={cert} attempt={attempt} questions={questions} reshuffle={reshuffle} setReshuffle={setReshuffle} onRetry={retry} onReport={setReportQuestion} reportQuestion={reportQuestion} onReportClose={() => setReportQuestion(null)} store={store} saveStore={saveStore} toast={toast} setToast={setToast} />;
   const answered = Object.keys(attempt.answers).length;
   const selectedAnswer = question ? attempt.answers[question.id] : undefined;
   const expired = secondsLeft === 0 && !!attempt.endAt;
   const locked = question ? attempt.lockedIds.includes(question.id) : false;
   const interimQuestions = questions.filter((item) => attempt.answers[item.id] !== undefined);
   const interimCorrect = interimQuestions.filter((item) => attempt.answers[item.id] === item.answer).length;
-  const bookmarked = questions.filter((item) => store.bookmarks.includes(item.id)).length;
-  const displayName = typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "수험자";
+  const reviewIds = attempt.reviewIds || [];
+  const bookmarked = questions.filter((item) => reviewIds.includes(item.id)).length;
+  const displayName = attempt.displayNameSnapshot || accountName;
   const pageStart = Math.floor(selected / 60) * 60;
   const paletteItems = questions.slice(pageStart, pageStart + 60).map((item, offset) => ({ item, index: pageStart + offset }));
   const paletteSections = paletteItems.reduce((sections, entry) => {
-    const name = dataset.subjects.find((subject) => subject.id === entry.item.subjectId)?.name || "과목 미분류";
+    const name = subjectName(dataset.subjects.find((subject) => subject.id === entry.item.subjectId)?.name || "과목 미분류");
     const section = sections.find((item) => item.name === name);
     if (section) section.entries.push(entry); else sections.push({ name, entries: [entry] });
     return sections;
   }, [] as { name: string; entries: typeof paletteItems }[]);
   const subjectProgress = dataset.subjects.filter((subject) => questions.some((item) => item.subjectId === subject.id)).map((subject) => {
     const scoped = questions.filter((item) => item.subjectId === subject.id);
-    return { name: subject.name, total: scoped.length, done: scoped.filter((item) => attempt.answers[item.id] !== undefined).length };
+    return { name: subjectName(subject.name), total: scoped.length, done: scoped.filter((item) => attempt.answers[item.id] !== undefined).length };
   });
   const unansweredNumbers = questions.map((item, index) => attempt.answers[item.id] === undefined ? index : -1).filter((index) => index >= 0);
-  const bookmarkedNumbers = questions.map((item, index) => store.bookmarks.includes(item.id) ? index : -1).filter((index) => index >= 0);
+  const bookmarkedNumbers = questions.map((item, index) => reviewIds.includes(item.id) ? index : -1).filter((index) => index >= 0);
   const goToQuestion = (index: number) => { setSelected(index); setSheetOpen(false); setReviewOpen(false); };
+  const filteredSections = paletteSections.filter((section) => sheetSubject === "all" || !sheetSubject || section.entries.some(({ item }) => item.subjectId === sheetSubject)).map((section) => ({ ...section, shown: section.entries.filter(({ item }) => sheetFilter === "all" || sheetFilter === "answered" && attempt.answers[item.id] !== undefined || sheetFilter === "unanswered" && attempt.answers[item.id] === undefined || sheetFilter === "review" && reviewIds.includes(item.id)) }));
+  function filterAnswers(filter: typeof sheetFilter) { setSheetFilter(filter); setSheetSubject("all"); if (layoutMode === "b" || window.matchMedia("(max-width: 900px)").matches) { sheetOpener.current = document.activeElement as HTMLElement; setSheetOpen(true); } }
   const answerSheet = <aside className={`cbt-answer-sheet${sheetOpen ? " is-open" : ""}`} aria-label="답안지" role={sheetOpen ? "dialog" : undefined} aria-modal={sheetOpen || undefined}>
-    <div className="cbt-answer-head"><div><h2>답안지</h2><p>현재 60문항 구간 · 응답 {paletteItems.filter(({ item }) => attempt.answers[item.id] !== undefined).length}문항</p></div><button type="button" className="cbt-answer-close" onClick={() => setSheetOpen(false)} aria-label="답안지 닫기">×</button></div>
+    <div className="cbt-answer-head"><div><h2>답안지</h2><p>응답 {answered}/{questions.length} · {sheetFilter === "unanswered" ? "미응답만 보기" : sheetFilter === "review" ? "나중에 보기" : sheetFilter === "answered" ? "응답만 보기" : "전체 답안"}</p></div><button type="button" className="cbt-answer-close" onClick={() => setSheetOpen(false)} aria-label="답안지 닫기">×</button></div>
     {questions.length > 60 && <div className="cbt-answer-pages"><button type="button" disabled={pageStart === 0} onClick={() => goToQuestion(Math.max(0, pageStart - 60))}>이전 60문항</button><span>{pageStart + 1}–{Math.min(pageStart + 60, questions.length)} / {questions.length.toLocaleString()}</span><button type="button" disabled={pageStart + 60 >= questions.length} onClick={() => goToQuestion(pageStart + 60)}>다음 60문항</button></div>}
-    <div className={`cbt-answer-scroll${layoutMode === "b" ? " is-number-only" : ""}`}>{paletteSections.map((section) => <section className="cbt-answer-section" key={section.name}><h3>{section.name} <small>응답 {section.entries.filter(({ item }) => attempt.answers[item.id] !== undefined).length}/{section.entries.length}</small></h3>{section.entries.map(({ item, index }) => { const chosen = attempt.answers[item.id]; const current = selected === index; const saved = store.bookmarks.includes(item.id); const graded = attempt.config.gradeMode === "instant" && attempt.lockedIds.includes(item.id); return <div className={`cbt-answer-row${current ? " is-current" : ""}${chosen !== undefined ? " is-answered" : ""}${graded ? chosen === item.answer ? " is-correct" : " is-wrong" : ""}`} key={item.id}><button type="button" onClick={() => goToQuestion(index)} aria-label={`${index + 1}번 ${chosen === undefined ? "미응답" : `${chosen + 1}번 보기 선택`}${saved ? ", 북마크" : ""} 문제로 이동`} aria-current={current ? "step" : undefined}>{index + 1}{saved ? " ◇" : ""}{layoutMode === "b" && chosen !== undefined ? ` ${"①②③④"[chosen]}` : ""}</button>{layoutMode === "a" && <AnswerChoices number={index + 1} selected={chosen} disabled={expired || graded} onSelect={(value) => answerQuestion(item.id, value)} />}</div>; })}</section>)}</div>
-    <div className="cbt-answer-legend"><span>□ 미응답</span><span>■ 응답 ①–④</span><span>◇ 북마크</span><span>▣ 현재</span>{attempt.config.gradeMode === "instant" && <span>✓/× 정오</span>}</div>
+    <div className="cbt-answer-subject-tabs" aria-label="답안지 과목"><button type="button" aria-pressed={sheetSubject === "all"} onClick={() => setSheetSubject("all")}>전체</button>{paletteSections.map((section) => { const id = section.entries[0].item.subjectId; const short = MOCK_SUBJECTS.find((rule) => rule.name === section.name)?.short || section.name; return <button type="button" aria-pressed={sheetSubject === id} onClick={() => setSheetSubject(id)} key={id}>{short} {attempt.config.mode === "mock" ? `${section.entries[0].index + 1}–${section.entries.at(-1)!.index + 1}` : ""}</button>; })}</div><div className="cbt-answer-filter"><button type="button" aria-pressed={sheetFilter === "unanswered"} onClick={() => setSheetFilter(sheetFilter === "unanswered" ? "all" : "unanswered")}>미응답만 보기</button><button type="button" onClick={() => setSheetFilter("all")}>필터 해제</button></div>
+    <div className={`cbt-answer-scroll${layoutMode === "b" ? " is-number-only" : ""}`}>{filteredSections.map((section) => <section className="cbt-answer-section" key={section.name}><h3>{section.name} {attempt.config.mode === "mock" && `${section.entries[0].index + 1}–${section.entries.at(-1)!.index + 1}`} <small>응답 {section.entries.filter(({ item }) => attempt.answers[item.id] !== undefined).length}/{section.entries.length}</small></h3>{!section.shown.length && <p className="cbt-empty-filter">조건에 맞는 문항이 없습니다.</p>}{section.shown.map(({ item, index }) => { const chosen = attempt.answers[item.id]; const current = selected === index; const saved = reviewIds.includes(item.id); const graded = attempt.config.gradeMode === "instant" && attempt.lockedIds.includes(item.id); return <div className={`cbt-answer-row${current ? " is-current" : ""}${chosen !== undefined ? " is-answered" : ""}${graded ? chosen === item.answer ? " is-correct" : " is-wrong" : ""}`} key={item.id}><button type="button" onClick={() => goToQuestion(index)} aria-label={`${index + 1}번 ${chosen === undefined ? "미응답" : `${chosen + 1}번 보기 선택`}${saved ? ", 나중에 보기" : ""} 문제로 이동`} aria-current={current ? "step" : undefined}>{index + 1}{saved ? " ◇" : ""}{layoutMode === "b" && chosen !== undefined ? ` ${"①②③④"[chosen]}` : ""}</button>{layoutMode === "a" && <AnswerChoices number={index + 1} selected={chosen} disabled={expired || graded || savingAnswer} onSelect={(value) => answerQuestion(item.id, value)} />}</div>; })}</section>)}</div>
+    <div className="cbt-answer-legend"><span>□ 미응답</span><span>■ 응답 ①–④</span><span>◇ 나중에 보기</span><span>▣ 현재</span>{attempt.config.gradeMode === "instant" && <span>✓/× 정오</span>}</div>
   </aside>;
-  return <section className="exam-page exam-redesign">
-    <header className="exam-topbar cbt-live-topbar"><button className="cbt-exam-logo" onClick={() => setModal("exit")} aria-label="CBT MATE 홈으로"><CbtMateLogo /></button><div className="cbt-exam-identity"><strong>{cert.name}</strong><small>{displayName} · 응시 번호 {attempt.id.replace(/^attempt-/, "")}</small></div><div className={`cbt-live-timer${secondsLeft !== null && secondsLeft <= 300 && attempt.endAt ? " is-urgent" : secondsLeft !== null && secondsLeft <= 600 && attempt.endAt ? " is-warning" : ""}`} aria-label="남은 시간"><span>◷ 남은 시간</span><strong>{attempt.endAt ? secondsLeft === null ? "확인 중" : formatSeconds(secondsLeft) : "무제한"}</strong>{secondsLeft !== null && secondsLeft <= 600 && attempt.endAt && <small>{secondsLeft <= 300 ? "5분 이하" : "10분 이하"}</small>}</div><ExamViewSettings fontSize={fontSize} choiceLayout={choiceLayout} position={layoutMode} onFontSize={setFontSize} onChoiceLayout={setChoiceLayout} onPosition={setAnswerPosition} /><button className="button button-primary exam-submit" onClick={() => expired ? setModal("expired") : setReviewOpen(true)}>{expired ? "결과 저장" : "제출"}</button>
+  return <section className={`exam-page exam-redesign exam-font-${fontSize}`}>
+    <CbtPreviewNotice /><header className="exam-topbar cbt-live-topbar"><button className="cbt-exam-logo" onClick={() => setModal("exit")} aria-label="CBT MATE 홈으로"><CbtMateLogo /></button><div className="cbt-exam-identity"><strong>{cert.name} <span className="cbt-exam-type">{attemptLabel(attempt)}</span></strong><small>{displayName} · 연습용 번호 {attempt.practiceNumber || "–"}</small></div><div className={`cbt-live-timer${secondsLeft !== null && secondsLeft <= 300 && attempt.endAt ? " is-urgent" : secondsLeft !== null && secondsLeft <= 600 && attempt.endAt ? " is-warning" : ""}`} aria-label="남은 시간"><span>◷ 남은 시간</span><strong>{attempt.endAt ? secondsLeft === null ? "확인 중" : formatSeconds(secondsLeft) : "무제한"}</strong>{secondsLeft !== null && secondsLeft <= 600 && attempt.endAt && <small>{secondsLeft <= 300 ? "5분 이하" : "10분 이하"}</small>}</div><ExamViewSettings fontSize={fontSize} choiceLayout={choiceLayout} position={layoutMode} onFontSize={setFontSize} onChoiceLayout={setChoiceLayout} onPosition={setAnswerPosition} /><button type="button" className="cbt-exam-menu-button" aria-label="시험 메뉴" aria-haspopup="dialog" onClick={() => setModal("menu")}>⋯</button><button className="button button-primary exam-submit" disabled={savingAnswer || submitting} onClick={() => expired ? setModal("expired") : setReviewOpen(true)}>{expired ? "결과 저장" : "제출"}</button>
     </header>
     {expired && <p className="exam-expired-notice" role="alert">제한 시간이 끝났습니다. 답안은 잠겼으며 결과 저장은 확인 후 진행됩니다.</p>}
-    {reviewOpen ? <section className="cbt-submit-review"><div className="cbt-review-heading"><span className="eyebrow">제출 전 마지막 확인</span><h1>답안을 점검해 주세요</h1><p>응답 {answered.toLocaleString()}문항 · 미응답 {unansweredNumbers.length.toLocaleString()}문항 · 북마크 {bookmarkedNumbers.length.toLocaleString()}문항</p></div><div className="cbt-review-grid"><div className="cbt-review-card"><h2>과목별 진행</h2>{subjectProgress.map((item) => <div className="cbt-review-progress" key={item.name}><span>{item.name}</span><i role="progressbar" aria-label={`${item.name} 응답`} aria-valuenow={item.done} aria-valuemin={0} aria-valuemax={item.total}><b style={{ width: `${item.total ? item.done / item.total * 100 : 0}%` }} /></i><strong>{item.done}/{item.total}</strong></div>)}<p className="cbt-review-notice">미응답 {unansweredNumbers.length.toLocaleString()}문항을 확인한 뒤 제출하세요.</p><div className="cbt-review-actions"><button className="button button-ghost" onClick={() => setReviewOpen(false)}>답안 수정</button><button className="button button-primary" onClick={() => setModal("submit")}>최종 제출</button></div></div><div className="cbt-review-card"><h2>다시 볼 문제</h2><div className="cbt-review-range"><button type="button" disabled={pageStart === 0} onClick={() => setSelected(pageStart - 60)}>이전 구간</button><span>{pageStart + 1}–{Math.min(pageStart + 60, questions.length)}</span><button type="button" disabled={pageStart + 60 >= questions.length} onClick={() => setSelected(pageStart + 60)}>다음 구간</button></div><h3>미응답 {unansweredNumbers.length.toLocaleString()}문항</h3><div className="cbt-review-numbers">{unansweredNumbers.filter((index) => index >= pageStart && index < pageStart + 60).map((index) => <button type="button" onClick={() => goToQuestion(index)} key={index}>{index + 1}</button>)}</div><h3>북마크 {bookmarkedNumbers.length.toLocaleString()}문항</h3><div className="cbt-review-numbers">{bookmarkedNumbers.filter((index) => index >= pageStart && index < pageStart + 60).map((index) => <button type="button" onClick={() => goToQuestion(index)} key={index}>{index + 1} ◇</button>)}</div></div></div></section> : <>
-    <div className="cbt-exam-summary"><strong>응답 {answered.toLocaleString()}/{questions.length.toLocaleString()}</strong><span>미응답 {(questions.length - answered).toLocaleString()}</span><span>◇ 북마크 {bookmarked.toLocaleString()}</span><i role="progressbar" aria-label="응답 진행률" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={questions.length}><b style={{ width: `${answered / questions.length * 100}%` }} /></i></div>
-    <div className={`cbt-live-layout is-${layoutMode}${choiceLayout === "focus" ? " is-focus" : ""}`}><div className="cbt-live-main"><article className={`exam-content cbt-live-question font-${fontSize} layout-${choiceLayout}`}><div className="exam-question-head"><span className="cbt-subject-chip">{dataset.subjects.find((subject) => subject.id === question.subjectId)?.name || "과목 미분류"}</span><div><button className={`exam-bookmark${store.bookmarks.includes(question.id) ? " is-active" : ""}`} onClick={toggleBookmark} aria-pressed={store.bookmarks.includes(question.id)}><span>◇</span> 북마크</button><button className="cbt-report-link" onClick={() => setReportQuestion(question)}>오류 신고</button></div></div><p className="cbt-question-number">문제 {selected + 1} <span>/ {questions.length.toLocaleString()}</span></p><h1>{question.stem}</h1>{question.images.length > 0 && <div className="question-image-list">{question.images.map((src) => <img src={src} alt="문항 참고 이미지" key={src} />)}</div>}<div className="choice-list">{question.choices.map((choice, index) => { const chosen = selectedAnswer === index; const correct = locked && question.answer === index; const wrong = locked && chosen && !correct; return <button className={`choice-button${chosen ? " is-selected" : ""}${correct ? " is-correct" : ""}${wrong ? " is-wrong" : ""}`} aria-pressed={chosen} disabled={locked || expired} onClick={() => answer(index)} key={`${choice.label}-${index}`}><b>{choice.label}</b><span>{choice.text}</span>{correct && <em>정답</em>}{wrong && <em>오답</em>}</button>; })}</div>{locked && <div className={`instant-feedback ${selectedAnswer === question.answer ? "is-correct" : "is-wrong"}`}><strong>{selectedAnswer === question.answer ? "✓ 정답입니다." : "✕ 오답입니다."}</strong><p>{question.explanation || "등록된 해설이 없습니다."}</p></div>}<div className="exam-nav"><button className="button button-ghost" disabled={!selected} onClick={() => setSelected(selected - 1)}>← 이전</button><button className="button button-primary" disabled={selected === questions.length - 1} onClick={() => setSelected(selected + 1)}>다음 →</button></div><p className="cbt-shortcuts">단축키 1~4 보기 선택 · ←/→ 이전/다음 · B 북마크</p></article>
-      {layoutMode === "b" && <section className="cbt-number-strip" aria-label="가로 번호 스트립"><div><h2>이웃 문제</h2><span>현재 {selected + 1}/{questions.length.toLocaleString()}</span></div><nav>{questions.slice(Math.max(0, selected - 5), Math.min(questions.length, Math.max(0, selected - 5) + 10)).map((item) => { const index = questions.indexOf(item); return <button type="button" className={`${attempt.answers[item.id] !== undefined ? "is-answered" : ""}${index === selected ? " is-current" : ""}${store.bookmarks.includes(item.id) ? " is-bookmarked" : ""}`} onClick={() => setSelected(index)} aria-current={index === selected ? "step" : undefined} key={item.id}>{index + 1}{store.bookmarks.includes(item.id) ? "◇" : ""}</button>; })}</nav><div className="cbt-number-strip-footer"><span>전체 {questions.length.toLocaleString()} · 남은 {(questions.length - answered).toLocaleString()} · 북마크 {bookmarked.toLocaleString()}</span><button type="button" onClick={(event) => { sheetOpener.current = event.currentTarget; setSheetOpen(true); }}>전체 번호 보기 →</button></div></section>}
+    <div className="cbt-sr-only" role="status">{timeAnnouncement}</div>
+    {!expired && secondsLeft !== null && secondsLeft <= 600 && !warningDismissed && <div className="cbt-time-warning"><span>{secondsLeft <= 300 ? "5분 남았습니다. 제출 전 답안을 점검하세요." : "10분 남았습니다. 미응답 문항을 점검하세요."}</span><button type="button" aria-label="시간 안내 닫기" onClick={() => setWarningDismissed(true)}>×</button></div>}
+    {reviewOpen ? <Modal variant="review" title="제출 전 점검" onClose={() => setReviewOpen(false)}><section className="cbt-submit-review"><div className="cbt-review-heading"><span className="eyebrow">제출 전 마지막 확인</span><h1>답안을 점검해 주세요</h1><p>응답 {answered.toLocaleString()}문항 · 미응답 {unansweredNumbers.length.toLocaleString()}문항 · 나중에 보기 {bookmarkedNumbers.length.toLocaleString()}문항</p></div><div className="cbt-review-grid"><div className="cbt-review-card"><h2>과목별 진행</h2>{subjectProgress.map((item) => <div className="cbt-review-progress" key={item.name}><span>{item.name}</span><i role="progressbar" aria-label={`${item.name} 응답`} aria-valuenow={item.done} aria-valuemin={0} aria-valuemax={item.total}><b style={{ width: `${item.total ? item.done / item.total * 100 : 0}%` }} /></i><strong>{item.done}/{item.total}</strong></div>)}<p className="cbt-review-notice">미응답 {unansweredNumbers.length.toLocaleString()}문항을 확인한 뒤 제출하세요.</p><div className="cbt-review-actions"><button className="button button-ghost" onClick={() => setReviewOpen(false)}>답안 수정</button><button className="button button-primary" onClick={() => setModal("submit")}>최종 제출</button></div></div><div className="cbt-review-card"><h2>다시 볼 문제</h2><div className="cbt-review-range"><button type="button" disabled={pageStart === 0} onClick={() => setSelected(pageStart - 60)}>이전 구간</button><span>{pageStart + 1}–{Math.min(pageStart + 60, questions.length)}</span><button type="button" disabled={pageStart + 60 >= questions.length} onClick={() => setSelected(pageStart + 60)}>다음 구간</button></div><h3>미응답 {unansweredNumbers.length.toLocaleString()}문항</h3><div className="cbt-review-numbers is-unanswered">{unansweredNumbers.filter((index) => index >= pageStart && index < pageStart + 60).map((index) => <button type="button" onClick={() => goToQuestion(index)} key={index}>{index + 1}</button>)}</div><h3>나중에 보기 {bookmarkedNumbers.length.toLocaleString()}문항</h3><div className="cbt-review-numbers">{bookmarkedNumbers.filter((index) => index >= pageStart && index < pageStart + 60).map((index) => <button type="button" onClick={() => goToQuestion(index)} key={index}>{index + 1} ◇</button>)}</div></div></div></section></Modal> : <>
+    <div className="cbt-exam-summary"><button type="button" onClick={() => filterAnswers("answered")}>응답 {answered.toLocaleString()}/{questions.length.toLocaleString()}</button><button type="button" onClick={() => filterAnswers("unanswered")}>미응답 {(questions.length - answered).toLocaleString()}</button><button type="button" onClick={() => filterAnswers("review")}>◇ 나중에 보기 {bookmarked.toLocaleString()}</button><i role="progressbar" aria-label="응답 진행률" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={questions.length}><b style={{ width: `${answered / questions.length * 100}%` }} /></i></div>
+    <div className={`cbt-live-layout is-${layoutMode}${choiceLayout === "focus" ? " is-focus" : ""}`}><div className="cbt-live-main"><article className={`exam-content cbt-live-question font-${fontSize} layout-${choiceLayout}`}><div className="exam-question-head"><span className="cbt-subject-chip">{dataset.subjects.find((subject) => subject.id === question.subjectId)?.name || "과목 미분류"}</span><div><button className={`exam-bookmark${reviewIds.includes(question.id) ? " is-active" : ""}`} onClick={toggleReview} aria-pressed={reviewIds.includes(question.id)} disabled={expired || savingAnswer}><span>◇</span> 나중에 보기</button><button type="button" className="cbt-question-menu-button" aria-label="문항 메뉴" aria-haspopup="dialog" onClick={() => setModal("question-menu")}>⋯</button></div></div><p className="cbt-question-number">문제 {selected + 1} <span>/ {questions.length.toLocaleString()}</span></p><h1>{question.stem}</h1>{question.images.length > 0 && <div className="question-image-list">{question.images.map((src) => <img src={src} alt="문항 참고 이미지" key={src} />)}</div>}<div className="choice-list">{question.choices.map((choice, index) => { const chosen = selectedAnswer === index; const correct = locked && question.answer === index; const wrong = locked && chosen && !correct; return <button className={`choice-button${chosen ? " is-selected" : ""}${correct ? " is-correct" : ""}${wrong ? " is-wrong" : ""}`} aria-pressed={chosen} disabled={locked || expired || savingAnswer} onClick={() => answer(index)} key={`${choice.label}-${index}`}><b>{choice.label}</b><span>{choice.text}</span>{correct && <em>정답</em>}{wrong && <em>오답</em>}</button>; })}</div>{locked && <div className={`instant-feedback ${selectedAnswer === question.answer ? "is-correct" : "is-wrong"}`}><strong>{selectedAnswer === question.answer ? "✓ 정답입니다." : "✕ 오답입니다."}</strong><p>{question.explanation || "등록된 해설이 없습니다."}</p></div>}<div className="exam-nav"><button className="button button-ghost" disabled={!selected} onClick={() => setSelected(selected - 1)}>← 이전</button><button type="button" className="button button-ghost cbt-shortcut-button" popoverTarget="cbt-shortcut-popup" aria-haspopup="dialog" aria-expanded={shortcutsOpen} aria-controls="cbt-shortcut-popup">ⓘ 단축키 보기</button><button className="button button-primary" disabled={selected === questions.length - 1} onClick={() => setSelected(selected + 1)}>다음 →</button></div></article>
+      {layoutMode === "b" && <section className="cbt-number-strip" aria-label="가로 번호 스트립"><div><h2>문항 번호</h2><span>현재 {selected + 1}/{questions.length.toLocaleString()}</span></div><nav>{questions.map((item, index) => { return <button type="button" className={`${attempt.answers[item.id] !== undefined ? "is-answered" : ""}${index === selected ? " is-current" : ""}${reviewIds.includes(item.id) ? " is-bookmarked" : ""}`} onClick={() => setSelected(index)} aria-current={index === selected ? "step" : undefined} key={item.id}>{index + 1}{reviewIds.includes(item.id) ? "◇" : ""}</button>; })}</nav><div className="cbt-number-strip-footer"><span>전체 {questions.length.toLocaleString()} · 남은 {(questions.length - answered).toLocaleString()} · 나중에 보기 {bookmarked.toLocaleString()}</span><button type="button" onClick={(event) => { sheetOpener.current = event.currentTarget; setSheetOpen(true); }}>전체 번호 보기 →</button></div></section>}
       {layoutMode === "a" && <button type="button" className="cbt-mobile-answer-trigger" onClick={(event) => { sheetOpener.current = event.currentTarget; setSheetOpen(true); }}>답안지 열기 · 응답 {answered.toLocaleString()}/{questions.length.toLocaleString()}</button>}
     </div>{answerSheet}</div>
-    <button type="button" className="cbt-exam-more" onClick={() => setModal("menu")}>중간 채점 · 나가기</button>
+
     </>}
+    {!reviewOpen && <nav className="cbt-exam-bottom-bar" aria-label="문제 이동"><button type="button" disabled={!selected} onClick={() => setSelected(selected - 1)}>← 이전</button><button type="button" onClick={(event) => { sheetOpener.current = event.currentTarget; setSheetOpen(true); }}>답안지 {answered}/{questions.length}</button><button type="button" disabled={selected === questions.length - 1} onClick={() => setSelected(selected + 1)}>다음 →</button></nav>}
+    <div id="cbt-shortcut-popup" popover="auto" className="cbt-shortcut-popup" role="dialog" aria-label="단축키 보기" onToggle={(event) => setShortcutsOpen((event.nativeEvent as ToggleEvent).newState === "open")}><h2>단축키 보기</h2><ul><li>1–4: 보기 선택</li><li>← / →: 이전 / 다음 문항</li><li>B: 나중에 보기 표시</li></ul><button className="button button-ghost" type="button" popoverTarget="cbt-shortcut-popup" popoverTargetAction="hide">닫기</button></div>
+    {modal === "question-menu" && <Modal title="문항 메뉴" onClose={() => setModal(null)}><div className="cbt-menu-actions"><button className="button button-secondary" onClick={saveBookmark}>북마크 저장</button><button className="button button-ghost" onClick={() => { setModal(null); setReportQuestion(question); }}>오류 신고</button></div></Modal>}
     {sheetOpen && <button type="button" className="cbt-answer-backdrop" onClick={() => setSheetOpen(false)} aria-label="답안지 닫기" />}
-    {modal === "menu" && <Modal title="문제 목록" onClose={() => setModal(null)} initialFocus><div className="cbt-menu-actions"><button className="button button-primary" autoFocus onClick={() => setModal(null)}>계속 풀기</button><button className="button button-ghost" onClick={() => setModal("interim")}>중간 채점</button><button className="button button-ghost" onClick={() => setModal("exit")}>목록으로 나가기</button></div></Modal>}
+    {modal === "menu" && <Modal title="시험 메뉴" onClose={() => setModal(null)} initialFocus><div className="cbt-menu-actions"><button className="button button-primary" autoFocus onClick={() => setModal(null)}>계속 풀기</button><button className="button button-ghost" onClick={() => setModal("interim")}>중간 채점</button><button className="button button-ghost" onClick={() => setModal("exit")}>목록으로 나가기</button></div></Modal>}
     {modal === "interim" && <Modal title="중간 채점 결과" onClose={() => setModal(null)}><div className="cbt-interim-summary"><strong>{interimQuestions.length ? Math.round(interimCorrect / interimQuestions.length * 100) : 0}%</strong><span>정답률</span><span>푼 문제 {interimQuestions.length.toLocaleString()}개</span><span>안 푼 문제 {(questions.length - interimQuestions.length).toLocaleString()}개</span></div><div className="result-grid">{questions.slice(pageStart, pageStart + 60).map((item, offset) => { const index = pageStart + offset; return <div className={`result-q${attempt.answers[item.id] === undefined ? "" : attempt.answers[item.id] === item.answer ? " is-correct" : " is-wrong"}`} key={item.id}><b>{index + 1}</b><span>{attempt.answers[item.id] === undefined ? "-" : attempt.answers[item.id] === item.answer ? "O" : "X"}</span></div>; })}</div><div className="cbt-modal-actions"><button className="button button-primary" onClick={() => setModal(null)}>계속 풀기</button></div></Modal>}
-    {modal === "exit" && <Modal title="시험을 나갈까요?" onClose={() => setModal(null)}><p>답안은 선택할 때마다 자동 저장됩니다.</p><div className="cbt-menu-actions"><button className="button button-primary" autoFocus onClick={() => leave(false)}>저장하고 나가기</button><button className="button button-ghost" onClick={() => leave(true)}>저장하지 않고 나가기</button><button className="button button-ghost" onClick={() => setModal(null)}>계속 풀기</button></div></Modal>}
+    {modal === "exit" && <Modal title="시험을 나갈까요?" onClose={() => setModal(null)}><p>나가도 답안은 저장됩니다. 시간은 계속 흐릅니다.</p><div className="cbt-menu-actions"><button className="button button-primary" autoFocus onClick={() => leave()}>저장하고 나가기</button><button className="button button-ghost" onClick={() => setModal(null)}>계속 풀기</button></div></Modal>}
     {modal === "submit" && <Modal title="답안을 제출할까요?" onClose={() => setModal(null)}><p>안 푼 문제 <strong>{(questions.length - answered).toLocaleString()}개</strong>가 있습니다. 제출하면 시험이 종료됩니다.</p><div className="cbt-modal-actions"><button className="button button-ghost" disabled={submitting} onClick={() => setModal(null)}>계속 풀기</button><button className="button button-primary" disabled={submitting} onClick={finish}>{submitting ? "저장 중…" : "제출하고 채점"}</button></div></Modal>}
     {modal === "expired" && <Modal title="제한 시간이 끝났습니다" onClose={() => setModal(null)} initialFocus><p>답안은 더 수정할 수 없습니다. 결과를 저장하고 확인할까요? 안 푼 문제 {(questions.length - answered).toLocaleString()}개도 오답으로 채점됩니다.</p><div className="cbt-modal-actions"><button className="button button-ghost" disabled={submitting} onClick={() => setModal(null)}>나중에 결정</button><button className="button button-primary" disabled={submitting} onClick={finish}>{submitting ? "저장 중…" : "결과 저장하고 보기"}</button></div></Modal>}
     {reportQuestion && <ReportModal question={reportQuestion} attemptId={attempt.id} store={store} saveStore={saveStore} onClose={() => setReportQuestion(null)} onDone={() => { setReportQuestion(null); setToast("오류 신고를 접수했습니다."); }} />}<Toast message={toast} onDone={() => setToast("")} />
@@ -257,11 +339,11 @@ function ResultScreen({ displayName, dataset, cert, attempt, questions, reshuffl
   const resultStart = Math.floor(selectedIndex / 60) * 60;
   const weakest = subjectStats.length ? subjectStats.reduce((lowest, item) => item.rate < lowest.rate ? item : lowest) : null;
   function showWrongExplanation() { setSelectedIndex(questions.findIndex((question) => question.id === wrongIds[0])); document.getElementById("cbt-result-review")?.scrollIntoView({ block: "start" }); }
-  return <section className="exam-page exam-redesign"><SiteHeader showOnExam /><div className="result-page">
+  return <section className="exam-page exam-redesign"><SiteHeader showOnExam /><div className="result-page"><CbtPreviewNotice />
     <div className="cbt-result-heading"><span className="eyebrow">학습을 돌아보세요</span><h1>시험 결과</h1><p>{cert.name}</p></div>
     {timedOut && <p className="cbt-result-timeout" role="status">시간 종료 · 저장된 답안으로 채점했습니다.</p>}
     <div className={`result-hero${score >= (exam?.passScore || 60) ? " is-pass" : " is-fail"}`}>
-      <div className="cbt-result-identity"><span className="eyebrow">개인 학습용 연습</span><h2>{cert.name}</h2><p>{displayName} · 응시 번호 {attempt.id.replace(/^attempt-/, "")}</p><p>응시일 {displayDate(attempt.startedAt)}</p><span className="cbt-result-badge">{score >= (exam?.passScore || 60) ? "✓ 합격 기준 충족" : "↻ 합격 기준 미달"}</span></div><div className="cbt-result-score-block">
+      <div className="cbt-result-identity"><span className="eyebrow">개인 학습용 연습</span><h2>{cert.name}</h2><p>{displayName} · 응시 번호 {attempt.practiceNumber || "–"}</p><p>응시일 {displayDate(attempt.startedAt)}</p><span className="cbt-result-badge">{score >= (exam?.passScore || 60) ? "✓ 합격 기준 충족" : "× 합격 기준 미달"}</span></div><div className="cbt-result-score-block">
       <strong className="result-score"><span>{score}</span><small>점</small></strong>
       <h1>{score >= (exam?.passScore || 60) ? "합격 기준을 넘었습니다." : "조금 더 복습해 보세요."}</h1>
       <p>정답 {correct}문항 · 오답 {questions.length - correct - unanswered}문항 · 미응답 {unanswered}문항 · 소요시간 {spent}분</p>
@@ -344,7 +426,7 @@ function LearningScreen({ mode, dataset, store, saveStore, user, authReady }: {
       {mode === "wrong-notes" && <select aria-label="오답 정렬" value={sort} onChange={(event) => { setSort(event.target.value); resetPage(); }}><option value="recent">최근 틀린 순</option><option value="frequent">많이 틀린 순</option></select>}
     </div>}
     {mode === "wrong-notes" && (wrongQuestions.length ? <section className="records-card">
-      <div className="cbt-section-head"><h2>오답노트 <small>{wrongQuestions.length.toLocaleString()}문항</small></h2><button className="button button-primary" disabled={!retryBatch.length} onClick={() => retry(retryBatch.map((question) => question.id))}>{selectedNotes.length ? "선택한" : "이 목록"} {retryBatch.length}문항 풀기</button></div>
+      <div className="cbt-section-head"><h2><small>전체 {wrongQuestions.length.toLocaleString()}문항</small></h2><button className="button button-primary" disabled={!retryBatch.length} onClick={() => retry(retryBatch.map((question) => question.id))}>{selectedNotes.length ? "선택한" : "이 목록"} {retryBatch.length}문항 풀기</button></div>
       <p className="cbt-list-range" aria-live="polite">{wrongQuestions.length.toLocaleString()}문항 중 {(currentPage - 1) * 20 + 1}~{Math.min(currentPage * 20, wrongQuestions.length)}번 표시 · 현재 페이지 문항을 다시 풉니다{batchCert ? ` (${batchCert.name})` : ""}</p>
       {visibleWrongQuestions.map((question) => { const note = store.wrongNotes[question.id]; const expanded = expandedNotes.includes(question.id); return <article className="cbt-learning-row cbt-wrong-row" key={question.id}>
         <label className="cbt-note-select"><input type="checkbox" aria-label={`${question.no}번 문제 선택`} checked={selectedNotes.includes(question.id)} onChange={(event) => setSelectedNotes(event.target.checked ? [...selectedNotes, question.id] : selectedNotes.filter((id) => id !== question.id))} /></label>
@@ -354,16 +436,32 @@ function LearningScreen({ mode, dataset, store, saveStore, user, authReady }: {
       {pageCount > 1 && <nav className="cbt-pagination" aria-label="오답노트 페이지"><button className="button button-ghost" disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); setSelectedNotes([]); }}>이전</button><span aria-live="polite">{currentPage} / {pageCount}</span><button className="button button-ghost" disabled={currentPage === pageCount} onClick={() => { setPage(currentPage + 1); setSelectedNotes([]); }}>다음</button></nav>}
     </section> : <EmptyState title="조건에 맞는 오답이 없습니다." body="문제를 풀고 틀린 문항이 생기면 여기에 자동으로 모입니다." href="/cbt/" action="문제 풀기" />)}
     {mode === "bookmarks" && (bookmarkQuestions.length ? <section className="records-card"><div className="cbt-section-head"><h2>저장한 문제</h2><button className="button button-primary" onClick={() => retry(bookmarkBatch.map((question) => question.id))}>{dataset.certs.find((cert) => cert.id === bookmarkQuestions[0].certId)?.name} {bookmarkBatch.length}문항 다시 풀기</button></div>{bookmarkQuestions.map((question) => <article className="cbt-learning-row" key={question.id}><div><small>{dataset.certs.find((cert) => cert.id === question.certId)?.name}</small><strong>{question.no}. {question.stem}</strong></div><button className="button button-ghost" onClick={() => saveStore({ ...store, bookmarks: store.bookmarks.filter((id) => id !== question.id) })}>북마크 해제</button></article>)}</section> : hasBookmarks ? <EmptyState title="조건에 맞는 북마크가 없습니다." body="필터를 바꿔 다른 문제를 확인해 보세요." action="필터 초기화" onAction={() => { setCertId("all"); setSubjectId("all"); }} /> : <EmptyState title="저장한 북마크가 없습니다." body="시험 화면에서 다시 보고 싶은 문제를 저장해 보세요." href="/cbt/" action="문제 풀기" />)}
-    {mode === "history" && (attempts.length ? <div className="records-grid"><section className="records-card"><h2>응시 이력</h2>{attempts.map((attempt) => { const firstQuestion = dataset.questions.find((question) => attempt.questionIds.includes(question.id)); const cert = dataset.certs.find((item) => item.id === attempt.config.certId || item.id === firstQuestion?.certId || certSlug(item) === attempt.config.certSlug); const exam = dataset.exams.find((item) => attempt.config.examIds.length === 1 && attempt.config.examIds[0] === item.id); return <div className="record-row" key={attempt.id}><span>{cert?.name || "이전 모의고사"}<small>{exam ? `${exam.year}년 ${exam.round}` : "모의고사"} · {displayDate(attempt.submittedAt)}</small></span><strong>{attempt.score ?? 0}점</strong>{cert ? <Link className="button button-ghost" href={`/cbt/${encodeURIComponent(certSlug(cert))}/exam/${attempt.id}/`}>결과 다시 보기</Link> : <span className="record-unavailable">결과 확인 불가</span>}</div>; })}</section><section className="records-card"><h2>종목별 단원 정답률</h2>{dataset.subjects.map((subject) => { const answers = attempts.flatMap((attempt) => attempt.questionIds.map((id) => ({ attempt, question: dataset.questions.find((question) => question.id === id) }))).filter((item) => item.question?.subjectId === subject.id); if (!answers.length) return null; const rate = Math.round(answers.filter(({ attempt, question }) => question && attempt.answers[question.id] === question.answer).length / answers.length * 100); const cert = dataset.certs.find((item) => item.id === subject.certId); return <div className="cbt-rate-row" key={subject.id}><span>{cert?.name} · {subject.name}</span><i role="img" aria-label={`정답률 ${rate}%`}><b style={{ width: `${rate}%`, minWidth: rate ? 8 : 0 }} /></i><strong>{rate}%</strong></div>; })}</section></div> : <EmptyState title="응시 기록이 없습니다." body="첫 시험을 완료하면 점수와 정답률이 여기에 표시됩니다." href="/cbt/" action="종목 선택" />)}
+    {mode === "history" && (attempts.length ? <div className="records-grid"><section className="records-card"><h2>응시 이력</h2>{attempts.map((attempt) => { const firstQuestion = dataset.questions.find((question) => attempt.questionIds.includes(question.id)); const cert = dataset.certs.find((item) => item.id === attempt.config.certId || item.id === firstQuestion?.certId || certSlug(item) === attempt.config.certSlug); const exam = dataset.exams.find((item) => attempt.config.examIds.length === 1 && attempt.config.examIds[0] === item.id); return <div className="record-row" key={attempt.id}><span>{cert?.name || "이전 시험 기록"}<small>{attemptLabel(attempt)} · {attempt.questionIds.length}문항{exam ? ` · ${exam.year}년 ${exam.round}` : ""} · {displayDate(attempt.submittedAt)}</small></span><strong>{attempt.score ?? 0}점</strong>{cert ? <Link className="button button-ghost" href={`/cbt/${encodeURIComponent(certSlug(cert))}/exam/${attempt.id}/`}>결과 다시 보기</Link> : <span className="record-unavailable">결과 확인 불가</span>}</div>; })}</section><section className="records-card"><h2>종목별 단원 정답률</h2>{dataset.subjects.map((subject) => { const answers = attempts.flatMap((attempt) => attempt.questionIds.map((id) => ({ attempt, question: dataset.questions.find((question) => question.id === id) }))).filter((item) => item.question?.subjectId === subject.id); if (!answers.length) return null; const rate = Math.round(answers.filter(({ attempt, question }) => question && attempt.answers[question.id] === question.answer).length / answers.length * 100); const cert = dataset.certs.find((item) => item.id === subject.certId); return <div className="cbt-rate-row" key={subject.id}><span>{cert?.name} · {subject.name}</span><i role="img" aria-label={`정답률 ${rate}%`}><b style={{ width: `${rate}%`, minWidth: rate ? 8 : 0 }} /></i><strong>{rate}%</strong></div>; })}</section></div> : <EmptyState title="응시 기록이 없습니다." body="첫 시험을 완료하면 점수와 정답률이 여기에 표시됩니다." href="/cbt/" action="종목 선택" />)}
     {explanationQuestion && <Modal title={`${explanationQuestion.no}번 해설`} onClose={() => setExplanationQuestion(null)}><p>{explanationQuestion.explanation || "등록된 해설이 없습니다."}</p><div className="cbt-modal-actions"><button className="button button-primary" onClick={() => setExplanationQuestion(null)}>닫기</button></div></Modal>}
     {deletingQuestionId && <Modal title="오답노트에서 삭제할까요?" onClose={() => setDeletingQuestionId(null)}><p>삭제한 문제는 다시 틀리면 오답노트에 저장됩니다.</p><div className="cbt-modal-actions"><button className="button button-ghost" onClick={() => setDeletingQuestionId(null)}>취소</button><button className="button button-primary" onClick={() => { const next = { ...store.wrongNotes }; delete next[deletingQuestionId]; saveStore({ ...store, wrongNotes: next }); setDeletingQuestionId(null); }}>삭제</button></div></Modal>}
   </PageShell>;
 }
 
-function Records({ cert, dataset, store }: { cert: Cert; dataset: Dataset; store: LocalStore }) { const attempts = store.attempts.filter((attempt) => attempt.config.certId === cert.id); return attempts.length ? <section className="records-card"><h2>내 기록</h2>{attempts.map((attempt) => { const exam = dataset.exams.find((item) => attempt.config.examIds.length === 1 && attempt.config.examIds[0] === item.id); return <div className="record-row" key={attempt.id}><span>{exam ? `${exam.year}년 ${exam.round}` : "모의고사"}<small>{displayDate(attempt.submittedAt || attempt.startedAt)}</small></span><strong>{attempt.status === "submitted" ? `${attempt.score ?? 0}점` : "진행 중"}</strong><Link className="button button-ghost" href={`/cbt/${encodeURIComponent(certSlug(cert))}/exam/${attempt.id}/`}>{attempt.status === "submitted" ? "결과 보기" : "이어서 풀기"}</Link></div>; })}</section> : <EmptyState title="아직 학습 기록이 없습니다." body="회차별 기출이나 모의고사를 시작해 보세요." />; }
+function Records({ cert, dataset, store }: { cert: Cert; dataset: Dataset; store: LocalStore }) {
+  const [now, setNow] = useState(Date.now());
+  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
+  const attempts = store.attempts.filter((attempt) => attempt.config.certId === cert.id).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
+  const latest = attempts.find((attempt) => attempt.status === "in_progress" && !expiredAttempt(attempt, now));
+  return attempts.length ? <section className="records-card"><h2>이 종목 기록</h2>{attempts.map((attempt) => {
+    const exam = dataset.exams.find((item) => attempt.config.examIds.length === 1 && attempt.config.examIds[0] === item.id);
+    const expired = expiredAttempt(attempt, now), submitted = attempt.status === "submitted";
+    const remaining = attempt.endAt ? formatSeconds(Math.max(0, Math.ceil((Date.parse(attempt.endAt) - now) / 1000))) : "제한 없음";
+    return <div className="record-row cbt-cert-record" key={attempt.id}><div><div className="cbt-record-meta"><span className="cbt-subject-chip">{attemptLabel(attempt)}</span><span>{attempt.questionIds.length}문항</span>{exam && <span>{exam.year}년 {exam.round}</span>}</div><small>{displayDate(attempt.submittedAt || attempt.startedAt)}{!submitted && !expired ? ` · 남은 ${remaining}` : ""}</small></div><span className={expired ? "cbt-record-status is-expired" : "cbt-record-status"}>{submitted ? `${attempt.score ?? 0}점` : expired ? "시간 만료" : "진행 중"}</span>{(submitted || expired || latest?.id === attempt.id) ? <Link className="button button-secondary" href={`/cbt/${encodeURIComponent(certSlug(cert))}/exam/${attempt.id}/`}>{submitted ? "결과 보기" : expired ? "결과 저장하기" : "이어서 풀기"}</Link> : <span className="record-unavailable">다른 시험 진행 중</span>}</div>;
+  })}</section> : <EmptyState title="아직 학습 기록이 없습니다." body="회차별 기출이나 모의시험을 시작해 보세요." />;
+}
 function CardHead({ no, title, desc }: { no: string; title: string; desc: string }) { return <div className="question-card-head"><span>{no}</span><div><strong>{title}</strong><p>{desc}</p></div></div>; }
 function CustomCheckbox({ checked, onChange, disabled = false }: { checked: boolean; onChange: () => void; disabled?: boolean }) { return <span className="cbt-checkbox"><input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} /><span aria-hidden="true">{checked && <svg viewBox="0 0 16 16"><path d="m3 8 3 3 7-7" /></svg>}</span></span>; }
-function Modal({ title, children, onClose, initialFocus = false }: { title: string; children: React.ReactNode; onClose: () => void; initialFocus?: boolean }) { const ref = useRef<HTMLDialogElement>(null); useEffect(() => { const dialog = ref.current; if (!dialog) return; if (!dialog.open) dialog.showModal(); if (initialFocus) dialog.querySelector<HTMLElement>(".cbt-modal-actions .button, .cbt-menu-actions .button")?.focus(); }, [initialFocus]); return <dialog className="cbt-modal" aria-labelledby="cbt-modal-title" ref={ref} onClose={onClose}><div className="cbt-modal-head"><h2 id="cbt-modal-title">{title}</h2><button onClick={() => ref.current?.close()} aria-label="닫기">×</button></div>{children}</dialog>; }
+function Modal({ title, children, onClose, initialFocus = false, variant }: { variant?: "review"; title: string; children: React.ReactNode; onClose: () => void; initialFocus?: boolean }) { const ref = useRef<HTMLDialogElement>(null); const titleId = useId(); useEffect(() => { const dialog = ref.current; if (!dialog) return; if (!dialog.open) dialog.showModal(); if (initialFocus) dialog.querySelector<HTMLElement>(".cbt-modal-actions .button, .cbt-menu-actions .button")?.focus(); }, [initialFocus]); return <dialog className={`cbt-modal${variant === "review" ? " cbt-review-modal" : ""}`} aria-labelledby={titleId} ref={ref} onClose={onClose}><div className="cbt-modal-head"><h2 id={titleId}>{title}</h2><button onClick={() => ref.current?.close()} aria-label="닫기">×</button></div>{children}</dialog>; }
 function EmptyState({ title, body, href, action, onAction }: { title: string; body: string; href?: string; action?: string; onAction?: () => void }) { return <div className="question-empty cbt-empty"><strong>{title}</strong><p>{body}</p>{href && action ? <Link className="button button-primary" href={href}>{action}</Link> : onAction && action ? <button onClick={onAction}>{action}</button> : null}</div>; }
-function Toast({ message, onDone }: { message: string; onDone: () => void }) { useEffect(() => { if (!message) return; const timer = window.setTimeout(onDone, 2200); return () => window.clearTimeout(timer); }, [message, onDone]); return message ? <div className="cbt-toast" role="status">{message}</div> : null; }
-function ReportModal({ question, attemptId, store, saveStore, onClose, onDone }: { question: Question; attemptId: string; store: LocalStore; saveStore: (store: LocalStore) => void; onClose: () => void; onDone: () => void }) { const [kind, setKind] = useState<IssueReport["kind"]>("wrong_answer"); const [memo, setMemo] = useState(""); function submit() { const report: IssueReport = { id: makeId("report"), questionId: question.id, attemptId, kind, memo, createdAt: new Date().toISOString(), status: "open" }; saveStore({ ...store, issueReports: [report, ...store.issueReports] }); void submitIssueReport(report).catch(() => undefined); onDone(); } return <Modal title="문제 오류 신고" onClose={onClose}><div className="builder-fields"><label>오류 유형<select value={kind} onChange={(event) => setKind(event.target.value as IssueReport["kind"])}><option value="wrong_answer">잘못된 정답</option><option value="broken_image">이미지 깨짐</option><option value="missing_choice">보기 누락</option><option value="other">기타</option></select></label><label>메모<textarea rows={4} value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="확인할 내용을 적어 주세요." /></label></div><div className="cbt-modal-actions"><button className="button button-ghost" onClick={onClose}>취소</button><button className="button button-primary" onClick={submit}>신고 접수</button></div></Modal>; }
+function Toast({ message, onDone }: { message: string; onDone: () => void }) {
+  const done = useRef(onDone);
+  useEffect(() => { done.current = onDone; }, [onDone]);
+  useEffect(() => { if (!message) return; const timer = window.setTimeout(() => done.current(), 2700); return () => window.clearTimeout(timer); }, [message]);
+  return message ? <div className="cbt-toast" role="status">{message}</div> : null;
+}
+function ReportModal({ question, attemptId, store, saveStore, onClose, onDone }: { question: Question; attemptId: string; store: LocalStore; saveStore: (store: LocalStore) => void; onClose: () => void; onDone: () => void }) { const [kind, setKind] = useState<IssueReport["kind"]>("wrong_answer"); const [memo, setMemo] = useState(""); function submit() { const report: IssueReport = { id: makeId("report"), questionId: question.id, attemptId, kind, memo, createdAt: new Date().toISOString(), status: "open" }; saveStore({ ...store, issueReports: [report, ...store.issueReports] }); void submitIssueReport(report).catch(() => undefined); onDone(); } return <Modal title="문제 오류 신고" onClose={onClose}><div className="builder-fields"><label>오류 유형<select value={kind} onChange={(event) => setKind(event.target.value as IssueReport["kind"])}><option value="wrong_answer">잘못된 정답</option><option value="broken_image">이미지 깨짐</option><option value="missing_choice">보기 누락</option><option value="other">기타</option></select></label><label>메모<textarea rows={4} value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="확인할 내용을 적어 주세요." /></label></div><div className="cbt-modal-actions"><button className="button button-ghost" onClick={onClose}>취소</button><button className="button button-primary" disabled={CBT_PREVIEW_READ_ONLY} onClick={submit}>신고 접수</button></div></Modal>; }
diff --git a/lib/cbt-presentation.ts b/lib/cbt-presentation.ts
new file mode 100644
index 0000000..bdc99e0
--- /dev/null
+++ b/lib/cbt-presentation.ts
@@ -0,0 +1,19 @@
+import type { LocalAttempt } from "./question-bank";
+
+export const MOCK_SUBJECTS = [
+  { internal: "금속도장재료", name: "금속도장재료", short: "재료" },
+  { internal: "금속도장", name: "금속도장 작업 및 안전", short: "도장" },
+  { internal: "색채", name: "색채 및 조색", short: "색채" },
+] as const;
+export function subjectName(name: string) { return MOCK_SUBJECTS.find((subject) => subject.internal === name)?.name || name; }
+export function attemptLabel(attempt: LocalAttempt) {
+  return attempt.config.mode === "mock" ? "모의시험" : attempt.config.mode === "custom" ? "맞춤 시험지" : attempt.config.mode === "subject" ? "단원 연습" : attempt.config.mode === "past" || attempt.config.examIds.length === 1 ? "회차 기출" : "이전 시험";
+}
+export function expiredAttempt(attempt: LocalAttempt, now = Date.now()) {
+  return attempt.status === "in_progress" && !!attempt.endAt && new Date(attempt.endAt).getTime() <= now;
+}
+// Scroll only this container; scrollIntoView can also move the page vertically.
+export function centerInScroller(element: HTMLElement, container: HTMLElement) {
+  const item = element.getBoundingClientRect(), parent = container.getBoundingClientRect();
+  container.scrollTo({ left: container.scrollLeft + item.left - parent.left - (parent.width - item.width) / 2, behavior: "instant" });
+}
diff --git a/lib/cbt-server-client.ts b/lib/cbt-server-client.ts
new file mode 100644
index 0000000..99ffede
--- /dev/null
+++ b/lib/cbt-server-client.ts
@@ -0,0 +1,15 @@
+import { getSupabaseBrowserClient } from "./supabase-browser";
+import type { LocalAttempt } from "./question-bank";
+
+export const SERVER_EXAMS = process.env.NEXT_PUBLIC_CBT_SERVER_EXAMS === "1";
+export async function cbtPost<T>(path: string, body: unknown = {}): Promise<T> {
+  const { data } = await getSupabaseBrowserClient().auth.getSession();
+  if (!data.session) throw new Error("로그인이 필요합니다.");
+  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify(body) });
+  const result = await response.json();
+  if (!response.ok) throw new Error(result.error || "요청을 처리하지 못했습니다.");
+  return result;
+}
+export function serverAttempt(row: { client_id: string; config: LocalAttempt["config"] & { practiceNumber: string; displayNameSnapshot: string; seed: string; reviewIds: string[]; lockedIds: string[] }; question_ids: string[]; answers: Record<string, number>; started_at: string; end_at: string | null; submitted_at?: string; score?: number; status: LocalAttempt["status"] }): LocalAttempt {
+  return { id: row.client_id, config: row.config, questionIds: row.question_ids, answers: row.answers, startedAt: row.started_at, endAt: row.end_at, submittedAt: row.submitted_at, status: row.status, score: row.score, serverManaged: true, seed: row.config.seed, practiceNumber: row.config.practiceNumber, displayNameSnapshot: row.config.displayNameSnapshot, reviewIds: row.config.reviewIds, lockedIds: row.config.lockedIds || [] };
+}
diff --git a/lib/cbt-test-server.ts b/lib/cbt-test-server.ts
new file mode 100644
index 0000000..84fc37c
--- /dev/null
+++ b/lib/cbt-test-server.ts
@@ -0,0 +1,22 @@
+import "server-only";
+import { createClient } from "@supabase/supabase-js";
+import { getPublicSupabaseConfig } from "./public-supabase-config";
+
+export async function cbtTestServer(request: Request) {
+  const { url, key } = getPublicSupabaseConfig();
+  const ref = new URL(url).hostname.split(".")[0];
+  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
+  if (process.env.CBT_TEST_PROJECT_REF !== ref || !ref || ref === "fmecqeadghrdisirucqm" || process.env.VERCEL_ENV === "production" || process.env.NEXT_PUBLIC_CBT_SERVER_EXAMS !== "1" || !secret) {
+    throw new Error("별도 테스트 DB 연결 후 사용할 수 있습니다.");
+  }
+  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
+  if (!token) throw new Error("로그인이 필요합니다.");
+  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
+  const { data, error } = await auth.auth.getUser(token);
+  if (error || !data.user) throw new Error("로그인을 다시 확인해 주세요.");
+  return { userId: data.user.id, db: createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }) };
+}
+export function cbtError(error: unknown) {
+  console.error("[CBT test API]", error instanceof Error ? error.message : "request failed");
+  return Response.json({ error: error instanceof Error ? error.message : "요청을 처리하지 못했습니다." }, { status: 400, headers: { "Cache-Control": "no-store" } });
+}
diff --git a/lib/question-bank.ts b/lib/question-bank.ts
index ff2f17f..1035b11 100644
--- a/lib/question-bank.ts
+++ b/lib/question-bank.ts
@@ -14,8 +14,8 @@ export type Subject = { id: string; certId: string; name: string };
 export type Exam = { id: string; certId: string; year: number; round: string; title: string; durationMinutes: number; passScore: number; questionCount: number };
 export type Cert = { id: string; name: string; category?: string; slug?: string };
 export type Dataset = { certs: Cert[]; subjects: Subject[]; exams: Exam[]; questions: Question[] };
-export type AttemptConfig = { certId: string; certSlug?: string; examIds: string[]; subjectIds: string[]; count: number; order: "ordered" | "random"; target: QuestionTarget; gradeMode: GradeMode; timeLimitMinutes: number | null };
-export type LocalAttempt = { id: string; config: AttemptConfig; questionIds: string[]; answers: Record<string, number>; lockedIds: string[]; startedAt: string; endAt: string | null; submittedAt?: string; status: "in_progress" | "submitted"; score?: number };
+export type AttemptConfig = { mode?: "mock" | "custom" | "past" | "subject"; certId: string; certSlug?: string; examIds: string[]; subjectIds: string[]; count: number; order: "ordered" | "random"; target: QuestionTarget; gradeMode: GradeMode; timeLimitMinutes: number | null };
+export type LocalAttempt = { id: string; config: AttemptConfig; questionIds: string[]; answers: Record<string, number>; lockedIds: string[]; reviewIds?: string[]; practiceNumber?: string; displayNameSnapshot?: string; seed?: string; serverManaged?: boolean; startedAt: string; endAt: string | null; submittedAt?: string; status: "in_progress" | "submitted"; score?: number };
 export type IssueReport = { id: string; questionId: string; attemptId?: string; kind: "wrong_answer" | "broken_image" | "missing_choice" | "other"; memo: string; createdAt: string; status: "open" | "resolved" };
 export type LocalStore = { attempts: LocalAttempt[]; bookmarks: string[]; wrongNotes: Record<string, { wrongCount: number; lastWrongAt: string; memo: string; mastered: boolean }>; presets: { name: string; config: AttemptConfig }[]; imports: ImportBatch[]; issueReports: IssueReport[] };
 export type ImportRow = { id?: string; question_uid?: string; source_uid?: string; exam_id?: string; question_no?: number; subject_id?: string; stem?: string; question?: string; choices?: unknown; answer?: unknown; answer_no?: unknown; images?: unknown; visual_refs?: unknown; visual_assets?: unknown; exam?: string; subject?: string; cert?: string; sourceHash?: string; status?: QuestionStatus; [key: string]: unknown };
@@ -31,6 +31,7 @@ export type ImportBatch = { id: string; remoteId?: string; createdAt: string; fi
 
 export const EMPTY_STORE: LocalStore = { attempts: [], bookmarks: [], wrongNotes: {}, presets: [], imports: [], issueReports: [] };
 export const STORE_KEY = "passmate.cbt-mate.v1";
+export const CBT_PREVIEW_READ_ONLY = process.env.NEXT_PUBLIC_CBT_PREVIEW_READ_ONLY === "1";
 export function readLocalStore(): LocalStore { if (typeof window === "undefined") return EMPTY_STORE; try { return { ...EMPTY_STORE, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") }; } catch { return EMPTY_STORE; } }
 export function writeLocalStore(store: LocalStore) { if (typeof window !== "undefined") { localStorage.setItem(STORE_KEY, JSON.stringify(store)); window.dispatchEvent(new Event("cbt-store")); } }
 export function makeId(prefix: string) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
@@ -38,18 +39,21 @@ export function certCategory(name: string) { return ["산업기사", "기능사"
 export function certSlug(cert: Cert) { return cert.slug || cert.name.trim().replace(/\s+/g, "-"); }
 export function findCert(dataset: Dataset, value: string) { const decoded = decodeURIComponent(value); return dataset.certs.find((cert) => cert.id === decoded || certSlug(cert) === decoded); }
 export function hangulInitials(value: string) { const initials = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"; return Array.from(value).map((char) => { const code = char.charCodeAt(0) - 0xac00; return code >= 0 && code <= 11171 ? initials[Math.floor(code / 588)] : char; }).join(""); }
-export async function submitIssueReport(report: IssueReport) { const supabase = getSupabaseBrowserClient(); await supabase.from("question_bank_issue_reports").insert({ id: report.id, question_id: report.questionId, attempt_id: report.attemptId || null, kind: report.kind, memo: report.memo, status: report.status }); }
+export async function submitIssueReport(report: IssueReport) { if (CBT_PREVIEW_READ_ONLY) throw new Error("테스트 DB 연결이 필요합니다."); const supabase = getSupabaseBrowserClient(); await supabase.from("question_bank_issue_reports").insert({ id: report.id, question_id: report.questionId, attempt_id: report.attemptId || null, kind: report.kind, memo: report.memo, status: report.status }); }
 export async function syncAccountStore(store: LocalStore) {
+  if (CBT_PREVIEW_READ_ONLY) return;
   const supabase = getSupabaseBrowserClient(); const { data } = await supabase.auth.getSession(); const userId = data.session?.user.id; if (!userId) return;
-  for (const attempt of store.attempts.filter((item) => item.status === "in_progress")) {
-    const payload = { user_id: userId, client_id: attempt.id, config: { ...attempt.config, lockedIds: attempt.lockedIds }, question_ids: attempt.questionIds, answers: attempt.answers, started_at: attempt.startedAt, end_at: attempt.endAt, submitted_at: null, score: null, status: "in_progress" };
+  for (const attempt of store.attempts.filter((item) => item.status === "in_progress" && !item.serverManaged)) {
+    const payload = { user_id: userId, client_id: attempt.id, config: { ...attempt.config, lockedIds: attempt.lockedIds, reviewIds: attempt.reviewIds || [] }, question_ids: attempt.questionIds, answers: attempt.answers, started_at: attempt.startedAt, end_at: attempt.endAt, submitted_at: null, score: null, status: "in_progress" };
     const { data: updated } = await supabase.from("question_bank_attempts").update(payload).eq("user_id", userId).eq("client_id", attempt.id).eq("status", "in_progress").select("id");
     if (!updated?.length) await supabase.from("question_bank_attempts").upsert(payload, { onConflict: "user_id,client_id", ignoreDuplicates: true });
   }
   await supabase.from("question_bank_bookmarks").delete().eq("user_id", userId);
   if (store.bookmarks.length) await supabase.from("question_bank_bookmarks").insert(store.bookmarks.map((questionId) => ({ user_id: userId, question_id: questionId })));
-  const notes = Object.entries(store.wrongNotes).map(([questionId, note]) => ({ user_id: userId, question_id: questionId, wrong_count: note.wrongCount, last_wrong_at: note.lastWrongAt, memo: note.memo, mastered: note.mastered }));
+  const serverQuestions = new Set(store.attempts.filter((attempt) => attempt.serverManaged).flatMap((attempt) => attempt.questionIds));
+  const notes = Object.entries(store.wrongNotes).filter(([id]) => !serverQuestions.has(id)).map(([questionId, note]) => ({ user_id: userId, question_id: questionId, wrong_count: note.wrongCount, last_wrong_at: note.lastWrongAt, memo: note.memo, mastered: note.mastered }));
   if (notes.length) await supabase.from("question_bank_wrong_notes").upsert(notes, { onConflict: "user_id,question_id" });
+  for (const [questionId, note] of Object.entries(store.wrongNotes).filter(([id]) => serverQuestions.has(id))) await supabase.from("question_bank_wrong_notes").update({ memo: note.memo, mastered: note.mastered }).eq("user_id", userId).eq("question_id", questionId);
 }
 export async function mergeAccountStore(local: LocalStore): Promise<LocalStore> {
   const supabase = getSupabaseBrowserClient(); const { data } = await supabase.auth.getSession(); const userId = data.session?.user.id; if (!userId) return local;
@@ -58,8 +62,8 @@ export async function mergeAccountStore(local: LocalStore): Promise<LocalStore>
     supabase.from("question_bank_bookmarks").select("question_id").eq("user_id", userId),
     supabase.from("question_bank_wrong_notes").select("question_id,wrong_count,last_wrong_at,memo,mastered").eq("user_id", userId),
   ]);
-  const remoteAttempts: LocalAttempt[] = (attempts.data || []).map((row) => ({ id: row.client_id || row.id, config: row.config as AttemptConfig, questionIds: row.question_ids as string[], answers: row.answers as Record<string, number>, lockedIds: Array.isArray(row.config?.lockedIds) ? row.config.lockedIds : [], startedAt: row.started_at, endAt: row.end_at, submittedAt: row.submitted_at || undefined, score: row.score === null ? undefined : Number(row.score), status: row.status as LocalAttempt["status"] }));
-  const mergedAttempts = [...local.attempts]; for (const attempt of remoteAttempts) { const index = mergedAttempts.findIndex((item) => item.id === attempt.id); if (index < 0) mergedAttempts.push(attempt); else if (attempt.status === "submitted") mergedAttempts[index] = attempt; }
+  const remoteAttempts: LocalAttempt[] = (attempts.data || []).map((row) => ({ id: row.client_id || row.id, config: row.config as AttemptConfig, questionIds: row.question_ids as string[], answers: row.answers as Record<string, number>, lockedIds: Array.isArray(row.config?.lockedIds) ? row.config.lockedIds : [], reviewIds: row.config?.reviewIds || [], practiceNumber: row.config?.practiceNumber, displayNameSnapshot: row.config?.displayNameSnapshot, seed: row.config?.seed, serverManaged: row.config?.serverManaged === true, startedAt: row.started_at, endAt: row.end_at, submittedAt: row.submitted_at || undefined, score: row.score === null ? undefined : Number(row.score), status: row.status as LocalAttempt["status"] }));
+  const mergedAttempts = [...local.attempts]; for (const attempt of remoteAttempts) { const index = mergedAttempts.findIndex((item) => item.id === attempt.id); if (index < 0) mergedAttempts.push(attempt); else if (attempt.status === "submitted" || attempt.serverManaged) mergedAttempts[index] = attempt; }
   const mergedNotes = { ...local.wrongNotes }; for (const row of wrongNotes.data || []) mergedNotes[row.question_id] = { wrongCount: row.wrong_count, lastWrongAt: row.last_wrong_at, memo: row.memo, mastered: row.mastered };
   return { ...local, attempts: mergedAttempts, bookmarks: Array.from(new Set([...local.bookmarks, ...(bookmarks.data || []).map((row) => row.question_id)])), wrongNotes: mergedNotes };
 }
diff --git a/next.config.ts b/next.config.ts
index 9ea1a17..aa1c0c1 100644
--- a/next.config.ts
+++ b/next.config.ts
@@ -1,10 +1,14 @@
 import type { NextConfig } from "next";
 
+const cbtRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fmecqeadghrdisirucqm.supabase.co").hostname.split(".")[0];
+const cbtTestReady = process.env.NEXT_PUBLIC_CBT_SERVER_EXAMS === "1" && process.env.CBT_TEST_PROJECT_REF === cbtRef && cbtRef !== "fmecqeadghrdisirucqm";
+
 const nextConfig: NextConfig = {
   reactStrictMode: true,
   poweredByHeader: false,
   trailingSlash: true,
   images: { unoptimized: true },
+  env: { NEXT_PUBLIC_CBT_PREVIEW_READ_ONLY: process.env.VERCEL_ENV === "preview" && !cbtTestReady ? "1" : "0" },
 };
 
 export default nextConfig;
diff --git a/scripts/validate-cbt-ui.mjs b/scripts/validate-cbt-ui.mjs
index 69ff8c6..7f73ca7 100644
--- a/scripts/validate-cbt-ui.mjs
+++ b/scripts/validate-cbt-ui.mjs
@@ -29,24 +29,30 @@ assert.match(html, /aria-label="12번 문항 ③번 보기"/);
 assert.equal((html.match(/tabindex="0"/g) || []).length, 1);
 const disabled = renderToStaticMarkup(React.createElement(AnswerChoices, { number: 12, selected: 2, disabled: true, onSelect() {} }));
 assert.equal((disabled.match(/disabled=""/g) || []).length, 4);
-const guide = renderToStaticMarkup(React.createElement(MockExamGuide, { name: "수험자", onStart() {} }));
+const guide = renderToStaticMarkup(React.createElement(MockExamGuide, { name: "테스트 이름", practiceNumber: "20261002-01234", date: "2026-10-02", certName: "금속도장기능사", onStart() {} }));
 assert.match(guide, /1\/4/);
 assert.doesNotMatch(guide, /20261001-12345|@/);
+assert.match(guide, /테스트 이름/); assert.match(guide, /20261002-01234/); assert.match(guide, /60문항 · 60분/);
 
 // Render the authenticated list without executing effects or contacting a DB.
 const clientPath = resolve("components/question-bank-client.tsx");
 const clientOutput = ts.transpileModule(readFileSync(clientPath, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
 const client = { exports: {} };
+const helperPath = resolve("lib/cbt-presentation.ts");
+const helperOutput = ts.transpileModule(readFileSync(helperPath, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
+const helpers = { exports: {} };
+new Script(`(function(require,module,exports){${helperOutput}\n})`).runInThisContext()(createRequire(helperPath), helpers, helpers.exports);
 const clientRequire = (name) => {
   if (name === "next/navigation") return { useRouter: () => ({}) };
   if (name === "next/link") return { default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) };
   if (name === "@/components/cbt-exam-ui") return module.exports;
   if (name === "@/components/logo") return { CbtMateLogo: () => null };
   if (name === "@/components/site-header") return { SiteHeader: () => null };
-  if (name.startsWith("@/lib/")) return { certSlug: (cert) => cert.name };
+  if (name === "@/lib/cbt-presentation") return helpers.exports;
+  if (name.startsWith("@/lib/")) return { certSlug: (cert) => cert.name, findCert: (dataset,id) => dataset.certs.find(cert=>cert.id===id) };
   return createRequire(clientPath)(name);
 };
-new Script(`(function(require,module,exports){${clientOutput}\nexports.LearningScreen=LearningScreen;})`).runInThisContext()(clientRequire, client, client.exports);
+new Script(`(function(require,module,exports){${clientOutput}\nexports.LearningScreen=LearningScreen;exports.Records=Records;exports.ExamScreen=ExamScreen;})`).runInThisContext()(clientRequire, client, client.exports);
 const questions = Array.from({ length: 25 }, (_, i) => ({ id: `q${i}`, certId: "test", subjectId: "test", no: i + 1, stem: `검증용 문항 ${i + 1}` }));
 const wrongNotes = Object.fromEntries(questions.map((question) => [question.id, { wrongCount: 3, lastWrongAt: "2026-10-01T00:00:00Z", memo: "", mastered: false }]));
 const list = renderToStaticMarkup(React.createElement(client.exports.LearningScreen, { mode: "wrong-notes", dataset: { certs: [{ id: "test", name: "검증용 종목" }], subjects: [{ id: "test", certId: "test", name: "검증용 과목" }], questions }, store: { attempts: [], bookmarks: [], wrongNotes }, user: {}, authReady: true, saveStore() { throw new Error("Rendering must not write data"); } }));
@@ -55,4 +61,57 @@ assert.equal((list.match(/type="checkbox"/g) || []).length, 20);
 assert.doesNotMatch(list, /<textarea/);
 assert.match(list, /많이 틀린 순/);
 assert.match(list, /20문항 풀기/);
-console.log("CBT UI OK: answer selection/change/deselect, isolation, counters, radio semantics, locked controls, guide identity, 20-row paging, collapsed memos, sort controls; no DB writes");
+const cert = { id: "test", name: "검증용 종목" };
+const record = { id: "attempt-test", config: { certId: "test", mode: "mock", examIds: [] }, questionIds: ["q1"], status: "in_progress", answers: {}, lockedIds: [], startedAt: "2026-10-01T00:00:00Z", endAt: "2026-10-01T00:01:00Z" };
+const unchanged = JSON.stringify(record);
+const records = renderToStaticMarkup(React.createElement(client.exports.Records, { cert, dataset: { exams: [] }, store: { attempts: [record] } }));
+assert.match(records, /시간 만료/); assert.match(records, /결과 저장하기/); assert.doesNotMatch(records, /이어서 풀기/);
+assert.equal(JSON.stringify(record), unchanged, "Expiry rendering cannot mutate records");
+assert.equal(helpers.exports.attemptLabel(record), "모의시험");
+assert.equal(helpers.exports.attemptLabel({ ...record, config: { ...record.config, mode: undefined } }), "이전 시험");
+assert.equal(helpers.exports.expiredAttempt({ ...record, status: "submitted" }), false);
+assert.equal(helpers.exports.expiredAttempt({ ...record, endAt: null }), false);
+assert.equal(helpers.exports.subjectName("금속도장"), "금속도장 작업 및 안전");
+// Render real UI at the three display thresholds; effects/API calls never run.
+const paperQuestions = Array.from({ length: 60 }, (_, i) => ({ id: `q${i}`, certId: "test", examId: "test-round", subjectId: `s${Math.floor(i / 20)}`, no: i + 1, stem: `예시 문제 ${i + 1}`, choices: [0,1,2,3].map(n => ({ label: "①②③④"[n], text: "예시 보기" })), answer: 0, images: [], explanation: "" }));
+const paper = { ...record, config: { ...record.config, gradeMode: "submit" }, questionIds: paperQuestions.map(q => q.id), endAt: new Date(Date.now() + 3600000).toISOString() };
+const fakeDataset = { certs: [cert], exams: [], subjects: ["금속도장재료","금속도장","색채"].map((name,i)=>({ id:`s${i}`,certId:"test",name })), questions: paperQuestions };
+for (const [seconds, klass, text] of [[601, null, null],[600, "is-warning", "10분 남았습니다"],[300, "is-urgent", "5분 남았습니다"]]) {
+  let stateIndex = 0;
+  const mocked = { ...React, useState: value => React.useState(++stateIndex === 2 ? seconds : value) };
+  const clockClient = { exports: {} };
+  new Script(`(function(require,module,exports){${clientOutput}\nexports.ExamScreen=ExamScreen;})`).runInThisContext()(name => name === "react" ? mocked : clientRequire(name), clockClient, clockClient.exports);
+  const screen = renderToStaticMarkup(React.createElement(clockClient.exports.ExamScreen, { dataset: fakeDataset, store: { attempts: [paper], bookmarks: [], wrongNotes: {} }, saveStore() { throw new Error("Render cannot write data"); }, certParam: "test", attemptId: paper.id, user: null, displayName: "테스트 이름" }));
+  if (klass) { assert.match(screen, new RegExp(`cbt-live-timer ${klass}`)); assert.match(screen, new RegExp(text)); }
+  else assert.doesNotMatch(screen, /cbt-live-timer is-warning|cbt-live-timer is-urgent|cbt-time-warning/);
+  assert.match(screen, /연습용 번호 –/); assert.doesNotMatch(screen, /응시 번호 attempt-/);
+}
+const pagePath = resolve("app/cbt/[certSlug]/page.tsx");
+const pageOutput = ts.transpileModule(readFileSync(pagePath, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
+const pageModule = { exports: {} }; let redirectedTo;
+new Script(`(function(require,module,exports){${pageOutput}\n})`).runInThisContext()(name => name === "next/navigation" ? { redirect: url => { redirectedTo = url; throw new Error("test redirect"); } } : name === "@/components/question-bank-client" ? {} : createRequire(pagePath)(name), pageModule, pageModule.exports);
+for (const slug of ["금속도장기능사", encodeURIComponent("금속도장기능사")]) {
+  await assert.rejects(pageModule.exports.default({ params: Promise.resolve({ certSlug: slug }), searchParams: Promise.resolve({ tab: "builder", filter: ["1", "2"] }) }), /test redirect/);
+  assert.equal(redirectedTo, `/cbt/${encodeURIComponent("금속도장기능사")}/?tab=custom&filter=1&filter=2`, "Canonical redirect must not double encode Korean paths");
+}
+const parsedClient = ts.createSourceFile("client.js", clientOutput, ts.ScriptTarget.Latest);
+let leaveCode;
+function findLeave(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === "leave") leaveCode = node.getText(parsedClient); ts.forEachChild(node, findLeave); }
+findLeave(parsedClient);
+assert.ok(leaveCode, "Use the real exit function");
+let releaseSave;
+const exitState = { attempt: {}, cert: {}, pendingAnswers: { current: new Promise(resolve => { releaseSave = resolve; }) }, confirmedExit: { current: false }, question_bank_1: { certSlug: () => "테스트" }, window: { location: { replace: path => { exitState.path = path; } } }, setToast: text => { exitState.toast = text; } };
+const exit = new Script(`(${leaveCode})`).runInNewContext(exitState);
+const waitingExit = exit();
+assert.equal(exitState.path, undefined, "Wait for pending answers before navigating");
+assert.equal(exitState.confirmedExit.current, false);
+releaseSave(); await waitingExit;
+assert.equal(exitState.path, `/cbt/${encodeURIComponent("테스트")}/`);
+assert.equal(exitState.confirmedExit.current, true);
+exitState.path = undefined; exitState.confirmedExit.current = false;
+exitState.pendingAnswers.current = Promise.reject(new Error("save failed"));
+await exit();
+assert.equal(exitState.path, undefined, "Failed saving must keep the user on the exam");
+assert.equal(exitState.confirmedExit.current, false, "Failed saving keeps exit guards active");
+assert.ok(exitState.toast);
+console.log("CBT UI OK: answer selection/change/deselect, isolation, counters, radio semantics, locked controls, guide identity, 20-row paging, collapsed memos, sort controls, confirmed exit waits for saving; no DB writes");
diff --git a/scripts/validate-question-bank-contract.mjs b/scripts/validate-question-bank-contract.mjs
index f5fcc4a..c006280 100644
--- a/scripts/validate-question-bank-contract.mjs
+++ b/scripts/validate-question-bank-contract.mjs
@@ -51,7 +51,7 @@ if (files.submitRoute.includes("function GET") || !files.submitRoute.includes("f
     !files.submitRoute.includes('.eq("status", "in_progress")') ||
     !files.submitRoute.includes('ignoreDuplicates: true') ||
     !files.reportsMigration.includes("question_bank_attempts_user_client_idx") ||
-    !files.library.includes('store.attempts.filter((item) => item.status === "in_progress")') ||
+    !files.library.includes('store.attempts.filter((item) => item.status === "in_progress" && !item.serverManaged)') ||
     files.client.includes("void syncAccountStore(next)")) {
   throw new Error("CBT attempt submission must be confirmation-only and idempotent per attempt ID.");
 }

```

## 테스트 DB SQL 전문

DRAFT migration 다음에 읽기 전용 QA query가 이어진다. 운영 실행 금지.

```sql
-- TEST DATABASE ONLY. Not migration history; no production execution.
-- Operator must first verify project ref, backups and test-only auth users, then:
-- SET app.cbt_test_database = 'true';
begin;
do $$ begin
  if current_setting('app.cbt_test_database', true) is distinct from 'true' then
    raise exception 'Explicit test database confirmation required';
  end if;
end $$;
create schema if not exists cbt_private;
revoke all on schema cbt_private from public, anon, authenticated;
grant usage on schema cbt_private to service_role;
create extension if not exists pgcrypto with schema extensions;
create table cbt_private.number_secret (id boolean primary key default true check (id), secret bytea not null);
insert into cbt_private.number_secret values (true, extensions.gen_random_bytes(32));
create table cbt_private.daily_numbers (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  number integer not null check (number between 0 and 99999),
  primary key (user_id, day), unique (day, number)
);
alter table cbt_private.number_secret enable row level security;
alter table cbt_private.daily_numbers enable row level security;
revoke all on all tables in schema cbt_private from public, anon, authenticated;
grant select on cbt_private.number_secret to service_role;
grant select, insert on cbt_private.daily_numbers to service_role;

-- Ownership SELECT policy already exists in baseline migration. Keep it.
alter table public.question_bank_attempts enable row level security;
revoke all on public.question_bank_attempts from public, anon;
revoke insert, update, delete on public.question_bank_attempts from authenticated;
grant select on public.question_bank_attempts to authenticated;
grant select, insert, update on public.question_bank_attempts to service_role;
grant usage on schema auth, extensions to service_role;
grant select on auth.users, public.profiles, public.question_bank_certs, public.question_bank_exams, public.question_bank_subjects, public.question_bank_questions to service_role;
grant select, insert, update on public.question_bank_wrong_notes to service_role;
create unique index if not exists question_bank_attempts_user_client_idx
  on public.question_bank_attempts(user_id, client_id);

-- SECURITY INVOKER: only verified server service_role can execute. No elevated
-- DEFINER needed; empty search_path and qualified tables/functions in every RPC.
create function public.cbt_prepare_identity(p_user uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  d date := (statement_timestamp() at time zone 'Asia/Seoul')::date;
  n integer; base integer; offset_n integer; key_bytes bytea; name text;
begin
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'Unknown user'; end if;
  -- ponytail: daily allocation serializes briefly; shard locks if volume warrants.
  perform pg_advisory_xact_lock(hashtextextended('cbt-number-' || d::text, 0));
  select number into n from cbt_private.daily_numbers where user_id = p_user and day = d;
  if n is null then
    select secret into strict key_bytes from cbt_private.number_secret where id;
    base := (('x' || substr(encode(extensions.hmac(convert_to(p_user::text || ':' || d::text, 'UTF8'), key_bytes, 'sha256'), 'hex'), 1, 8))::bit(32)::bigint % 100000)::integer;
    -- Open addressing guarantees a free value when fewer than 100,000 exist/day.
    for offset_n in 0..99999 loop
      n := (base + offset_n) % 100000;
      if not exists (select 1 from cbt_private.daily_numbers where day = d and number = n) then
        insert into cbt_private.daily_numbers values (p_user, d, n); exit;
      end if;
      n := null;
    end loop;
    if n is null then raise exception 'Daily number capacity reached'; end if;
  end if;
  select coalesce(nullif(btrim(display_name), ''), '수험자') into name from public.profiles where id = p_user;
  return jsonb_build_object('practiceNumber', to_char(d, 'YYYYMMDD') || '-' || lpad(n::text, 5, '0'), 'displayName', coalesce(name, '수험자'), 'date', d);
end $$;

create function public.cbt_start(p_user uuid, p_cert uuid, p_mode text, p_ids jsonb, p_minutes integer, p_grade text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  ids jsonb := '[]'; picked jsonb; r record; mapped_subject uuid; subjects_count integer;
  seed text := encode(extensions.gen_random_bytes(32), 'hex');
  identity jsonb; a public.question_bank_attempts; cfg jsonb; started timestamptz := clock_timestamp();
  cert_name text; minutes integer := p_minutes; grade text := p_grade; exam_ids jsonb; subject_ids jsonb;
begin
  if p_mode is null or p_grade is null or p_cert is null or p_mode not in ('mock','custom','past','subject') or p_grade not in ('submit','instant')
    or (p_minutes is not null and p_minutes not in (30,60,90)) then raise exception 'Invalid config'; end if;
  select name into strict cert_name from public.question_bank_certs where id = p_cert;
  if p_mode = 'mock' then
    if cert_name <> '금속도장기능사' then raise exception 'Subject mapping not verified'; end if;
    minutes := 60; grade := 'submit';
    for r in select * from (values (1,'금속도장재료','금속도장재료'), (2,'금속도장','금속도장 작업 및 안전'), (3,'색채','색채 및 조색')) as rules(position, internal_name, official_name) order by position loop
      select count(*), (array_agg(id))[1] into subjects_count, mapped_subject from public.question_bank_subjects
        where cert_id = p_cert and name in (r.internal_name, r.official_name);
      if subjects_count <> 1 then raise exception 'Subject mapping ambiguous'; end if;
      select coalesce(jsonb_agg(id order by rank, id), '[]') into picked from (
        select id, md5(seed || id::text) as rank from public.question_bank_questions
        where cert_id = p_cert and subject_id = mapped_subject and status = 'published' and jsonb_array_length(choices)=4 and answer between 0 and 3
        order by rank, id limit 20
      ) q;
      if jsonb_array_length(picked) <> 20 then raise exception 'Need 20 available questions for every subject'; end if;
      ids := ids || picked;
    end loop;
  else
    if jsonb_typeof(p_ids) is distinct from 'array' or jsonb_array_length(p_ids) not between 1 and 120 then raise exception 'Invalid question IDs'; end if;
    ids := p_ids;
  end if;
  if (select count(distinct value) from jsonb_array_elements_text(ids)) <> jsonb_array_length(ids)
    or (select count(*) from public.question_bank_questions where id in (select value::uuid from jsonb_array_elements_text(ids)) and cert_id=p_cert and status='published') <> jsonb_array_length(ids)
    then raise exception 'Duplicate or unavailable questions'; end if;
  select jsonb_agg(distinct exam_id), jsonb_agg(distinct subject_id) into exam_ids, subject_ids
    from public.question_bank_questions where id in (select value::uuid from jsonb_array_elements_text(ids));
  if p_mode = 'past' then
    if jsonb_array_length(exam_ids) <> 1 then raise exception 'Past exam must use one round'; end if;
    select duration_minutes into minutes from public.question_bank_exams where id = (exam_ids->>0)::uuid;
  end if;
  identity := public.cbt_prepare_identity(p_user);
  started := clock_timestamp();
  cfg := jsonb_build_object('mode',p_mode,'certId',p_cert,'certSlug',cert_name,'examIds',exam_ids,'subjectIds',subject_ids,
    'count',jsonb_array_length(ids),'order','ordered','target','all','gradeMode',grade,'timeLimitMinutes',minutes,
    'seed',seed,'practiceNumber',identity->>'practiceNumber','displayNameSnapshot',identity->>'displayName',
    'serverManaged',true,'reviewIds','[]'::jsonb,'lockedIds','[]'::jsonb);
  insert into public.question_bank_attempts(user_id,client_id,config,question_ids,answers,started_at,end_at,status)
    values(p_user,'managed-' || gen_random_uuid()::text,cfg,ids,'{}',started,case when minutes is null then null else started+make_interval(mins=>minutes) end,'in_progress') returning * into a;
  return to_jsonb(a) - 'user_id';
end $$;

create function public.cbt_answer(p_user uuid, p_attempt text, p_question uuid, p_choice integer, p_review boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.question_bank_attempts; next_answers jsonb; reviews jsonb; locked jsonb;
begin
  select * into strict a from public.question_bank_attempts where user_id=p_user and client_id=p_attempt for update;
  if a.config->>'serverManaged' <> 'true' or a.status <> 'in_progress' or (a.end_at is not null and clock_timestamp() >= a.end_at)
    or not (a.question_ids ? p_question::text) or (p_choice is not null and (p_choice not between 0 and 3 or p_choice >= (select jsonb_array_length(choices) from public.question_bank_questions where id=p_question))) then raise exception 'Attempt closed or invalid answer'; end if;
  next_answers := a.answers; reviews := coalesce(a.config->'reviewIds','[]'); locked := coalesce(a.config->'lockedIds','[]');
  if p_review is not null then
    reviews := reviews - p_question::text;
    if p_review then reviews := reviews || jsonb_build_array(p_question::text); end if;
  else
    if locked ? p_question::text then raise exception 'Answer locked'; end if;
    next_answers := next_answers - p_question::text;
    if p_choice is not null then
      next_answers := next_answers || jsonb_build_object(p_question::text,p_choice);
      if a.config->>'gradeMode' = 'instant' then locked := locked || jsonb_build_array(p_question::text); end if;
    end if;
  end if;
  update public.question_bank_attempts set answers=next_answers, config=a.config || jsonb_build_object('reviewIds',reviews,'lockedIds',locked)
    where id=a.id and status='in_progress' returning * into a;
  return to_jsonb(a) - 'user_id';
end $$;

create function public.cbt_submit(p_user uuid, p_attempt text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare a public.question_bank_attempts; already boolean; right_count integer; result_score numeric;
begin
  select * into strict a from public.question_bank_attempts where user_id=p_user and client_id=p_attempt for update;
  if a.config->>'serverManaged' <> 'true' then raise exception 'Not server managed'; end if;
  already := a.status = 'submitted';
  if not already then
    select count(*) into right_count from public.question_bank_questions q
      where a.question_ids ? q.id::text and a.answers->>q.id::text = q.answer::text;
    result_score := round(100.0 * right_count / jsonb_array_length(a.question_ids));
    update public.question_bank_attempts set status='submitted', submitted_at=clock_timestamp(), score=result_score
      where id=a.id and status='in_progress' returning * into a;
    insert into public.question_bank_wrong_notes(user_id,question_id,wrong_count,last_wrong_at,memo,mastered)
      select p_user,q.id,1,a.submitted_at,'',false from public.question_bank_questions q
      where a.question_ids ? q.id::text and (a.answers->>q.id::text is distinct from q.answer::text)
      on conflict(user_id,question_id) do update set wrong_count=public.question_bank_wrong_notes.wrong_count+1,last_wrong_at=excluded.last_wrong_at,mastered=false;
  end if;
  return jsonb_build_object('answers',a.answers,'submittedAt',a.submitted_at,'score',a.score,'alreadySubmitted',already);
end $$;

revoke all on function public.cbt_prepare_identity(uuid), public.cbt_start(uuid,uuid,text,jsonb,integer,text), public.cbt_answer(uuid,text,uuid,integer,boolean), public.cbt_submit(uuid,text) from public, anon, authenticated;
grant execute on function public.cbt_prepare_identity(uuid), public.cbt_start(uuid,uuid,text,jsonb,integer,text), public.cbt_answer(uuid,text,uuid,integer,boolean), public.cbt_submit(uuid,text) to service_role;
-- No new schema is needed for #13/#19/#20: end_at, answers, stored IDs and
-- config.reviewIds suffice. GET renders expiry and warnings; only POST submits.
commit;
-- READ-ONLY catalog checks; do not open production in_progress attempts.
-- Connection/project ref must be independently verified before execution.
-- 19 * 60 = 1,140, while stated inventory is 1,138; at least two missing
-- occurrences must be located. Fixed mock sampling does not require each round
-- to have 20 questions, only a verified mapping and >=20 available per subject.
select e.year, e.round, s.name, count(q.id)::int as available
from public.question_bank_exams e
join public.question_bank_certs c on c.id=e.cert_id
join public.question_bank_subjects s on s.cert_id=c.id
left join public.question_bank_questions q on q.exam_id=e.id and q.subject_id=s.id and q.status='published'
where c.name='금속도장기능사'
group by e.id,e.year,e.round,s.id,s.name
order by e.year desc,e.round,s.part_number,s.name;

-- TEST DB ONLY. Fill the temporary test attempt ID. No updates in this file.
-- Before/after GET, browser reload and expired record display: compare all fields.
select client_id,status,question_ids,answers,config->>'seed' as seed,
  config->>'practiceNumber' as practice_number,started_at,end_at,submitted_at,score
from public.question_bank_attempts
where client_id = 'REPLACE_WITH_TEST_ATTEMPT_ID';

-- Exactly one row; two final submit responses must retain identical score,
-- submittedAt and answers. Second RPC response has alreadySubmitted=true.
select client_id,count(*),min(score),max(score),min(submitted_at),max(submitted_at)
from public.question_bank_attempts where client_id='REPLACE_WITH_TEST_ATTEMPT_ID'
group by client_id;

-- Internal QA: daily number uniqueness; service_role/admin only.
select day,count(*) as registered,count(distinct number) as unique_numbers
from cbt_private.daily_numbers group by day;

-- RPC/table grants: all client-write/execute columns must be false.
select has_table_privilege('authenticated','public.question_bank_attempts','UPDATE') as client_update,
  has_table_privilege('authenticated','public.question_bank_attempts','INSERT') as client_insert,
  has_function_privilege('authenticated','public.cbt_start(uuid,uuid,text,jsonb,integer,text)','EXECUTE') as client_start,
  has_function_privilege('anon','public.cbt_submit(uuid,text)','EXECUTE') as anon_submit;

-- All functions fix search_path; they intentionally use SECURITY INVOKER.
select proname,prosecdef,proconfig from pg_proc
where oid in ('public.cbt_start(uuid,uuid,text,jsonb,integer,text)'::regprocedure,
  'public.cbt_answer(uuid,text,uuid,integer,boolean)'::regprocedure,
  'public.cbt_submit(uuid,text)'::regprocedure,
  'public.cbt_prepare_identity(uuid)'::regprocedure);

```
