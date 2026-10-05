begin;
set local lock_timeout = '5s';

-- Keep historical samples and totals; their reserved hash retains legacy deduplication.
alter table public.question_bank_response_samples
  add column attempt_hash text not null default repeat('0',64)
  check (attempt_hash ~ '^[a-f0-9]{64}$');
alter table public.question_bank_response_samples
  drop constraint question_bank_response_samples_pkey,
  add primary key (qualification_code,question_ref,revision,visitor_hash,attempt_hash);

create or replace function public.record_question_bank_responses(p_visitor_hash text,p_rows jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_visitor_hash is null or p_visitor_hash !~ '^[a-f0-9]{64}$' or p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 100 then
    raise exception 'invalid_response_batch';
  end if;
  -- The sample key handles retries atomically; new attempts may contribute without a daily cap.
  with fresh as (
    insert into public.question_bank_response_samples(qualification_code,question_ref,revision,visitor_hash,attempt_hash,correct)
    select r.qualification_code,r.question_ref,r.revision,p_visitor_hash,coalesce(r.attempt_hash,repeat('0',64)),r.correct
    from jsonb_to_recordset(p_rows) as r(qualification_code text,question_ref text,revision text,attempt_hash text,correct boolean)
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

commit;
