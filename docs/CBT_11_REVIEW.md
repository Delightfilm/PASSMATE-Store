# CBT 11개 재검토 수정

기준: `0afa5bb`(21개 개선 PR), 운영 비교 기준: `f39bec9`. 2026-10-02.
범위: 실제 Next.js 화면과 테스트 DB 전용 SQL. `index.html` 목업이 아님.
기존 `CBT_21_REVIEW.md`의 권한 회수/전역 저장 대기열 설명은 이 문서로 대체한다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `docs/cbt-test-migration.DRAFT.sql` | 제한형 쓰기 RLS, 구성표/과목 시드, RPC NULL 가드, mastered |
| `docs/cbt-test-qa.sql` | 부족 회차/과목 표, 유효 풀/매핑, GRANT와 정책 조회 |
| `lib/cbt-test-server.ts` | 상태별 한국어 오류, 신규 시작만 모드 플래그 검사 |
| `lib/cbt-server-client.ts` | 모드별 시작 분기, 서버 관리 메타데이터 분리 |
| `lib/cbt-answer-queue.ts` | 낙관적 선택, 문항별 큐, 이전 ACK 보호/실패 복원 |
| `lib/question-bank.ts` | 공개 구성표 조회, 계정 갱신 중 낙관적 필드 보호 |
| `components/question-bank-client.tsx` | 모의시험 중 채점 차단, 저장 큐 연결, 전체 탭 유지, 만료 기록 접기/로컬 숨김 |
| `components/cbt-exam-ui.tsx` | 안내의 문항 수/시간을 구성표 값으로 전달 |
| `app/globals.css` | 기록 액션의 44px 버튼/모바일 그룹 정렬 |
| `app/api/cbt/identity/route.ts` | 시작 준비 가드/오류 매핑 |
| `app/api/cbt/attempts/start/route.ts` | 시작 모드 가드/422 검증/SQL 오류 매핑 |
| `app/api/cbt/attempts/[attemptId]/answer/route.ts` | 검증/SQL 오류 매핑 |
| `app/api/cbt/attempts/[attemptId]/submit/route.ts` | 서버 관리 제출 오류 매핑, 기존 로컬 제출 분기 유지 |
| `next.config.ts` | 테스트 DB 연결 판정과 신규 시작 플래그 분리 |
| `scripts/validate-cbt-test-db.mjs` | 격리 PostgreSQL의 RLS/NULL/구성/채점 검사 |
| `scripts/validate-cbt-ui.mjs` | 실제 저장 큐의 지연 응답/연타/실패/재시도, 오류 코드 검사 |
| `scripts/validate-cbt-two-connections.mjs` | 실제 PostgreSQL 두 연결의 잠금/멱등/RLS 검사 |
| `scripts/validate-cbt-local-concurrency.mjs` | 임시 로컬 PostgreSQL을 띄워 두 연결 스크립트 실행/정리 |
| `docs/STATUS.md`, 이 문서 | 미검증 상태, 병합 조건, 롤아웃/롤백 |

## 1. 기존 로컬 응시와 서버 응시의 권한 분리

원인: 테이블 GRANT 회수는 행 종류와 무관하게 `syncAccountStore` 및 사용자 JWT로 동작하는 기존 제출 라우트까지 막았다. 신규 PERMISSIVE 정책만 추가하면 기존 정책과 OR로 결합되어 보호가 우회된다.

전:
```sql
revoke insert, update, delete on public.question_bank_attempts from authenticated;
grant select on public.question_bank_attempts to authenticated;
```

후: 기존 소유권 정책은 유지하고, RESTRICTIVE 정책을 AND로 결합한다.
```sql
grant select, insert, update, delete on public.question_bank_attempts to authenticated;
create policy "clients update legacy attempts only" on public.question_bank_attempts
  as restrictive for update to authenticated
  using (config->>'serverManaged' is distinct from 'true')
  with check (config->>'serverManaged' is distinct from 'true');
```
INSERT에는 같은 WITH CHECK, DELETE에는 같은 USING이 있다. 기본 스키마에 DELETE 소유권 정책이 없어 `users delete own legacy attempts`도 추가했다. SELECT 소유권 정책은 그대로여서 자기 서버 응시의 읽기/복구는 가능하다. UPDATE의 WITH CHECK가 기존 행을 `true`로 바꾸는 승격까지 거부한다. `'true'` 문자열과 JSON boolean true 모두 차단한다. NULL/키 없음/false는 기존 소유권 정책이 허용하는 범위에서만 접근한다.

