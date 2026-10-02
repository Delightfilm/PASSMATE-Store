# CBT 후속 재검토 7개 항목

기준: cbff750 이후, 2026-10-03. 실제 Next.js/API와 **테스트 DB 전용 DRAFT**를 수정했다. 운영 DB 적용·main 병합은 하지 않았다. 기존 9개 보고서의 시작 RPC/권한/롤아웃 지침은 이 문서와 CBT_MERGE_GATE.md로 대체한다. 현재 SQL 전문은 cbt-test-migration.DRAFT.sql이며 이전 보고서의 SQL은 당시 기록이다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| app/api/cbt/attempts/start/route.ts | clientId UUID 검증·RPC 전달 |
| components/question-bank-client.tsx | 즉시 중복 클릭 가드, sessionStorage 시작 UUID 재시도, 응시 목록 중복 제거, 다른 기기 안내 |
| .env.example | 앱+DB 이중 활성화 조건 설명; 기본값 그대로 OFF |
| docs/cbt-test-migration.DRAFT.sql | 시작 키/별칭·계정 잠금, DB 스위치, 구성표 SELECT 전용 |
| docs/cbt-test-qa.sql | 7인자 start 권한/서명 검사 |
| docs/cbt-missing-questions.READONLY.sql | 읽기 전용 실행·해석표·수입/공개 집계 출처 검사 |
| scripts/validate-cbt-test-db.mjs | absent/false 가드, 동일·별칭 키, 구성 권한, SELECT 전용 진단 SQL 검사 |
| scripts/validate-cbt-two-connections.mjs | 실제 두 연결의 같은/다른 시작 키 경합·재시도, 기존 제출/RLS 검사 |
| scripts/validate-cbt-local-concurrency.mjs | 폐기 가능한 로컬 QA DB에서 스위치 명시 활성화 |
| scripts/validate-cbt-ui.mjs | 실제 시작 핸들러 더블클릭/응답 유실/재로드·중복 제거, 안내 문구 |
| docs/CBT_7_REVIEW.md, docs/CBT_MERGE_GATE.md | 전후 코드·PR 분리 판단·병합/롤백 절차 |
| docs/CBT_9_REVIEW.md, docs/STATUS.md | 역사 문서와 현재 상태 구분 |

## 1. cbt_start 멱등성

원인: 서버에서 매번 임의 client_id를 만들고 클라이언트의 시작 요청을 식별하지 않았다. 상태 기반 버튼 비활성만으로는 같은 프레임의 더블클릭·응답 유실·두 탭을 막지 못한다.

정책: **같은 계정·종목의 미만료 서버 모의시험을 재사용**한다. 같은 요청 키는 만료·제출 후에도 그 응시를 반환한다. 다른 종목/로컬 응시와 키가 충돌하면 409. 새 키로 시작할 때 만료/완료 행만 있다면 새 응시를 만든다. 이전부터 활성 응시가 여러 건이면 started_at DESC, id 순의 한 건을 재사용하고 기존 행을 수정/삭제하지 않는다.

전:

```tsx
// 요청에는 시작 키가 없음
await cbtPost('/api/cbt/attempts/start/', { certId, mode: 'mock', questionIds: [], gradeMode: 'submit' });
// SQL: 매번 새 client_id, 재시도마다 새 응시
// values(p_user, 'managed-' || gen_random_uuid()::text, ...)
```

후 — 실제 구현의 핵심:

```tsx
const mockStart = useRef({ busy: false, key: '', clientId: '' });
// busy는 요청 전에 동기적으로 설정. UUID는 계정·종목별 sessionStorage에 보관.
// 실패 시 유지, 성공적으로 로컬에 저장한 뒤 제거. 저장 불가 시 같은 화면의 ref로 재시도.
const row = await cbtPost('/api/cbt/attempts/start/', {
  certId: cert.id, clientId: mockStart.current.clientId,
  mode: 'mock', questionIds: [], gradeMode: 'submit'
});
saveStore({ ...latest, attempts: [attempt, ...latest.attempts.filter(item => item.id !== attempt.id)] });
```

