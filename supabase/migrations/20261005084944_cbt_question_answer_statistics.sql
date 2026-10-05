-- Private, first-response samples. Public clients see only Next-served aggregates.
create table public.question_bank_stats_credentials (
  id boolean primary key default true check (id),
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$')
);
alter table public.question_bank_stats_credentials enable row level security;
revoke all on public.question_bank_stats_credentials from public,anon,authenticated;
grant select on public.question_bank_stats_credentials to service_role;

create table public.question_bank_response_samples (
  qualification_code text not null check (length(qualification_code) between 1 and 80),
  question_ref text not null check (length(question_ref) between 20 and 36),
  revision text not null check (revision ~ '^[a-f0-9]{64}$'),
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  correct boolean not null,
  created_at timestamptz not null default now(),
  primary key (qualification_code,question_ref,revision,visitor_hash)
);
create index question_bank_response_samples_visitor_time on public.question_bank_response_samples(visitor_hash,created_at);
create table public.question_bank_response_stats (
  qualification_code text not null,
  question_ref text not null,
  revision text not null,
  total_count bigint not null check (total_count >= 0),
  correct_count bigint not null check (correct_count >= 0 and correct_count <= total_count),
  primary key (qualification_code,question_ref,revision)
);
create index question_bank_response_stats_revision on public.question_bank_response_stats(revision);
alter table public.question_bank_response_samples enable row level security;
alter table public.question_bank_response_stats enable row level security;
revoke all on public.question_bank_response_samples,public.question_bank_response_stats from public,anon,authenticated;
grant select,insert,update on public.question_bank_response_samples,public.question_bank_response_stats to service_role;

create function public.record_question_bank_responses(p_visitor_hash text,p_rows jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_visitor_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 100 then
    raise exception 'invalid_response_batch';
  end if;
  -- Serialize per visitor: retries/concurrent tabs cannot increment twice or bypass the daily bound.
  perform pg_advisory_xact_lock(hashtextextended(p_visitor_hash,0));
  if (select count(*) from public.question_bank_response_samples where visitor_hash=p_visitor_hash and created_at>=now()-interval '1 day') + jsonb_array_length(p_rows) > 3000 then
    raise exception 'daily_response_limit';
  end if;
  with fresh as (
    insert into public.question_bank_response_samples(qualification_code,question_ref,revision,visitor_hash,correct)
    select r.qualification_code,r.question_ref,r.revision,p_visitor_hash,r.correct
    from jsonb_to_recordset(p_rows) as r(qualification_code text,question_ref text,revision text,correct boolean)
    on conflict do nothing returning qualification_code,question_ref,revision,correct
  )
  insert into public.question_bank_response_stats(qualification_code,question_ref,revision,total_count,correct_count)
  select qualification_code,question_ref,revision,count(*),count(*) filter(where correct) from fresh group by qualification_code,question_ref,revision
  on conflict (qualification_code,question_ref,revision) do update set
    total_count=public.question_bank_response_stats.total_count+excluded.total_count,
    correct_count=public.question_bank_response_stats.correct_count+excluded.correct_count;
end;
$$;
revoke all on function public.record_question_bank_responses(text,jsonb) from public,anon,authenticated;
grant execute on function public.record_question_bank_responses(text,jsonb) to service_role;