## 2. 서버 OFF 동작과 병합 조건

의도: 검증된 서버 구성으로 출제하는 모의시험에는 로컬 무작위 출제 폴백을 두지 않는다. 따라서 **신규 모의시험은 OFF일 때 준비 중**이며, 운영에서 버튼이 사라진 문제로 오인하지 않도록 이유와 다른 학습 경로를 표시했다. 기존 회차별/단원별/맞춤 시험지는 로컬 경로를 유지한다.

전:
```ts
if (SERVER_EXAMS) { /* 모든 모드를 서버로 */ }
// cbtTestServer도 전역 플래그 OFF이면 답안/제출까지 거부
```
후:
```ts
if (user && serverExamMode(mode)) { /* 이 모드의 신규 응시만 서버로 */ }
requireServerStart(body.mode); // start 라우트만 검사
// answer/submit은 검증된 테스트 DB 연결/인증을 검사하되 시작 플래그는 검사하지 않음
```

| 상태 | 모의시험 신규 시작 | 맞춤/회차/단원 | 기존 서버 관리 응시 |
|---|---|---|---|
| 운영 기준 `f39bec9` | 로컬 풀에서 최대 60개 추출, 과목별 20 보장 없음 | 로컬 시작 | 서버 관리 경로 없음 |
| 이전 PR `0afa5bb`, 서버 OFF | 비활성 | 로컬 시작 | 서버 API도 OFF 가드로 차단되는 문제 |
| 이번 PR, 서버 OFF | 구성표 없으면 준비 중; 공개 구성표가 있어도 시작 비활성 | 로컬 시작/기존 동기화 | 유효한 테스트 DB 연결을 유지하면 답안/제출 가능 |
| 이번 PR, 테스트 DB + published + `mock`만 ON | 서버가 구성표 기준 출제 | 기존 로컬 경로 | 서버 RPC로 저장/제출 |
| 이번 PR, 모든 모드 ON | 서버 출제 | 로그인 사용자는 서버; 비로그인 기존 로컬 학습 | 서버 RPC로 저장/제출 |

**병합 시점은 별도 테스트 DB 검증 완료 이후다.** 현재 Draft PR이며 운영 병합 대상이 아니다. `VERCEL_ENV=production` 및 운영 프로젝트 ref 차단은 계속 남아 있다. 운영 출시에는 테스트 DB QA에 더해 운영 프로젝트 연결/백업/전용 마이그레이션과 이 가드의 별도 변경 검토가 필요하다. 현재 코드를 그대로 병합하고 플래그만 켜면 운영 서버 시험이 활성화되는 구조가 아니다. 테스트 DB를 운영 배포에 연결하거나 검증된 Preview를 그대로 운영으로 promote하지 않는다.

## 3. 모의시험 중 채점 노출 차단

전:
```tsx
<button onClick={() => setModal("interim")}>중간 채점</button>
{modal === "interim" && <Modal title="중간 채점 결과">...</Modal>}
```
후:
```tsx
{attempt.config.mode === "mock" ? <p>모의시험은 최종 제출 후 채점합니다.</p>
  : <button onClick={() => { if (attempt.config.mode !== "mock") setModal("interim"); }}>중간 채점</button>}
{modal === "interim" && attempt.config.mode !== "mock" && <Modal title="중간 채점 결과">...</Modal>}
```
모의시험은 즉시 채점의 locked/OX 표시도 렌더링하지 않는다. 맞춤 시험지 중간 채점은 유지한다. 공개 SELECT의 정답 노출을 제거하는 후속 정답 테이블 분리는 이번 변경에 포함하지 않으며, 서버 응시는 개인 학습용이다.

## 4. 낙관적 선택과 문항별 저장 큐

전:
```ts
const work = pendingAnswers.current.then(async () => {
  const next = serverAttempt(await cbtPost(path, body));
  saveStore(/* 응시 전체를 서버 응답으로 교체 */);
});
// savingAnswer로 모든 답 선택/다른 행 선택을 비활성화
```
후(실제 큐의 핵심):
```ts
const version = ++entry.versions[field];
write(id, field, optimistic); // 네트워크보다 먼저 표시
current.tail = current.tail.then(async () => {
  try {
    current.confirmed = await send(id, choice, review);
    if (current.versions[field] === version) write(id, field, current.confirmed);
  } catch (error) {
    if (current.versions[field] === version) {
      write(id, field, current.confirmed);
      current.errors[field] = error;
    }
    onError(error);
  }
});
```
문항별 Map의 tail을 사용한다. 다른 문항은 대기하지 않고 저장한다. 같은 문항은 1→2→3→4의 순서를 서버에도 보장하며 마지막 선택을 유지한다. 답/나중에 보기 각각의 버전을 검사하여 오래된 ACK가 최신 상태를 덮지 않는다. 서버 ACK는 해당 문항 필드에만 합치고, 계정 세션 갱신 시에도 대기 중인 필드를 보호한다.