API는 certId/clientId 모두 문자열·UUID를 검증하고 `p_client_id`로 전달한다. 브라우저 clientId는 crypto.randomUUID()이며 내부 응시 UUID·수험자 번호와 구별한다.

```sql
-- 기존 attempts.client_id TEXT는 로컬 호환 때문에 유지; 서버 키는 UUID 인자.
create unique index if not exists question_bank_attempts_user_client_idx
  on public.question_bank_attempts(user_id,client_id);
create table cbt_private.start_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  attempt_id uuid not null references public.question_bank_attempts(id) on delete cascade,
  primary key(user_id,client_id)
);
perform pg_advisory_xact_lock(hashtextextended('cbt-start:' || p_user::text,0));
-- 1. 저장된 요청 키 → 기존 응시 반환(문항·답·seed·시간·상태 불변)
-- 2. 미만료 진행 중 mock → 키를 기존 응시에 연결한 뒤 반환
-- 3. 없으면 published 구성으로 출제, attempts + start_requests를 같은 트랜잭션에 INSERT
```

별칭 표가 필요한 이유: 다른 탭의 새 UUID로 기존 응시를 반환한 직후 응답을 잃었을 때, 그 키도 기억해야 만료 후 재시도가 새 응시를 만들지 않는다. 응시 행을 바꾸지 않고 키만 연결한다. 서비스에는 이 표 SELECT/INSERT만 부여하고 외부 클라이언트 접근은 차단한다. 키는 임의로 정리하지 않는다(관리자 응시 삭제 시 FK cascade).

계정별 advisory transaction lock은 시작만 직렬화한다. 다른 계정·기존 답 저장은 이 잠금 때문에 막히지 않는다. 답/제출의 기존 FOR UPDATE는 유지한다. 이전 6인자 cbt_start는 제거하여 키 없는 우회 시작을 허용하지 않는다. 이미 이전 DRAFT를 적용한 테스트 프로젝트는 재실행용 SQL이 아니므로 폐기/재구축하거나 별도 검토된 ALTER 마이그레이션이 필요하다.

| 케이스 | 절차 | 기대 / 실행 상태 |
|---|---|---|
| 더블클릭 | 시작 확정 두 번, 첫 POST 아직 대기 | POST 1회·UUID 1개. 실제 핸들러 제어 테스트 통과; 실제 Preview 미실행 |
| 응답 유실 | DB에 시작 커밋 후 응답을 폐기, 같은 키로 재시도 | 같은 전체 행·seed·end_at. 로컬 DB/핸들러 통과; 실제 Preview 미실행 |
| 새로고침 재시도 | 실패 뒤 재로드하고 다시 확정 | sessionStorage UUID 재사용. 핸들러의 재로드 상태 모사 통과; 실제 Preview 미실행 |
| 두 연결 동일 키 | A 트랜잭션 미커밋 중 B 호출 | B 잠금 대기 → A/B 같은 행. 실제 로컬 PostgreSQL 두 연결 통과 |
| 두 탭 상이 키 | 서로 다른 UUID로 같은 계정·종목 동시 시작 | 응시 1건·두 키가 같은 응시에 연결. 로컬 두 연결 통과; 브라우저 두 탭 미실행 |
| 별칭 키 재시도 | 반환된 응시 만료/제출 후 같은 별칭 재요청 | 원래 응시 반환. 로컬 통과 |
| 키 충돌/무효 | 다른 종목과 같은 키, UUID 누락/무효 | 각각 409/422. DB 충돌/NULL·API 타입 검사 구현, 로컬 DB 통과 |

## 2. DB 활성화 가드

전: 앱 ref 허용 목록만 검사했다. cbt_private.test_environment는 QA 도구의 운영 실행 방지 표식이지 RPC 활성화 가드가 아니었다.

