# CBT 후속 재검토 9개 항목

기준: e9b0d93, 2026-10-02. 실제 Next.js 수정이며 정적 목업 수정이 아니다.
이 문서가 CBT_11_REVIEW.md의 DELETE 허용, 이름 기반 구성표, 운영 가드 및 다중 모드 롤아웃 설명을 대체한다.
운영 병합·운영 DB 쓰기는 하지 않았다. 아래 SQL은 여전히 **테스트 DB 전용 DRAFT**다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| .env.example | 허용 목록 빈 값, 시작 OFF 기본값 |
| lib/cbt-server-config.ts | Next 설정/API 공용 HTTPS 프로젝트 ref 검증 |
| next.config.ts | 허용 목록과 서버 키로 준비 여부 계산; 브라우저에는 boolean만 제공 |
| lib/cbt-test-server.ts | 환경 허용 목록, mock 전용 시작 가드 |
| lib/cbt-server-client.ts | 준비 여부·시작 플래그·mock 조건 |
| app/api/cbt/attempts/start/route.ts | mock/submit/빈 요청 문항 검증; 시간은 DB 구성 |
| lib/question-bank.ts | 구성표 조회·타입을 certId로 변경 |
| lib/cbt-presentation.ts | 무제한 진행 중 7일 표시 계산, 로컬 열람 시각 |
| components/question-bank-client.tsx | UUID 매칭, custom/past/subject 서버 시작 제거, 오래된 기록 접기 |
| docs/cbt-test-migration.DRAFT.sql | DELETE 회수, UUID FK/시드, mock 전용 RPC |
| docs/cbt-test-qa.sql | UUID JOIN, DELETE 권한 확인 |
| docs/cbt-missing-questions.READONLY.sql | 빠진 번호/상태/수입·이미지 검토 근거 확인 |
| scripts/validate-cbt-test-db.mjs | 이름 변경·중복, mock 전용, DELETE 거부, 진단 SQL 검사 |
| scripts/validate-cbt-two-connections.mjs | 모든 클라이언트 DELETE 거부, QA 종목 UUID 지정 |
| scripts/validate-cbt-local-concurrency.mjs | UUID 시드/공개·QA 실행 |
| scripts/validate-cbt-ui.mjs | 7일 경계/빈 허용 목록/정확한 ref/mode 가드 |
| docs/CBT_9_REVIEW.md, docs/CBT_11_REVIEW.md, docs/STATUS.md | 최신 절차, SQL 전문, 이전 지침 대체 표시 |

## 1. DELETE 최소 권한

원인: 지난 검토에서 로컬 쓰기 호환성을 넓게 잡아 DELETE까지 추가했다.
실제 syncAccountStore와 기존 제출은 attempts UPDATE/INSERT만 사용한다. 조회된 앱 호출 중 attempts DELETE 경로는 없다.
북마크/오답노트 삭제는 다른 테이블이므로 이번 권한 회수와 무관하다.

전:
```sql
grant select,insert,update,delete on public.question_bank_attempts to authenticated;
create policy "users delete own legacy attempts"
on public.question_bank_attempts for delete to authenticated using(auth.uid()=user_id);
-- 서버 행을 막는 restrictive DELETE 정책도 함께 존재
```

후:
```sql
revoke delete on public.question_bank_attempts from authenticated;
grant select,insert,update on public.question_bank_attempts to authenticated;
drop policy if exists "users delete own legacy attempts" on public.question_bank_attempts;
drop policy if exists "clients delete legacy attempts only" on public.question_bank_attempts;
```

RESTRICTIVE DELETE는 제거했다. PUBLIC/anon 전체 권한 회수 + authenticated DELETE 회수로 진입 자체가 막힌다.
기존 소유권 SELECT/INSERT/UPDATE 정책과 서버 관리 INSERT/UPDATE 차단은 유지한다.
관리자 역할에 남은 permissive ALL 정책도 authenticated의 테이블 DELETE 권한을 되살리지 않는다.
QA 정리는 테스트 관리자 연결만 수행하며 앱 서비스 역할에 DELETE를 새로 주지 않는다.

## 2. UUID 구성표 및 시드

전:
```sql
cert_name text primary key
-- JOIN config.cert_name = cert.name
```
```ts
dataset.mockConfigs?.find(config => config.certName === cert.name)
```

후:
```sql
-- 부모: 실제 종목 UUID FK
cert_id uuid primary key references public.question_bank_certs(id) on delete restrict
-- 자식: 동일 UUID를 구성표에 FK; 이를 통해 실제 종목 UUID도 보장
cert_id uuid not null references public.question_bank_mock_configs(cert_id) on delete cascade
-- RPC
select * into mock_config from public.question_bank_mock_configs
where cert_id=p_cert and status='published';
```
```ts
dataset.mockConfigs?.find(config => config.certId === cert.id)
```

