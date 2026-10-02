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