실패 시 마지막 서버 확인값으로 복원하고 한국어 오류 토스트를 보인다. 마지막 저장 실패가 남아 있으면 최종 제출/나가기는 중단하고 재선택을 요구한다. 재선택 저장 성공 뒤 오류가 해제된다. 최종 제출 중에는 선택을 막아 제출 스냅샷을 고정한다. **가정:** 연타 최종 선택 검증은 모의시험/제출 후 채점 모드 기준이다. 맞춤 시험지의 즉시 채점은 기존대로 첫 선택 후 잠긴다. 큐는 한 브라우저 화면 안의 입력 순서를 보장하며 서로 다른 탭의 답 수정 순서까지 통합하지는 않는다.

## 5. serverManaged NULL 가드

전:
```sql
if a.config->>'serverManaged' <> 'true' then ... end if;
```
후(두 RPC 동일):
```sql
if a.config->>'serverManaged' is distinct from 'true' then
  raise exception using errcode='PT403', message='Not server managed';
end if;
```
키 없음은 NULL이므로 기존 `<>`는 참이 되지 않았다. 이제 false/키 없음/NULL 모두 거부한다. 클라이언트에는 내부 SQL 문구를 반환하지 않는다.

## 6. 만료된 기록 접기/숨김

전:
```tsx
{attempts.map(recordRow)}
```
후:
```tsx
{active.map(recordRow)}
<button aria-expanded={expanded} aria-controls={`expired-${cert.id}`}
  onClick={() => setExpanded(!expanded)}>만료된 기록 {expiredRecords.length}건</button>
<div id={`expired-${cert.id}`} hidden={!expanded}>{expiredRecords.map(recordRow)}</div>
```
종목 상세의 이 종목 기록에 적용했다. 전체 `/cbt/history/`는 기존대로 제출된 기록만 집계하므로 만료된 진행 중 기록이 집계되지 않는다. 숨김은 `passmate.cbt-hidden-records.v1:<계정ID>:<종목ID>`의 ID 목록만 갱신한다. `saveStore`, 삭제 API, DB UPDATE/DELETE를 호출하지 않는다. ‘숨긴 기록 N건 다시 표시’로 되돌린다. 저장소를 사용할 수 없으면 현재 화면에서만 유지한다.

## 7. 종목별 구성표

전:
```sql
for r in select * from (values (1,'금속도장재료',...), ...) rules loop
  ... limit 20;
end loop;
```
후:
```sql
select * into mock_config from public.question_bank_mock_configs c
where c.cert_name=v_cert_name and c.status='published';
for r in select * from public.question_bank_mock_subjects s
  where s.cert_name=v_cert_name order by position loop
  ... limit r.question_count;
end loop;
```

| 종목 | 순서 | 내부 과목 | 공식 과목 | 출제 수 |
|---|---:|---|---|---:|
| 금속도장기능사 | 1 | 금속도장재료 | 금속도장재료 | 20 |
| 금속도장기능사 | 2 | 금속도장 | 금속도장 작업 및 안전 | 20 |
| 금속도장기능사 | 3 | 색채 | 색채 및 조색 | 20 |

종목 테이블 시드: 60분 / overall / 60점 / calculator_allowed=false / **draft**. 과목 테이블은 종목 이름 FK와 (종목,순서) PK, 내부 이름 유니크 제약이 있다. RLS는 published 구성만 공개하고 클라이언트 구성 쓰기는 허용하지 않는다. 화면 구성·안내 문항 수/시간·서버 추출·결과 합격 기준이 구성표/응시 스냅샷을 사용한다. SQL 생성 시 합계 1–120, 매핑 1개, 유효 풀의 충분함을 검사한다. 구성표 미등록/draft는 준비 중이다. 테이블이 아직 없는 환경에서는 기존 카탈로그와 다른 학습 모드가 계속 열린다.