시드 실행 전에 대상 종목 UUID를 독립 확인하고 아래 두 설정을 지정한다. 이름/코드로 자동 매칭하지 않는다.
```sql
SET app.cbt_test_database='true';
SET app.cbt_seed_cert_id='검증한_테스트_종목_UUID';
-- 아래 전문 실행: 해당 UUID 존재 확인 → 금속도장 60/60/overall60/20×3 draft 시드
```

구성표와 클라이언트/RPC에 cert_name 참조가 없다. RPC의 certSlug 스냅샷도 UUID 문자열이며 기존 findCert가 UUID를 인식한다.
과목 이름 매핑은 이번 범위에서 유지하며 각 과목이 정확히 1개에 매핑되는 가드가 있다.

### 마이그레이션 영향

| 대상 | 영향/절차 |
|---|---|
| 운영 | 구성표 DRAFT 미적용이므로 이번 UUID 변경으로 운영 데이터 변환 없음 |
| 새 테스트 DB | 기존 종목/기본 스키마/client_id를 먼저 준비 → 시드 UUID 설정 → SQL 전문 적용 |
| 이전 이름 기반 DRAFT를 적용한 테스트 DB | 전문 재실행 금지. 백업 후 새 격리 테스트 DB로 검증하거나 별도 증분 변환을 검토 |
| 증분 변환이 필요한 경우 | old cert_name→검증한 cert_id의 수동 매핑표 작성; 이름 중복/미매핑이면 중단. 부모·자식 UUID 백필과 NOT NULL/FK/PK·unique 전환, published RLS·RPC 교체를 한 트랜잭션으로 진행. 모든 old FK/policy 의존 제거 확인 후 cert_name 제거 |
| 기존 응시 | config.certId는 이미 UUID. question_ids/answers/score/identity를 변경하지 않음 |
| 종목 이름 변경/동명 종목 | 기존 UUID 구성은 그대로 유지; 같은 이름의 다른 UUID는 구성 없음/준비 중 |
| 종목 삭제 | 구성표가 참조하는 종목 삭제는 RESTRICT. 구성 없이 종목을 바꾸는 우회 없음 |

증분 변환 SQL을 검증 없이 운영에 적용하지 않는다. 기존 DRAFT 테스트 DB가 없는 현재 상황에서는 새 테스트 DB 경로가 가장 작다.

## 3. 운영 전환 결정: 환경 허용 목록

코드 메커니즘은 변경했고 **환경 값은 활성화하지 않았다**. 기본값은 허용 목록 빈 값·신규 시작 OFF로 운영 차단이다.

| 선택지 | 장점 | 단점/운영 영향 |
|---|---|---|
| 이전 하드코딩 유지 | 환경 설정 실수로 운영이 열리지 않음 | 운영 전환마다 코드 변경 필요; 테스트/운영 규칙이 코드에 섞임 |
| CBT_SERVER_PROJECT_REFS 명시 허용 목록 — 권장, 구현 | 환경별 정확한 DB ref만 허용; 빈 값은 모든 서버 시험 API 차단; 코드 수정 없이 승인된 전환 가능 | 잘못된 운영 ref를 허용하면 열릴 수 있어 환경별 검토·키/URL 확인 필요; 기존 응시 중 목록 삭제는 저장/제출까지 차단 |
| 환경별 별도 TEST/PROD 변수 추가 | 각 환경의 의도가 더 명시적 | 변수/분기 증가; Vercel의 환경별 변수 설정으로도 목적 달성 가능 |

전:
```ts
if (CBT_TEST_PROJECT_REF !== ref || ref === "운영_ref" || VERCEL_ENV === "production") throw ...;
```

후:
```ts
if (!cbtProjectAllowed(url, process.env.CBT_SERVER_PROJECT_REFS) || !secret)
  throw new CbtRequestError(500);
```

HTTPS, 정확한 *.supabase.co 호스트, 포트/사용자 정보 없음, CSV의 정확한 ref 일치만 허용한다.
와일드카드/부분 일치/VERCEL_ENV에 의한 자동 운영 허용은 없다.
허용 목록·서비스 키는 NEXT_PUBLIC이 아니며 클라이언트에는 NEXT_PUBLIC_CBT_SERVER_READY라는 boolean만 제공한다.
CBT_TEST_PROJECT_REF 및 NEXT_PUBLIC_CBT_SERVER_MODES는 더 이상 앱 가드 입력이 아니다.
Preview 읽기 전용 가드는 미준비 상태에서 유지된다.
**테스트 DRAFT·QA 스크립트의 알려진 운영 대상 차단은 유지한다.** 앱 허용 목록을 설정해도 테스트 SQL/QA를 운영에 실행하는 권한이 생기지 않는다.
운영용 마이그레이션·백업·승인은 별도 작업이다.

## 4. 병합 시 준비 중 문제: A/B 결정

