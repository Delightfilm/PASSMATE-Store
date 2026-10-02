-- NAS content remains public static files; only small owner-scoped records live here.
create table if not exists public.question_bank_user_question_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_ref text not null check (question_ref ~ '^[a-f0-9]{20}$'),
  qualification_code text not null check (char_length(qualification_code) between 1 and 80),
  bookmarked boolean not null default false,
  wrong_count integer not null default 0 check (wrong_count >= 0),
  last_wrong_at timestamptz,
  memo text not null default '' check (char_length(memo) <= 4000),
  mastered boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, question_ref)
);
alter table public.question_bank_user_question_state enable row level security;
revoke all on public.question_bank_user_question_state from anon, authenticated;
grant select, insert, update, delete on public.question_bank_user_question_state to authenticated;
create policy "users read own NAS question state" on public.question_bank_user_question_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "users insert own NAS question state" on public.question_bank_user_question_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users update own NAS question state" on public.question_bank_user_question_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users delete own NAS question state" on public.question_bank_user_question_state for delete to authenticated using ((select auth.uid()) = user_id);

-- Keep the existing admin issue queue and legacy UUID foreign key intact.
alter table public.question_bank_issue_reports alter column question_id drop not null;
alter table public.question_bank_issue_reports add column question_ref text check (question_ref ~ '^[a-f0-9]{20}$');
alter table public.question_bank_issue_reports add constraint question_bank_issue_reports_has_question check (question_id is not null or question_ref is not null);