## 8. 답안지 전체 탭 유지

전:
```ts
if (question) setSheetSubject(question.subjectId);
```
후:
```ts
if (question) setSheetSubject(previous => previous === "all" ? "all" : question.subjectId);
```
전체 선택은 문항 이동 후 유지한다. 새 응시는 초기화하며, 과목 탭을 사용하는 동안의 기존 현재 과목 이동은 유지한다.

## 9. 상태별 오류

전:
```ts
Response.json({ error: error.message }, { status: 400 });
```
후:
```ts
const status = error instanceof CbtRequestError ? error.status
  : error instanceof SyntaxError ? 422 : 500;
return Response.json({ error: messages[status] || messages[500] }, { status });
```

| HTTP | 조건 | 사용자 문구 |
|---:|---|---|
| 401 | 토큰 없음/인증 실패 | 로그인을 다시 확인해 주세요. |
| 403 | 소유권/관리 행 검증 실패, PT403/42501/P0002 | 이 응시를 변경할 권한이 없습니다. |
| 409 | 만료/잠김/신규 시작 중단/상태 충돌 | 시험 상태가 변경되었거나 저장이 종료되었습니다. 기록을 다시 확인해 주세요. |
| 422 | 잘못된 JSON/구성/보기/가용 풀 부족 | 시험 구성과 답안을 확인해 주세요. 출제 가능한 문항이 부족할 수 있습니다. |
| 500 | 설정/연결/예상하지 못한 오류 | 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요. |

서버 관리 API는 SQL 오류 객체의 code를 매핑한다. 오류 응답과 로그에 원문 SQL/영문/토큰/접속정보를 넣지 않는다. 기존 로컬 제출 라우트의 별도 검증 분기는 유지했다.

## 10. 서버 정답 mastered

전: 틀린 문항만 UPSERT; 기존 오답을 맞힌 경우 DB mastered가 갱신되지 않음.

후:
```sql
update public.question_bank_wrong_notes n set mastered=true
  from public.question_bank_questions q
  where n.user_id=p_user and n.question_id=q.id
    and a.question_ids ? q.id::text and a.answers->>q.id::text=q.answer::text;
```
최초 제출 블록 안에서만 수행한다. 기존 노트만 mastered로 만들고 정답 노트를 새로 생성하지 않는다. 기존 wrong_count/메모/last_wrong_at은 보존한다. 재제출은 최초 결과를 읽으므로 오답 횟수도 다시 늘지 않는다.

## 11. 1,138 vs 1,140 확인 표/판단

운영 쿼리를 실행한 결과가 아니다. 어떤 회차의 어떤 과목이 부족한지는 **[확인 필요]**다. 총합의 차이 2만으로 누락 위치/원인(비공개·미분류·누락·중복)을 추정하지 않는다.

실행 쿼리는 `cbt-test-qa.sql` 첫 두 SELECT. 첫 SELECT의 결과 형식:

| cert | year | round | internal_subject | official_name | published | expected | missing | result |
|---|---:|---|---|---|---:|---:|---:|---|
| 금속도장기능사 | [확인 필요] | [확인 필요] | [확인 필요] | 매핑값 | 실제 COUNT | 20 | max(20−COUNT,0) | 정상/부족/초과 |

쿼리 변경 전 `year,round,name,count` → 변경 후 공식 이름/기대 수/부족 수/상태를 추가했다. 과목별 합계 및 회차별 합계를 함께 검토하고, 출제 수 집계와 별도로 4개 보기/정답 범위가 유효한 문항 수를 두 번째 SELECT로 확인한다.

| 상황 | 모의시험 영향 |
|---|---|
| 일부 회차가 19문항이지만 모든 회차를 합친 각 과목의 유효 풀이 20 이상이고 매핑이 1개 | 고정 20/20/20 모의시험 출제 가능. 회차별 기출은 실제 수를 사용 |
| 한 과목 전체 유효 풀이 설정 수보다 작음 | 시작 차단, 응시 행 생성 없음 |
| 과목 매핑 0개/2개 이상, 구성 draft/없음 | 시작 차단/준비 중 |
| 공개 문항 수는 충분하나 보기/정답 검증에서 제외되어 풀 부족 | 시작 차단 |

## 테스트 DB 전용 두 연결 검증