| 방안 | 사용자 영향 | 구현 범위 | 장점 | 단점 |
|---|---|---|---|---|
| A. 서버 시험 준비 후 병합 — 현재 기본/권장 | 검증 기간 동안 현재 main 기능 유지. 병합 시 검증된 20/20/20 모의시험 제공 | 추가 대체 출제 구현 없음; 테스트 DB·Auth/REST·Slow 3G·운영 마이그레이션 게이트 충족 후 병합 | 과목 비율 보장과 이름의 의미 유지; 중간 준비 중 노출 피함 | 서버/운영 준비 전 PR을 병합할 수 없음 |
| B. 자유 출제 모의시험(과목 비율 미보장) 유지 | 서버 OFF/구성 미준비에도 연습 시작 가능. 엄격 모의시험과 다른 유형임을 표시 | 기존 로컬 출제 재사용, 버튼/설명/기록 라벨 구분, serverManaged=false, 재시도/기록/타이머 회귀 | 기능 공백 감소 | 연습 타입 혼동과 임시 기능 유지 비용; 20/20/20 보장 불가 |

B는 구현하지 않았다. 기존 로컬 맞춤 시험지/기출/단원별은 그대로 이용 가능하다.
[결정 필요] A를 바꾸어 B를 제공할지 여부. A가 준비되기 전에는 Draft PR 유지, main 병합하지 않는다.
Preview의 모의시험 준비 중은 검증되지 않은 구성으로 실제 응시를 생성하지 않는 가드다.

## 5. 이번 서버 범위는 mock만

전:
```ts
SERVER_EXAMS && (NEXT_PUBLIC_CBT_SERVER_MODES || "mock").split(",").includes(mode)
```
후:
```ts
SERVER_EXAMS && NEXT_PUBLIC_CBT_SERVER_READY === "1" && mode === "mock"
```

custom/past/subject의 신규 서버 시작 분기를 컴포넌트에서 삭제했다. 시작 API와 cbt_start도 mock/submit만 허용한다.
클라이언트가 시간을 지정하지 않고 DB published 구성표의 duration_minutes를 적용한다.
기존 RPC 인자 p_minutes는 시그니처 호환 때문에 남기지만 신규 API는 null을 보내고 RPC는 DB 값만 사용한다.
맞춤 시험지·기출·단원별 및 결과의 다시 풀기는 기존 로컬 경로다.
기존 serverManaged 행의 답안/제출 호환 경로와 instant 잠금 처리는 삭제하지 않았다. 이전 테스트 행이 있더라도 종료할 수 있게 한다.
새 비-mock 서버 응시는 생성할 수 없다. 해당 모드 서버 전환은 필요 시 별도 PR.
롤아웃은 준비 → mock만 → 모니터링으로 축소하며 모든 모드 확대 단계는 폐기한다.

## 6. 제한 시간 없는 오래된 기록

전: endAt=null인 모든 진행 중 기록을 일반 목록에 계속 노출.

후:
```ts
const seen = Number.isFinite(lastSeen) ? Math.max(startedAtMs, lastSeen) : startedAtMs;
const old = status === "in_progress" && !endAt && now - seen >= 7 * 86400000;
```

| 항목 | 표시 기준 |
|---|---|
| 대상 | 진행 중 + endAt 없음 |
| 기준 시각 | 이 브라우저/계정의 마지막 응시 열람·답 변경 시각. 없으면 startedAt |
| 7일 | 7×24시간 경계 이상이면 오래된 진행 중 N건, 기본 접힘 |
| 다시 열기 | 로컬 최근 시각을 갱신해 일반 진행 중으로 복귀 |
| 기한 만료/제출 완료 | 별도 기존 처리. 오래된 진행 중으로 분류하지 않음 |
| 숨김/복구 | 기존 계정·종목별 로컬 숨김 기능 재사용, 응시 DB 행 삭제/UPDATE 없음 |
| 저장소 불가/다른 기기 | 시작일 기준으로 표시; 전 기기 미접속 여부는 알 수 없음 |
| 잘못된 날짜/미래 시각 | 검증 가능한 오래됨이 아니면 접지 않음 |

UI에도 “이 브라우저에서 7일 이상 열지 않은 기록입니다. 열람 정보가 없으면 시작일을 기준으로 표시합니다.”를 표시한다.
7일은 화면 정리 기준이며 만료/자동 제출/삭제 기준이 아니다.
[결정 필요] 7일을 다른 기간으로 조정할지. 현재 7일로 구현.

## 7. DRAFT SQL 전문

아래는 docs/cbt-test-migration.DRAFT.sql 전체다. 발췌가 아니다.
테스트 DB 확인 + 존재하는 시드 UUID 설정이 없으면 트랜잭션 실패.
SECURITY INVOKER·빈 search_path·서비스 전용 EXECUTE·FOR UPDATE·유니크 제약을 유지한다.
PUBLIC/anon의 attempts 쓰기와 authenticated DELETE는 막고, 소유한 legacy INSERT/UPDATE만 기존 RLS와 결합해 허용한다.

