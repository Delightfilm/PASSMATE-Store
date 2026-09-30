create table if not exists public.question_bank_issue_reports (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  question_id uuid not null references public.question_bank_questions(id) on delete cascade,
  attempt_id text,
  kind text not null check(kind in ('wrong_answer','broken_image','missing_choice','other')),
  memo text not null default '',
  status text not null default 'open' check(status in ('open','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

alter table public.question_bank_attempts add column if not exists client_id text;
create unique index if not exists question_bank_attempts_user_client_idx
  on public.question_bank_attempts(user_id, client_id);

create index if not exists question_bank_issue_reports_status_idx
  on public.question_bank_issue_reports(status, created_at desc);
create index if not exists question_bank_issue_reports_user_idx
  on public.question_bank_issue_reports(user_id);
create index if not exists question_bank_issue_reports_question_idx
  on public.question_bank_issue_reports(question_id);
create index if not exists question_bank_issue_reports_resolver_idx
  on public.question_bank_issue_reports(resolved_by);

alter table public.question_bank_issue_reports enable row level security;

create policy "anyone creates question reports"
  on public.question_bank_issue_reports for insert
  with check (user_id is null or user_id = (select auth.uid()));

create policy "users read own question reports"
  on public.question_bank_issue_reports for select
  using (user_id = (select auth.uid()));