스크립트: `scripts/validate-cbt-two-connections.mjs`. **임시 로컬 PostgreSQL 18.4에서 실제 두 연결 실행 통과.** `validate-cbt-local-concurrency.mjs`가 loopback에만 서버를 열고 가상 문항/QA 계정 스키마를 만든 뒤 같은 검증 스크립트를 실행·정리했다. 이 결과는 PGlite가 아닌 별도 PostgreSQL 백엔드 연결 2개에서 확인한 것이다. Supabase hosted Auth/REST 통합은 미완료이며 로컬 auth.uid/role 함수는 최소 테스트 대체 구현이다.

로컬 재현(앱 의존성/운영 연결을 사용하지 않음):
```sh
npm install --prefix /tmp/cbt-qa --no-audit --no-fund pg@8.16.3 embedded-postgres@18.4.0-beta.17
CBT_QA_PACKAGE_JSON=/tmp/cbt-qa/package.json node scripts/validate-cbt-local-concurrency.mjs
```
macOS 패키지의 native 라이브러리 symlink 복원 스크립트가 설치 정책 때문에 실행되지 않았다면 패키지 내 `scripts/hydrate-symlinks.js`를 검토한 후 해당 패키지 폴더에서 실행해야 한다. 시스템 사용자 생성/외부 네트워크 리슨은 사용하지 않는다.

Hosted 테스트 DB 실행 절차:

1. 별도 Supabase 테스트 프로젝트 ref/접속 대상을 독립 확인한다. 운영 ref는 스크립트에서 거부한다. 전용 QA 계정을 만들고 표시 이름을 `CBT QA 동시제출`처럼 설정한다. 이 계정에는 기존 응시/오답/연습용 번호가 없어야 한다.
2. 테스트 DB에 기존 스키마(`client_id` 포함)를 적용하고, `SET app.cbt_test_database='true';` 후 DRAFT SQL을 검토해 실행한다. 이미 이전 DRAFT를 적용한 테스트 DB라면 새 DB를 사용하거나 함수 교체/새 테이블/정책만 적용하는 별도 증분을 검토한다. 이 초안은 재실행용 운영 마이그레이션이 아니다.
3. 테스트 관리자 연결에서 테스트 환경 표식과 검증된 구성 공개를 수행한다:
```sql
insert into cbt_private.test_environment(project_ref) values ('검증한_테스트_ref');
-- 매핑 1개, 세 과목의 유효 풀 >=20, 합계 60, 시간/합격 기준 확인 후에만:
update public.question_bank_mock_configs set status='published'
where cert_name='금속도장기능사';
```
4. QA 전용 경로에만 `pg`를 설치한다. 앱 의존성에는 추가하지 않는다. 아래 변수는 터미널/비밀 저장소에서 지정하고 접속 비밀번호를 문서/로그/Git에 넣지 않는다.
```sh
npm install --prefix /tmp/cbt-qa --no-audit --no-fund pg
# CBT_QA_DATABASE_URL: 테스트 관리자 PostgreSQL URL (pooler는 session mode 권장)
# CBT_QA_PROJECT_REF: 위에서 검증한 ref
# CBT_QA_USER_ID: 전용 QA 계정 UUID
CBT_QA_CONFIRM_TEST_DB=YES CBT_QA_PACKAGE_JSON=/tmp/cbt-qa/package.json \
  node scripts/validate-cbt-two-connections.mjs
```
5. 스크립트는 두 개의 `pg.Client`를 실제 연결한다. A가 응시 행 FOR UPDATE를 보유한 상태에서 B의 cbt_submit을 호출하고, `pg_stat_activity.wait_event_type='Lock'`을 확인한 후 A의 최초 제출을 확정한다. B가 반환한 답안/점수/시각이 최초와 같고 행 수 1인지 검사한다. 정상/오류 종료 시 해당 실행이 만든 전용 QA 응시/노트/번호만 정리한다.
6. 같은 스크립트에서 authenticated 역할/사용자 JWT claim을 적용해 로컬 INSERT/UPDATE/DELETE 허용, 다른 사용자 읽기/위조 생성 차단, 서버 행 INSERT/UPDATE/DELETE 차단, 승격 차단, authenticated start/answer/submit 및 anon submit 직접 RPC 차단, 키 없는 행의 서비스 RPC 거부를 확인한다. 테스트 DB 관리자만 SET ROLE을 사용할 수 있으며 브라우저 사용자가 이 권한을 얻는 것은 아니다.
7. 실제 Supabase Auth/REST 통합은 추가로 테스트 계정 Bearer와 anon/publishable 키로 `/rest/v1/question_bank_attempts` 및 `/rest/v1/rpc/cbt_submit`을 호출해 같은 정책을 확인한다. 토큰을 Git/출력에 쓰지 않는다. 이것과 브라우저 두 탭 재제출/만료 GET/새로고침 QA가 끝나야 병합한다.