```sql
-- TEST DATABASE ONLY. Not migration history; no production execution.
-- Operator must first verify project ref, backups and test-only auth users, then:
-- SET app.cbt_test_database = 'true';
-- SET app.cbt_seed_cert_id = '<independently verified test cert UUID>';
begin;
do $$ begin
  if current_setting('app.cbt_test_database', true) is distinct from 'true' then
    raise exception 'Explicit test database confirmation required';
  end if;
end $$;
create schema if not exists cbt_private;
-- Add the independently verified test project ref manually before hosted QA.
create table cbt_private.test_environment (project_ref text primary key check (project_ref <> 'fmecqeadghrdisirucqm'));
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
revoke delete on public.question_bank_attempts from authenticated;
grant select, insert, update on public.question_bank_attempts to authenticated;
drop policy if exists "users delete own legacy attempts" on public.question_bank_attempts;
drop policy if exists "clients delete legacy attempts only" on public.question_bank_attempts;
-- Restrictive policies AND with existing owner policies (permissive policies OR).
create policy "clients insert legacy attempts only" on public.question_bank_attempts
  as restrictive for insert to authenticated
  with check (config->>'serverManaged' is distinct from 'true');
create policy "clients update legacy attempts only" on public.question_bank_attempts
  as restrictive for update to authenticated
  using (config->>'serverManaged' is distinct from 'true')
  with check (config->>'serverManaged' is distinct from 'true');
grant select, insert, update on public.question_bank_attempts to service_role;
grant usage on schema auth, extensions to service_role;
grant select on auth.users, public.profiles, public.question_bank_certs, public.question_bank_exams, public.question_bank_subjects, public.question_bank_questions to service_role;
grant select, insert, update on public.question_bank_wrong_notes to service_role;
create unique index if not exists question_bank_attempts_user_client_idx
  on public.question_bank_attempts(user_id, client_id);

create table public.question_bank_mock_configs (
  cert_id uuid primary key references public.question_bank_certs(id) on delete restrict,
  duration_minutes integer not null check (duration_minutes between 1 and 180),
  pass_rule text not null check (pass_rule = 'overall'),
  pass_score integer not null check (pass_score between 0 and 100),
  calculator_allowed boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published'))
);
create table public.question_bank_mock_subjects (
  cert_id uuid not null references public.question_bank_mock_configs(cert_id) on delete cascade,
  position integer not null check (position > 0),
  internal_name text not null,
  official_name text not null,
  question_count integer not null check (question_count between 1 and 120),
  primary key (cert_id, position), unique (cert_id, internal_name)
);
alter table public.question_bank_mock_configs enable row level security;
alter table public.question_bank_mock_subjects enable row level security;
revoke all on public.question_bank_mock_configs, public.question_bank_mock_subjects from public, anon, authenticated;
grant select on public.question_bank_mock_configs, public.question_bank_mock_subjects to anon, authenticated, service_role;
grant insert, update, delete on public.question_bank_mock_configs, public.question_bank_mock_subjects to service_role;
create policy "published mock configs" on public.question_bank_mock_configs for select to anon, authenticated using (status='published');
create policy "published mock subjects" on public.question_bank_mock_subjects for select to anon, authenticated
  using (exists (select 1 from public.question_bank_mock_configs c where c.cert_id=question_bank_mock_subjects.cert_id and c.status='published'));
-- Draft until mapping, valid pools and test DB QA are verified. No public fallback.
-- The operator chooses the UUID; names/codes are never used to resolve a seed.
do $$ declare cert uuid := nullif(current_setting('app.cbt_seed_cert_id',true),'')::uuid;
begin
  if cert is null or not exists(select 1 from public.question_bank_certs where id=cert) then
    raise exception 'Explicit existing seed cert UUID required';
  end if;
  insert into public.question_bank_mock_configs values (cert,60,'overall',60,false,'draft');
  insert into public.question_bank_mock_subjects values
    (cert,1,'금속도장재료','금속도장재료',20),
    (cert,2,'금속도장','금속도장 작업 및 안전',20),
    (cert,3,'색채','색채 및 조색',20);
end $$;

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
-- p_minutes remains in the prior RPC signature; published config owns duration.
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  ids jsonb := '[]'; picked jsonb; r record; mapped_subject uuid; subjects_count integer;
  seed text := encode(extensions.gen_random_bytes(32), 'hex');
  identity jsonb; a public.question_bank_attempts; cfg jsonb; started timestamptz := clock_timestamp();
  minutes integer; exam_ids jsonb; subject_ids jsonb;
  mock_config public.question_bank_mock_configs;
begin
  if p_mode is distinct from 'mock' or p_grade is distinct from 'submit' or p_cert is null
    or p_ids is distinct from '[]'::jsonb then raise exception using errcode='PT422', message='Mock mode only'; end if;
    select * into mock_config from public.question_bank_mock_configs c where c.cert_id=p_cert and c.status='published';
    if not found then raise exception using errcode='PT422', message='Mock config unavailable'; end if;
    if not exists (select 1 from public.question_bank_mock_subjects s where s.cert_id=p_cert)
      or (select sum(question_count) from public.question_bank_mock_subjects s where s.cert_id=p_cert) > 120 then
      raise exception using errcode='PT422', message='Mock subjects unavailable';
    end if;
    minutes := mock_config.duration_minutes;
    for r in select * from public.question_bank_mock_subjects s where s.cert_id=p_cert order by position loop
      select count(*), (array_agg(id))[1] into subjects_count, mapped_subject from public.question_bank_subjects
        where cert_id = p_cert and name in (r.internal_name, r.official_name);
      if subjects_count <> 1 then raise exception 'Subject mapping ambiguous'; end if;
      select coalesce(jsonb_agg(id order by rank, id), '[]') into picked from (
        select id, md5(seed || id::text) as rank from public.question_bank_questions
        where cert_id = p_cert and subject_id = mapped_subject and status = 'published' and jsonb_array_length(choices)=4 and answer between 0 and 3
        order by rank, id limit r.question_count
      ) q;
      if jsonb_array_length(picked) <> r.question_count then raise exception using errcode='PT422', message='Insufficient subject pool'; end if;
      ids := ids || picked;
    end loop;
  if (select count(distinct value) from jsonb_array_elements_text(ids)) <> jsonb_array_length(ids)
    or (select count(*) from public.question_bank_questions where id in (select value::uuid from jsonb_array_elements_text(ids)) and cert_id=p_cert and status='published') <> jsonb_array_length(ids)
    then raise exception 'Duplicate or unavailable questions'; end if;
  select jsonb_agg(distinct exam_id), jsonb_agg(distinct subject_id) into exam_ids, subject_ids
    from public.question_bank_questions where id in (select value::uuid from jsonb_array_elements_text(ids));
  identity := public.cbt_prepare_identity(p_user);
  started := clock_timestamp();
  cfg := jsonb_build_object('mode','mock','certId',p_cert,'certSlug',p_cert::text,'examIds',exam_ids,'subjectIds',subject_ids,
    'count',jsonb_array_length(ids),'order','ordered','target','all','gradeMode','submit','timeLimitMinutes',minutes,
    'seed',seed,'practiceNumber',identity->>'practiceNumber','displayNameSnapshot',identity->>'displayName',
    'serverManaged',true,'reviewIds','[]'::jsonb,'lockedIds','[]'::jsonb);
  cfg := cfg || jsonb_build_object('passRule',mock_config.pass_rule,'passScore',mock_config.pass_score,'calculatorAllowed',mock_config.calculator_allowed);
  insert into public.question_bank_attempts(user_id,client_id,config,question_ids,answers,started_at,end_at,status)
    values(p_user,'managed-' || gen_random_uuid()::text,cfg,ids,'{}',started,case when minutes is null then null else started+make_interval(mins=>minutes) end,'in_progress') returning * into a;
  return to_jsonb(a) - 'user_id';
end $$;

create function public.cbt_answer(p_user uuid, p_attempt text, p_question uuid, p_choice integer, p_review boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a public.question_bank_attempts; next_answers jsonb; reviews jsonb; locked jsonb;
begin
  select * into strict a from public.question_bank_attempts where user_id=p_user and client_id=p_attempt for update;
  if a.config->>'serverManaged' is distinct from 'true' then raise exception using errcode='PT403', message='Not server managed'; end if;
  if a.status <> 'in_progress' or (a.end_at is not null and clock_timestamp() >= a.end_at) then raise exception using errcode='PT409', message='Attempt closed'; end if;
  if p_question is null or not (a.question_ids ? p_question::text) or (p_choice is not null and (p_choice not between 0 and 3 or p_choice >= (select jsonb_array_length(choices) from public.question_bank_questions where id=p_question))) then raise exception using errcode='PT422', message='Invalid answer'; end if;
  next_answers := a.answers; reviews := coalesce(a.config->'reviewIds','[]'); locked := coalesce(a.config->'lockedIds','[]');
  if p_review is not null then
    reviews := reviews - p_question::text;
    if p_review then reviews := reviews || jsonb_build_array(p_question::text); end if;
  else
    if locked ? p_question::text then raise exception using errcode='PT409', message='Answer locked'; end if;
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
  if a.config->>'serverManaged' is distinct from 'true' then raise exception using errcode='PT403', message='Not server managed'; end if;
  if a.status not in ('in_progress','submitted') then raise exception using errcode='PT409', message='Attempt closed'; end if;
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
    -- Match legacy: correct answers master an existing note; do not create one.
    update public.question_bank_wrong_notes n set mastered=true
      from public.question_bank_questions q
      where n.user_id=p_user and n.question_id=q.id and a.question_ids ? q.id::text and a.answers->>q.id::text=q.answer::text;
  end if;
  return jsonb_build_object('answers',a.answers,'submittedAt',a.submitted_at,'score',a.score,'alreadySubmitted',already);
end $$;

revoke all on function public.cbt_prepare_identity(uuid), public.cbt_start(uuid,uuid,text,jsonb,integer,text), public.cbt_answer(uuid,text,uuid,integer,boolean), public.cbt_submit(uuid,text) from public, anon, authenticated;
grant execute on function public.cbt_prepare_identity(uuid), public.cbt_start(uuid,uuid,text,jsonb,integer,text), public.cbt_answer(uuid,text,uuid,integer,boolean), public.cbt_submit(uuid,text) to service_role;
-- No new schema is needed for #13/#19/#20: end_at, answers, stored IDs and
-- config.reviewIds suffice. GET renders expiry and warnings; only POST submits.
commit;
```