후:

```sql
create table cbt_private.server_exams (
  id boolean primary key default true check(id),
  enabled boolean not null default false
);
insert into cbt_private.server_exams values(true,false);
revoke all on cbt_private.server_exams from public,anon,authenticated,service_role;
grant select on cbt_private.server_exams to service_role;
-- SECURITY INVOKER / search_path=''인 공용 private 검사 함수
if not exists(select 1 from cbt_private.server_exams where id and enabled) then
  raise exception using errcode='PT409', message='Server exams disabled';
end if;
-- cbt_start / cbt_answer / cbt_submit / cbt_prepare_identity의 첫 단계
perform cbt_private.require_server_exams();
```

표식 행 없음·false 모두 거부한다. identity도 차단하여 비활성 상태에서 수험자 번호를 새로 할당하지 않는다. 함수 EXECUTE/스키마 USAGE는 서비스에만 허용; 표식은 SELECT만 가능하다. 활성화는 관리자 SQL로 하며 앱·브라우저·service_role는 수정할 수 없다. 앱은 기존 `CBT_SERVER_PROJECT_REFS` 정확한 URL/ref 검사를 계속 한다.

| 앱 ref/secret | 시작 플래그 | DB 표식 | 신규 시작 | 기존 서버 답 저장/제출 |
|---|---|---|---|---|
| 비허용/없음 | 무관 | 무관 | 차단 | 차단 |
| 허용/있음 | 0 | true | 차단 | 허용(응시 상태 조건 적용) |
| 허용/있음 | 1 | absent 또는 false | 차단 | 차단 |
| 허용/있음 | 1 | true | published 구성·풀 검증 후 허용 | 응시 상태 조건 적용 |

DB 가드는 인증 실패보다 뒤의 RPC 단계이며, 인증/API 오류는 기존 한국어 상태별 응답을 유지한다. marker 때문에 모든 RPC가 차단되는 경우 409를 반환하고 GET으로 상태를 변경하지 않는다.

## 3. 구성표는 앱에서 읽기만

전:

```sql
grant insert,update,delete on public.question_bank_mock_configs,
  public.question_bank_mock_subjects to service_role;
```

후:

```sql
revoke all on public.question_bank_mock_configs, public.question_bank_mock_subjects
  from public,anon,authenticated,service_role;
grant select on public.question_bank_mock_configs, public.question_bank_mock_subjects
  to anon,authenticated,service_role;
revoke insert,update,delete on public.question_bank_mock_configs,
  public.question_bank_mock_subjects from service_role;
```

기본 권한에 TRUNCATE 등이 남지 않게 ALL 회수 후 SELECT만 부여했다. anon/authenticated SELECT는 기존 published RLS를 적용한다. RPC에서 서비스로 구성을 읽는 동작은 유지한다.

구성 변경 절차: 검토된 마이그레이션 또는 Supabase 관리자 SQL 콘솔의 관리자 연결 → 종목 UUID 확인 → draft 상태에서 공식 과목명/내부 매핑/시간/합격 기준·유효 풀 검증 → 같은 트랜잭션으로 subjects 수정·published 전환 → QA. 기존 응시는 시작 시 저장한 config/question_ids를 유지한다. PASSMATE 관리자 UI에 구성 편집 화면이 있다고 확인되지 않았으며 새 UI를 만들지 않았다. 앱 service key를 편집 도구로 사용하지 않는다.

## 4. PR1 / PR2 분리 판단

**분리 가능하지만 현재 PR15의 파일을 통째로 나누는 방식은 불가.** 두 큰 공용 파일과 QA 스크립트에 UI·서버 변경이 섞여 있어 hunk 단위로 재구성해야 한다. 현재는 기존 Draft PR15를 갱신했고 PR1/PR2를 새로 생성·병합하지 않았다.