## 점진 롤아웃 및 롤백

| 단계 | 설정/행동 | 통과 조건 | 롤백 |
|---|---|---|---|
| 0 서버 준비 | 별도 테스트 DB, 백업, DRAFT 적용; 시작 플래그 0; DB 연결과 서비스 키는 서버 전용 | 로컬 동기화/기존 제출 정상, 서버 행 RLS 보호, 실제 두 연결 검사 | 신규 시작 0 유지. 기존 서버 행/보호 정책 보존 |
| 1 서버 플래그 → 일부 모드 | `NEXT_PUBLIC_CBT_SERVER_EXAMS=1`, `NEXT_PUBLIC_CBT_SERVER_MODES=mock`; 검증된 금속도장 구성만 published | 20/20/20, 스냅샷/타이머/재개/멱등, 모의시험 채점 비노출 | 시작 플래그 0 또는 모드 목록에서 mock 제거. 기존 답안/제출 API와 DB 연결 유지 |
| 2 모드 확대 | `mock,custom` → `mock,custom,past` | 해당 모드의 저장 실패/재시도/즉시 채점/로컬 이전 기록 회귀 | 문제가 난 모드만 목록에서 제거. 신규 해당 모드는 기존 로컬 경로, 엄격 모의시험은 준비 중 |
| 3 전체 | `mock,custom,past,subject` | 전 모드 테스트 DB QA/브라우저 회귀, 운영 전환 별도 검토 | 신규 서버 시작 OFF. 이미 시작한 서버 응시는 서버 경로로 종료 |
| 4 병합/운영 전환 | **테스트 DB 검증 완료 후에만 병합 검토**; 현재 생산 환경 차단 가드의 별도 승인된 변경, 운영 전용 마이그레이션/백업/연결 | 운영 연결이 테스트 DB와 혼동되지 않음, 기존 학습 영향 없음 | 호환 API를 남긴 채 신규 시작부터 중단. DB 삭제/서버 관리 행을 로컬 행으로 변경하지 않음 |

NEXT_PUBLIC 변수는 빌드에 포함되므로 변경 후 재빌드/재배포가 필요하다. DB 연결 판정은 신규 시작 플래그와 분리해 OFF 롤백 때 기존 서버 응시가 막히지 않는다. 서버 관리 기록이 존재하는 동안 RLS 보호나 제출 RPC를 제거하거나, 해당 API가 없는 운영 구버전으로 전체 코드 롤백하지 않는다. 코드 롤백보다 시작 플래그/모드 롤백을 우선한다.

## 자체 검증 상태

| 검사 | 결과 |
|---|---|
| 앱 계약 검사 및 Next.js 빌드/타입 검사 | 통과 |
| 실제 큐: 1~4 연타, 다른 문항 병행, 오래된 ACK, 실패 복원, 재선택, 나중에 보기 | 통과 |
| 격리 PostgreSQL 100회 구성 출제/RLS/NULL/최초 결과/mastered/draft/풀 부족 | 통과 |
| 두 연결 스크립트 문법/운영 대상 차단 가드 | 문법 확인, 테스트 ref/URL/DB 표식 검사 적용 |
| 실제 로컬 PostgreSQL 두 연결 | 통과 — B의 실제 Lock 대기, 최초 결과 유지/행 1개/RLS/RPC 차단 |
| 실제 로컬 화면 | 서버 OFF 맞춤 시험지 시작, 전체 탭을 유지한 다른 과목 이동, 맞춤 중간 채점 메뉴 확인 |
| 운영 회차별 누락 위치 | [확인 필요] — 운영 쓰기/조회 결과 추정 없음 |
| 별도 Supabase Auth/REST 및 실제 두 탭 제출 | 미완료 — 테스트 프로젝트/계정 필요; 로컬 DB 결과로 대신하지 않음 |
| 운영 병합/DB 적용 | 수행하지 않음 |

RLS의 GRANT/정책 구분은 [Supabase 공식 RLS 문서](https://supabase.com/docs/guides/database/postgres/row-level-security), 제한형 정책 결합은 [PostgreSQL CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html)를 기준으로 확인했다.