## 8. 실제 Preview Slow 3G 큐 검증 절차

**현재 실행 여부: 미실행.** 별도 Supabase 테스트 프로젝트/계정이 없고 Preview는 서버 저장 비활성 상태다.
이 상태에서 로컬 UI만 누른 결과를 서버 큐 검증 통과로 기록하지 않는다.
단위/격리 DB 검사는 이미 실행했고 아래는 테스트 DB가 연결된 실제 Preview에서 수행할 수 있는 절차다.

### 준비

1. 별도 테스트 Supabase에 기본 스키마와 UUID DRAFT 적용. 가상 문항만 넣고 매핑/유효 풀/20×3 확인 후 대상 UUID 구성 published.
2. Preview 환경에 정확한 NEXT_PUBLIC_SUPABASE_URL, publishable 키, 서버 전용 secret, CBT_SERVER_PROJECT_REFS=테스트_ref, NEXT_PUBLIC_CBT_SERVER_EXAMS=1 설정 후 재배포. 실제 UI의 미연결 안내가 사라지고 준비한 구성이 보여야 한다.
3. 테스트 계정으로 mock/submit 시작. 운영 도메인·운영 DB와 다름을 먼저 확인.
4. Chrome에서 ⌘⌥I → Network, Preserve log, Disable cache. Throttling의 Slow 3G 선택.
   해당 프리셋이 없으면 Custom/Add에서 “CBT QA Slow 3G” 프로필을 download 500 kbit/s, upload 500 kbit/s, latency 400 ms로 만들어 사용한다. 이는 명시한 QA 조건이며 브라우저 기본 프리셋과 동일하다고 가정하지 않는다.