| 파일/그룹 | PR1 UI | PR2 서버 | 분리 시 의존/처리 |
|---|---|---|---|
| app/globals.css | 전체 | 없음 | 1100px 메뉴 공백, 답안지/시트·탭 포커스, 모바일 고정 바·레이아웃 |
| components/cbt-exam-ui.tsx | 전체 | 없음 | 안내는 props로 표현; identity RPC 호출 없음. PR1은 번호 미할당을 정직하게 표시 |
| components/auth-nav.tsx | 전체 | 없음 | 만료 응시 이어서 풀기 제외·CBT 이메일 비표시, presentation 헬퍼 필요 |
| app/cbt/[certSlug]/page.tsx | 전체 | 없음 | builder→custom 주소 정리·메타데이터, DB 의존 없음 |
| lib/cbt-presentation.ts | 전체 | 없음 | 라벨·7일 로컬 열람·탭 스크롤; 필요한 optional 로컬 타입 함께 포함 |
| components/question-bank-client.tsx | 헤더/시트/키보드/번호판/안내 높이/맞춤 칩/기록/오답 행의 로컬 동작 | prepareMock/beginMock 서버 경로, 시작 키, 서버 큐·submit 분기 | 같은 파일의 JSX/상태/콜백을 분리. PR1에 서버 imports/조건이 남으면 독립 불가 |
| lib/question-bank.ts | mode/reviewIds 등 UI에서 쓰는 optional 로컬 필드·기존 JSON 동기화 호환 | mockConfigs DB 조회, serverManaged/seed/identity, 낙관 답 병합·서버 응시 sync 제외, Preview 서버 가드 | PR1은 기존 catalog 쿼리만 유지. 새 구성표 없어도 동작해야 함. 전체 파일 cherry-pick 금지 |
| lib/cbt-answer-queue.ts | 없음 | 전체 | RPC ACK·롤백·제출 전 flush가 있는 서버 저장 전용 |
| lib/cbt-server-client.ts, lib/cbt-server-config.ts, lib/cbt-test-server.ts | 없음 | 전체 | 서버 활성화·허용 목록·API·행 변환 |
| app/api/cbt/identity 및 attempts start/answer/submit | 없음 | 전체 | DB RPC 의존 |
| next.config.ts, .env.example | 기존 main 설정 유지 | 이번 변경 전체 | PR1은 서버 연결 없이 기존 로컬 시작·동기화 유지 가능 |
| DRAFT/DB QA/두 연결 스크립트, cbt-test-qa.sql | 없음 | 전체 | PR2 전용 테스트 DB 게이트 |
| cbt-missing-questions.READONLY.sql | 별도 읽기 전용 문서로 가능 | PR2 문서에 포함 권장 | 실행은 별도 관리자 승인/읽기 전용 연결; PR 배포로 자동 실행 안 됨 |
| scripts/validate-cbt-ui.mjs | UI/로컬 반응형·라디오·안내·기록 검사 | 큐/서버 오류·허용 목록·start 핸들러 검사 | imports도 함께 분리해야 PR1의 check가 통과 |
| scripts/validate-question-bank-contract.mjs | custom 주소 검사 변경 | 없음 | 라우트 이름과 동시에 적용 |
| 보고서들·STATUS | 각 PR의 실제 상태 기록 | 서버 검증·롤아웃 기록 | 계획/실행/운영을 구별 |

공용 파일은 결합돼 있지만 기술적으로 분리 불가능한 의존은 없다. 최소 optional 타입과 로컬 저장 콜백을 같이 가져가면 UI를 독립시킬 수 있다. 지금 파일 그대로 복사하면 서버 imports, mockConfig, 큐, Preview 가드 때문에 PR1에 서버 의존이 남는다.

### PR1의 모의시험 동작 선택

main의 실제 beginMock은 종목 전체 풀에서 무작위 최대 60개를 골라 **기존 로컬 begin(..., submit, 60, true)**으로 시작한다. 과목별 20개를 보장하지 않으며 config.mode도 없었다.

