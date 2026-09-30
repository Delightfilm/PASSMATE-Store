create extension if not exists pgcrypto;

create table if not exists public.question_bank_certs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_bank_subjects (
  id uuid primary key default gen_random_uuid(),
  cert_id uuid not null references public.question_bank_certs(id) on delete cascade,
  external_id text not null,
  part_number int,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cert_id, external_id)
);

create table if not exists public.question_bank_exams (
  id uuid primary key default gen_random_uuid(),
  cert_id uuid not null references public.question_bank_certs(id) on delete cascade,
  external_id text not null,
  exam_date date,
  year int not null,
  round text not null,
  title text not null,
  source_url text,
  duration_minutes int not null default 60 check(duration_minutes > 0),
  pass_score numeric(5,2) not null default 60,
  question_count int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cert_id, external_id)
);

create table if not exists public.question_bank_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  schema_version text,
  qualification_code text not null,
  status text not null default 'importing'
    check(status in ('importing', 'needs_review', 'published', 'rolled_back', 'failed')),
  row_count int not null default 0,
  error_count int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  published_at timestamptz,
  rolled_back_at timestamptz
);

create table if not exists public.question_bank_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.question_bank_exams(id) on delete cascade,
  cert_id uuid not null references public.question_bank_certs(id) on delete cascade,
  subject_id uuid references public.question_bank_subjects(id) on delete set null,
  no int not null check(no > 0),
  stem text not null,
  images jsonb not null default '[]'::jsonb,
  choices jsonb not null default '[]'::jsonb,
  answer int not null check(answer >= 0),
  explanation text not null default '',
  status text not null default 'needs_review'
    check(status in ('draft', 'needs_review', 'published')),
  source_hash text not null,
  source_question_uid text not null,
  source_uid text,
  source_page int,
  answer_status text,
  review_status text,
  metadata jsonb not null default '{}'::jsonb,
  import_batch_id uuid not null references public.question_bank_import_batches(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(import_batch_id, source_question_uid)
);

create table if not exists public.question_bank_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  config jsonb not null,
  question_ids jsonb not null default '[]'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  end_at timestamptz,
  submitted_at timestamptz,
  score numeric(5,2),
  status text not null default 'in_progress' check(status in ('in_progress','submitted'))
);

create table if not exists public.question_bank_wrong_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.question_bank_questions(id) on delete cascade,
  wrong_count int not null default 1,
  last_wrong_at timestamptz not null default now(),
  memo text not null default '',
  mastered boolean not null default false,
  primary key(user_id, question_id)
);

create table if not exists public.question_bank_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.question_bank_questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, question_id)
);

create table if not exists public.question_bank_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  config jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists question_bank_questions_exam_idx
  on public.question_bank_questions(exam_id, no);
create index if not exists question_bank_questions_status_idx
  on public.question_bank_questions(status);
create index if not exists question_bank_questions_source_hash_idx
  on public.question_bank_questions(source_hash);
create index if not exists question_bank_questions_source_uid_idx
  on public.question_bank_questions(source_question_uid);
create index if not exists question_bank_import_batches_created_idx
  on public.question_bank_import_batches(created_at desc);
create index if not exists question_bank_attempts_user_idx
  on public.question_bank_attempts(user_id, started_at desc);

alter table public.question_bank_certs enable row level security;
alter table public.question_bank_subjects enable row level security;
alter table public.question_bank_exams enable row level security;
alter table public.question_bank_questions enable row level security;
alter table public.question_bank_import_batches enable row level security;
alter table public.question_bank_attempts enable row level security;
alter table public.question_bank_wrong_notes enable row level security;
alter table public.question_bank_bookmarks enable row level security;
alter table public.question_bank_presets enable row level security;

create policy "question certs readable"
  on public.question_bank_certs for select using (true);
create policy "question subjects readable"
  on public.question_bank_subjects for select using (true);
create policy "question exams readable"
  on public.question_bank_exams for select using (true);
create policy "published questions readable"
  on public.question_bank_questions for select using (status = 'published');
create policy "users read own attempts"
  on public.question_bank_attempts for select using (auth.uid() = user_id);
create policy "users create attempts"
  on public.question_bank_attempts for insert
  with check (auth.uid() = user_id or user_id is null);
create policy "users update attempts"
  on public.question_bank_attempts for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage wrong notes"
  on public.question_bank_wrong_notes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage bookmarks"
  on public.question_bank_bookmarks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage presets"
  on public.question_bank_presets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.question_bank_publish_batch(p_batch_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if not exists (
    select 1 from public.question_bank_import_batches
    where id = p_batch_id and status = 'needs_review'
  ) then
    raise exception 'batch_not_ready';
  end if;

  -- Re-importing the same source occurrence supersedes the older copy, but
  -- identical content from different source occurrences is always preserved.
  update public.question_bank_questions old_question
  set status = 'draft', updated_at = now()
  where old_question.status = 'published'
    and old_question.import_batch_id <> p_batch_id
    and exists (
      select 1
      from public.question_bank_questions new_question
      where new_question.import_batch_id = p_batch_id
        and new_question.source_question_uid = old_question.source_question_uid
    );

  update public.question_bank_questions
  set status = 'published', updated_at = now()
  where import_batch_id = p_batch_id;
  get diagnostics v_count = row_count;

  update public.question_bank_import_batches
  set status = 'published', published_at = now(), completed_at = coalesce(completed_at, now())
  where id = p_batch_id;

  update public.question_bank_exams exam
  set question_count = counts.question_count, updated_at = now()
  from (
    select exam_id, count(*)::integer as question_count
    from public.question_bank_questions
    where status = 'published'
    group by exam_id
  ) counts
  where exam.id = counts.exam_id;

  return v_count;
end;
$$;

revoke all on function public.question_bank_publish_batch(uuid) from public, anon, authenticated;
grant execute on function public.question_bank_publish_batch(uuid) to service_role;