5. answer/submit 요청을 필터링. 사용자 토큰·비밀 키·HAR 원본을 공유 문서에 붙이지 않는다.
6. 현재 응시의 선택 기록이 실제 테스트 DB에 저장되는 것을 확인한다. 시작 플래그/READY가 꺼져 로컬 경로인 시험은 대상이 아니다.

### 실행 및 기대 결과

| 케이스 | 조작 | UI 기대 | Network/DB 기대 |
|---|---|---|---|
| 1→4 연타 | 문제 영역에 포커스 후 1,2,3,4를 첫 저장 응답 전 연타 | 마지막 ④ 즉시 표시; 입력/이동 가능; 오래된 응답이 선택을 되돌리지 않음 | 같은 qid 요청은 직렬, 0→1→2→3 순서. 마지막 DB answers[qid]=3 |
| 이동하며 다른 문항 선택 | 12번 선택 요청 대기 중 13번 이동·선택 | 이동·13번 선택이 즉시 가능 | 13번 저장은 12번 클라이언트 큐 완료를 기다리지 않음. DB의 FOR UPDATE 때문에 짧은 서버 잠금 대기는 정상 |
| 마지막 선택 저장 실패 | 응답 완료된 기준 선택 확보 → answer URL을 Request blocking에 추가 → 다른 선택 → 다른 문항 이동 | 이동 가능; 실패한 문항만 이전 저장된 선택으로 복원·오류 토스트. 다른 문항 값 유지 | 실패 요청은 DB에 반영되지 않음. 마지막 실패가 있으면 flush/제출 진행 차단 |
| 오래된 실패+새 선택 | 첫 선택 요청을 차단한 채 연타, 마지막 요청 전 차단 해제 | 오래된 실패가 최신 낙관적 선택을 덮지 않음 | 같은 문항 최신 저장 성공 시 오류 상태 해소. 타이밍별 응답을 기록 |
| 실패 복구 | blocking 해제 후 실패 문항을 재선택 | 새 선택 즉시 표시, 성공 후 유지 | 저장 200. 테스트 DB 최종값 일치 |
| 제출 직전 대기 | 미저장 선택 후 제출 점검→최종 제출→확정 | 저장 중 제출 중 상태; 새로운 선택은 제출 동안 잠금 | 모든 큐 성공 뒤에만 submit POST. 마지막 answer 응답 전에 submit 발송 없음 |
| 제출 대기 중 실패 | answer를 차단한 상태에서 확정 | 결과 화면으로 이동하지 않음; 재선택/재시도 가능 | submit POST 없음; status=in_progress |
| 두 탭/새로고침 | 저장 성공 후 재로드, 같은 ID를 두 탭에서 최종 제출 | 선택 복원; 최초 결과 동일 | 응시 1행, 최초 answers/score/submitted_at 유지; 오답 count 1회만 증가 |