| 선택 | 장점 | 단점·사용자 영향 | 구현 범위 |
|---|---|---|---|
| A. 기존 로컬 시작 + 정직한 안내 | 현재 이용 기능 유지, UI 먼저 배포 가능 | 서버 고정 비율 시험과 구별해야 함. 안내: ‘자유 출제 연습입니다. 과목별 문항 비율은 보장되지 않습니다.’ 구성에 20/20/20 확정값·할당된 연습 번호를 표시하지 않음 | main 로컬 beginMock 유지, mode/라벨·구성 카드 설명 수정. 새 RPC/SQL/환경 의존 제거; 실제 공개 풀·총 문항 수로 표시 |
| B. 모의시험 ‘준비 중’ | 검증 전 실전 모의시험으로 오해할 여지 감소, 서버 경로와 개념 일치 | PR1만 병합하면 기존 모의시험 시작 기능을 잃음. 맞춤 시험지/기출은 유지 | 서버 없이 준비 중 카드·비활성 버튼. 서버 imports/구성표 조회 제거; 기존 로컬 mock 시작 제거 |
| 현재 통합 PR을 준비 후 병합 | 사용자에게 준비 중 기간 없이 검증된 서버 시험 제공 | 테스트 DB 준비까지 UI 변경도 함께 대기 | 현 Draft 유지, 병합 게이트 충족 후 전체 검토 |

UI 선행 배포가 목표라면 **A 권장**, 서버 모의시험만 제공하려면 현재 통합 PR 대기 유지 권장. A/B 중 실제 분리 PR에 적용할 정책은 **[결정 필요]**다. 앞선 ‘서버 준비 후 병합’ 방침은 이번 판단표만으로 해제하지 않았다.

### PR1만 먼저 병합하면 노출되는 변화(A 선택 가정)

1. 901–1100px에서 CBT 하단 내비 노출, 모바일 탭 자동 스크롤/끝 힌트.
2. 응시 상단 표시 이름·내부 ID 비표시, compact 답안지·과목 탭·행 선택/키보드/시트 포커스, 보기 설정·스트립 정렬.
3. 모바일 이전/답안지/다음 고정 바, 저장 토스트 수명, 경고/제출 점검·메뉴 액션 구분.
4. 맞춤 시험지 칩 연한 선택색·체크/선택 수·전체 해제/최근 5회, 수량 UI·카드 배치.
5. 기록 유형/상태/만료·7일 접기·로컬 숨김, 내부 응시 ID 제거, 오답 ‘다시 풀기’ 버튼 위계.
6. 안내 단계 높이 안정화, 표시 이름, 로컬 모의시험의 비율 미보장 안내. 서버 수험자 번호/고정 과목별 출제/DB 가드/새 API는 노출 안 됨.

이 목록은 **분리 시 적용할 범위**이며 PR1이 이미 운영에 병합됐다는 뜻이 아니다. B 선택이면 6번의 로컬 시작 대신 준비 중이 노출된다. PR1의 기기별 QA·기존 로컬 동기화/제출 회귀 검증도 별도로 해야 한다.

## 5. 오래된 기록의 기기 한계

전:

```text
이 브라우저에서 7일 이상 열지 않은 기록입니다. 열람 정보가 없으면 시작일을 기준으로 표시합니다.
```

후:

```text
이 브라우저에서 7일 이상 열지 않은 기록입니다. 열람 정보가 없으면 시작일을 기준으로 표시합니다. 다른 기기에서 학습한 기록은 이 기준과 다를 수 있습니다.
```

7일 문구·계산을 유지했다. 기존 문장에는 다른 기기의 오차가 명시되지 않았으므로 한 문장을 보완했다. 기록 접기/숨김/열람 시각은 로컬 표시이며 DB 응시 삭제·자동 만료/제출을 만들지 않는다. SSR로 추가 문구와 기존 7일 경계 검사 통과.

## 6. 누락 문항 진단 / 58문항 출처

전: SELECT 진단은 있었지만 실행 주의·해석표가 부족했고 batch.metadata 전체를 노출했다.

후: cbt-missing-questions.READONLY.sql에 읽기 전용 연결 안내·케이스별 조치·수입/공개 집계 provenance를 추가했다. 원문·보기·정답·해설·응시·사용자 ID·자산 URL·감사 detail 전체는 출력하지 않는다. metadata/detail은 expected_questions/row_count/error_count/published_questions 등의 필요한 키만 조회한다.

```sql
begin read only;
-- 수입 원본 기준이 아니라, 현재 공개 개수와 저장된 값을 비교
select e.question_count as stored_question_count,
  count(q.id) filter(where q.status='published')::int as visible_published_rows
from public.question_bank_exams e
left join public.question_bank_questions q on q.exam_id=e.id
where e.id='7e0f9af1-f77a-4986-bb8a-e2ee2a9d001b'::uuid
group by e.id;
-- 실제 파일에는 번호/상태/수입 batch/source UID/page/자산 수,
-- batch expected_questions 및 감사 start_import/finish_import/publish_batch 조회 포함
commit;
```

### 관리자 실행

1. 연결 대상·프로젝트 ref를 독립 확인하고 조회 전용 역할/연결을 사용. SQL 콘솔의 관리자 권한을 쓰더라도 BEGIN READ ONLY 안에서 실행한다. RLS로 제한된 역할은 없는 행과 숨긴 행을 구분할 수 없으므로 필요한 catalog SELECT 정책/권한을 따로 확인한다.
2. SQL 전문에 SELECT/CTE 및 읽기 전용 트랜잭션 제어만 있는지 검토. 쓰기 RPC 호출·응시 조회·원문/정답 컬럼이 없어야 한다. 선택적으로 연결 옵션에 default_transaction_read_only=on, statement_timeout=15s를 설정.
3. 결과는 공개 문항 수·상태·source UID/page/batch/자산 개수로 해석. 파일명/source IDs는 내부 데이터로 취급하며 자격 증명과 원본 파일을 공유하지 않는다.
4. 실제 운영 실행은 **미실행**. 원본 NAS/수입 오류 로그 확인 및 문항 복구도 **미실행**.

| 결과 형식 / 상황 | 해석 | 다음 조치 |
|---|---|---|
| no=12/43, visible_rows=0 | 읽기 역할 RLS 또는 DB 미존재 | 관리자 catalog SELECT로 구별; source manifest·수입 오류 로그 확인 |
| status=draft/needs_review 등 | 비공개 행이 존재 | 원문/자산 검수, 별도 복구 PR. 공개로 강제 변경 금지 |
| batch/source UID/page 있음 | 출처 추적 가능 | 해당 NAS 원본 페이지·batch 파서 로그 대조 |
| 이미지/visual_asset_count>0 또는 needs_visual_review | 검토 단서, 누락 원인 확정 아님 | 자산 누락/변환 오류를 원본과 비교 |
| 번호가 공개 중복 | 중복 수입 가능성 | source UID 기반으로 대조, 별도 수정 |
| batch expected=60, row_count=58, error_count>0 | 파싱/검증 손실 가능성 | batch는 종목 전체일 수도 있으므로 회차별 원본/로그로 확인 |
| stored_count=58, published_rows=58 | 현재 집계는 일치 | 원본이 58개였다고 결론 내리지 않음 |
| stored_count와 published_rows 불일치 | RLS·집계 시점/상태 차이 가능 | 관리자 SELECT 및 공개 감사 이력 검토 |