Network 요청 취소/차단은 아직 전송되지 않은 다음 요청에 적용할 수 있다. 진행 중 요청을 실패시킬 때는 Offline 전환을 따로 시험하고, 복구 후 같은 문항 재선택으로 성공 상태를 만든다.
Offline은 연결 전체에 영향을 주므로 “다른 문항도 서버 저장 성공”을 기대하지 않는다. UI 이동/낙관적 선택 가능 여부와 문항별 복원만 확인한다.
서버가 이미 저장했으나 응답만 끊긴 경우의 최종 DB 값은 재연결 SELECT로 확인하고 재선택으로 일치시킨다.
정답 노출을 보는 즉시 채점 맞춤 시험지는 연타 최종값 시험 대상이 아니다. 이번 대상은 mock/submit이다.

### SQL 확인

테스트 관리자 연결에서만 전용 ID를 넣는다. 0-based 보기 값에 주의.
```sql
select client_id,status,answers,submitted_at,score from public.question_bank_attempts
where user_id='TEST_USER_UUID'::uuid and client_id='TEST_ATTEMPT_ID';
select count(*) from public.question_bank_attempts
where user_id='TEST_USER_UUID'::uuid and client_id='TEST_ATTEMPT_ID';
select answers->>'TEST_QUESTION_UUID' as selected_choice from public.question_bank_attempts
where user_id='TEST_USER_UUID'::uuid and client_id='TEST_ATTEMPT_ID';
```

두 실제 DB 연결 재현:
```sh
CBT_QA_PACKAGE_JSON=/tmp/cbt-qa/package.json node scripts/validate-cbt-local-concurrency.mjs
# Hosted 실행은 테스트 관리자 URL, CBT_QA_PROJECT_REF, CBT_QA_USER_ID,
# CBT_QA_CERT_ID, CBT_QA_CONFIRM_TEST_DB=YES가 모두 필요.
CBT_QA_PACKAGE_JSON=/tmp/cbt-qa/package.json node scripts/validate-cbt-two-connections.mjs
```