코드에서 확인한 사실: `question-bank-admin`의 start_import는 exam.question_count를 넣지 않는다. `20260930003531_cbt_mate_question_bank_runtime.sql`의 question_bank_publish_batch는 **현재 published 문항을 회차별로 다시 세어** question_count/updated_at을 갱신하며 다른 batch 공개에도 영향을 줄 수 있다. 따라서 58은 불변 수입 스냅샷이 아니다. 실제 운영 함수가 같은지 확인하는 SELECT(boolean 결과), batch expected·finish/publish 감사 로그·exam timestamps를 추가했다. 원본 60개였는지와 12/43번의 누락 원인은 **[확인 필요]**다. 원본 스냅샷/감사 로그가 없으면 타임스탬프만으로 확정하지 않는다.

총 1,138개의 공개 풀에서 각 과목 유효 문항이 20개 이상이면 무작위 20/20/20 모의시험은 이 두 회차 누락만으로 막히지 않는다. 해당 회차 기출은 58개라는 실제 수를 보여야 하며 가짜 문항을 채우지 않는다. 구성표 출제 풀 검증은 별도로 유지한다.

## 7. 병합 게이트 / 롤아웃 / 롤백

한 장 체크리스트는 **CBT_MERGE_GATE.md**. 순서는 테스트 프로젝트 → DRAFT → UUID 시드·구성 published → Preview 환경과 DB true → Slow 3G 8케이스 → 두 연결/두 탭/Auth·REST → 운영 허용 목록 승인이다.

| 단계 | 앱 설정 | DB 설정 | 조치 / rollback |
|---|---|---|---|
| 기본/Draft | refs 빈 값·start=0 | absent 또는 false | 운영 서버 시험 차단. 기존 운영 main 유지 |
| 테스트 준비 | 정확한 test ref·서버 secret, start=0 | 최신 DRAFT/UUID 시드, published; marker=false | admin만 구성 수정, 쓰기 앱 권한 없음 |
| 테스트 활성 | test ref 허용, start=1, 새 Preview 배포 | admin이 marker=true | 둘 다 있어야 RPC 동작. hosted 게이트 검증 |
| 병합 심사 | Preview의 모두 통과 증거 | 시드/권한/풀 검증 증거 | 증거 부족이면 Draft 유지; PR1 분리 정책 별도 결정 |
| 운영 준비/승인 | 승인된 운영 ref·secret, start=0 | 별도 검토된 운영 마이그레이션·백업, marker=false | DRAFT를 운영에 직접 실행하지 않음; API 7인자와 DB를 start OFF에서 맞춤 |
| 운영 mock 활성 | 운영 ref 허용, start=1 재배포 | 관리자 승인 marker=true | mock만 시작; custom/past/subject 서버 전환은 별도 PR |
| 정상 중단 | start=0, refs/secret 유지 | true 유지 | 신규만 중단, 기존 저장/제출 유지 |
| 비상 전면 중단 | ref 제거 또는 서버 접근 차단 | false/표식 제거 | 답 저장/제출도 실패. 수험생 안내·미저장 답 보존 후 관리자 판단 |

롤백 시 이전 6인자 시작 RPC나 임의 client_id 발급으로 되돌리면 멱등성이 사라진다. 시작 OFF로 먼저 중단하고, 진행 중 서버 응시가 있다면 7인자/별칭 표·answer/submit 호환 버전을 유지한다. 활성 응시가 끝나기 전 테이블 삭제/legacy 로컬 제출로 강제 전환 금지. DELETE 권한·관리 행 RLS·구성표 앱 쓰기 권한은 롤백에도 다시 열지 않는다. 미적용 테스트 DRAFT 수정은 Git revert 가능하며 이미 적용한 테스트 DB는 폐기/재구축 또는 검토된 후속 마이그레이션을 쓴다. UI PR1은 독립 commit revert가 가능하도록 분리한 뒤 병합한다.

### 실제 검증 결과

| 검증 | 결과 |
|---|---|
| 실제 시작 핸들러: 더블클릭·실패/재로드 UUID·로컬 dedupe | 통과 — 네트워크를 제어한 로컬 검사 |
| PGlite: DB absent/false 차단·활성 행 무변경·100회 20/20/20·멱등·RLS·최소 권한 | 통과 — 실제 운영 데이터 없음 |
| native PostgreSQL 18.4 실제 두 연결: 시작/제출 잠금 대기·동일/별칭 키·최초 결과·RLS | 통과 — 폐기 가능한 로컬 DB |
| 기존 큐: 1→4 연타·문항별 병렬·ACK·롤백·flush / UI·7일·한국어 오류·허용 목록 | 통과 |
| 읽기 전용 진단 SQL 문법·SELECT-only·원문/정답 컬럼 배제 | 통과 — 로컬 가상 catalog; 운영 결과는 미확인 |
| npm run build (계약 검사·타입·Next 빌드) | 통과 |
| 별도 hosted Supabase Auth/REST·실제 Preview Slow 3G·브라우저 두 탭 | **미실행 — 테스트 프로젝트 없음** |
| 운영 SQL·원본/수입 로그·누락 문항 복구·운영 허용 목록 활성화/main 병합 | **미실행** |

### hosted 실행 / 두 탭·Auth·REST

QA 전용 패키지는 앱 의존성에 포함하지 않는다. 관리자 DB URL은 비밀 저장소/로컬 환경에만 넣고 로그에 출력하지 않는다.

```sh
# 따로 준비한 QA package.json에 pg만 설치되어 있어야 함.
# CBT_QA_DATABASE_URL: 검증된 별도 테스트 DB 관리자 URL(운영 URL 금지)
# CBT_QA_PROJECT_REF / CBT_QA_USER_ID / CBT_QA_CERT_ID: 별도 QA 프로젝트·계정·종목 UUID
CBT_QA_CONFIRM_TEST_DB=YES CBT_QA_PACKAGE_JSON=/absolute/path/to/qa/package.json \
  node scripts/validate-cbt-two-connections.mjs
```

스크립트는 일치하는 cbt_private.test_environment 표식·DB true·공개 UUID 구성·‘CBT QA …’ 전용 프로필·비어 있는 응시/오답 이력을 먼저 검사한다. 두 실제 연결의 start/submit 잠금 대기를 관측한다. 관리자 연결로 생성한 이 실행의 전용 fixture만 정리하며 일반 기록을 삭제하지 않는다. 연결 실패 시 자격 증명/원시 DB 오류는 출력하지 않는다.

브라우저 두 탭: 같은 QA 계정으로 동일 종목을 열고 시작 확정 동시 클릭 → 시작 POST의 다른 clientId를 기록 → 응시 client_id 하나/시작 시각·문항 동일 확인 → 양쪽 제출 → 최초 결과 유지. 응답 유실은 첫 POST가 DB에 커밋된 뒤 응답만 테스트 도구로 차단하여 재시도하고 pending UUID가 같은지 확인한다. Network Offline을 요청 전에 켜는 것만으로는 ‘커밋 후 응답 유실’을 검증했다고 할 수 없다.

REST: QA 프로젝트의 공개 key+QA 사용자 access token으로 /rest/v1/question_bank_attempts를 직접 호출. 관리 행 POST 거부, PATCH 변경 0행(또는 거부), DELETE 거부, legacy POST/PATCH 성공·managed 승격 거부, 타인 token SELECT 비노출, anon 직접 RPC 거부. service_role는 브라우저에 넣지 않는다. 관리 행 PATCH는 RLS 때문에 HTTP 200/[]일 수 있으므로 관리자 SELECT로 행 불변 확인. 앱 start UUID 누락/비문자열=422, 미로그인=401도 확인한다. DB marker=false 및 행 제거 시 서비스 RPC start/answer/submit가 409·행 불변인지 확인한 뒤 관리자만 복구한다.

운영 조회용 진단 SQL은 위 쓰기 QA 스크립트와 완전히 별개의 절차다. 운영에서 QA 스크립트를 실행하지 않는다.