Chrome 조작 근거: [공식 Network 문서](https://developer.chrome.com/docs/devtools/network/reference#throttling).
프리셋 명칭은 버전마다 다를 수 있어 Custom profile 절차를 함께 제공한다.

## 9. 2001년 4회 빠진 번호와 원인 확인

2026-10-02 공개 API로 문제 본문·정답·응시 행 없이 번호/과목/상태/소스 메타데이터만 읽었다.
공개 RLS 범위로 검증한 결과이며 “전체 DB에서 행이 없다”는 결론은 내리지 않는다.

| 과목 | 공개 번호 범위 | 빠진 공개 번호 | 공개 수 | 원인 |
|---|---|---:|---:|---|
| 색채 → 색채 및 조색 | 1–20 | 12 | 19 | [확인 필요] |
| 금속도장 → 금속도장 작업 및 안전 | 41–60 | 43 | 19 | [확인 필요] |

금속도장재료는 21–40 전체 공개. 해당 exam.question_count=58, 공개 문항 58.
다른 종목의 범위나 모의시험 출제 순서에 위 원본 번호 범위를 적용하지 않는다.
연결된 Supabase MCP 계정의 프로젝트 목록에는 이 운영 ref가 없으며, 작업 저장소에 해당 운영 관리자 접속 키도 없다. 다른 프로젝트에 진단 SQL을 실행하지 않았다.
공개 행의 이미지 정보로 빠진 12/43번이 이미지 문제였다고 추정하지 않는다.

진단 SQL: **docs/cbt-missing-questions.READONLY.sql 전체**.
1. 1–60 번호와 모든 상태의 행을 LEFT JOIN; published가 1개가 아닌 번호 검출.
2. 12/43의 상태·수입 batch·source UID/page·needs_visual_review·자산 개수 확인.
3. 수입 batch의 row/error count와 metadata 및 NAS 원본 번호/페이지 대조.
4. 행이 남아 있으면 broken_image 등 신고 종류/상태 확인.
익명/일반 사용자 연결로 결과가 NULL이면 RLS 비가시성이 포함된다. 관리자가 전체 상태를 볼 수 있는 읽기 전용 연결로 실행해야 원인 분류가 가능하다.

| 확인 결과 | 처리 |
|---|---|
| draft/needs_review 행 존재 | 검토 이유·보기/정답·소스/권리 확인 후 테스트 DB에서 검증, 승인 후 공개 |
| 행 없음 + 원본 존재 | 수입/파싱 로그와 원본 12/43 대조; 같은 source UID를 사용해 중복 없이 복구하고 테스트 검증 |
| 이미지 검토 근거 있음 | 자산 경로/권리/렌더링 확인. 임의 텍스트 문제로 대체하지 않음 |
| 원본에 없거나 출처/재배포 조건 불명 | 58문항으로 정확히 표시, 누락 고지 유지; 검증 없이 수량만 60으로 수정하지 않음 |
| 공개 중복 또는 다른 과목 매핑 | source UID/문항 번호/과목 기준으로 중복·매핑 검토, 기존 응시 question_ids/정답 스냅샷 영향 평가 후 수정 |
| 각 과목 전체 유효 풀이 20 이상 | 일부 회차 누락과 별개로 전체 풀 20/20/20 mock 가능 |
| 한 과목 유효 풀 20 미만 | mock 시작 차단, 응시 행 생성 없음 |

원인/복구는 운영 쓰기 작업이 아니다. 이번에는 진단 쿼리·처리 계획만 제공하며 누락 문항을 생성/공개하지 않았다.

## 테스트 결과

| 검사 | 결과 |
|---|---|
| Next.js production build + 앱 계약/타입 검사 | 통과 |
| 낙관적 큐: 연타/문항별 동시성/오래된 ACK/실패 복원/flush | 통과 |
| 7일 경계, 최근 열람, 완료/만료 제외, 잘못된 날짜 | 통과 |
| 허용 목록 빈 값/다른 ref/정확한 HTTPS 호스트/비-mock 시작 거부 | 통과 |
| 격리 PostgreSQL: UUID 이름 변경·중복, 100회 20/20/20, DELETE 거부, legacy I/U, RLS/RPC/NULL/mastered | 통과 |
| 임시 native PostgreSQL 18.4의 실제 두 연결 | 통과 — B Lock 대기, 최초 결과/1행 유지, 모든 클라이언트 DELETE 거부 |
| 읽기 전용 누락 진단 SQL | 격리 스키마에서 문법/열 확인; 운영 관리자 전체 상태 조회는 미실행 |
| 실제 Preview Slow 3G·Supabase Auth/REST·두 탭 | 미완료 — 별도 테스트 프로젝트/계정 필요 |
| 운영 병합/SQL 적용/누락 문제 복구 | 미실행 |

## 롤아웃/롤백

| 단계 | 실행 | 되돌리기 |
|---|---|---|
| 기본 | refs 빈 값, 시작 0, Draft PR | 현재 운영 main 유지 |
| 테스트 준비 | 새 테스트 DB·UUID 시드·구성 draft·유효 풀 검증 | 실패한 SQL 트랜잭션 rollback; 운영 연결 없음 |
| 테스트 활성화 | 테스트 ref만 Preview 허용 목록, 서버 키·URL 확인, 구성 published, 시작 1 후 재빌드 | 신규 시작 플래그 0 후 재빌드. 기존 ref/키/API 유지해 진행 중 응시 종료 |
| 병합 게이트 | Auth/REST·Slow 3G·두 연결·브라우저 회귀 완료. A 유지 | 게이트 미통과면 Draft 유지, 병합 없음 |
| 운영 검토 | 운영 전용 마이그레이션/백업/URL·키·ref 승인 후 환경별 명시 허용 | 신규 시작 0 우선. 허용 목록을 비우면 저장/제출까지 막히므로 긴급 전체 차단 때만 사용 |
| 이번 범위 이후 | mock만 모니터링 | custom/past/subject 전환은 별도 PR |

NEXT_PUBLIC_* 및 next.config의 READY는 빌드 값이므로 환경 변경 후 재배포 필요.
신규 시작 OFF는 기존 관리 응시 answer/submit을 끄지 않는다. 반대로 refs 제거는 모든 서버 시험 API를 차단한다.
DB UUID 전환 후 이름 기반 구버전 앱으로 롤백하면 구성 조회가 깨진다. 호환 API/UUID 스키마를 유지하며 시작 플래그로 먼저 되돌린다.
DELETE 권한은 롤백 시에도 재부여하지 않는다. RLS와 서버 관리 플래그는 삭제/로컬 행으로 강등하지 않는다.
7일 표시 되돌리기는 화면 변경 또는 로컬 visits 키 제거로 충분하다. DB 상태에는 변화가 없다.
DRAFT 전문은 기존 스키마 위에 반복 실행하는 운영 마이그레이션이 아니다.

## 결정/미확인

- [결정 필요] A 유지 또는 B 자유 출제 추가. 현재 A.
- [결정 필요] 운영 허용 목록에 실제 ref를 추가하는 시점. 현재 빈 값/OFF.
- [결정 필요] 오래된 기록 7일 기준 변경 여부. 현재 7일.
- [확인 필요] 12/43번 비공개 상태/수입 누락/이미지/원본의 실제 원인.
- [확인 필요] 운영 전체 유효 보기·정답 풀, 별도 테스트 DB 및 실제 Preview 검증.

