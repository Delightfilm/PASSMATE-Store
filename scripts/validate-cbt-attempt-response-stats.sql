-- Run against the migrated database. All test samples and aggregates are rolled back.
begin;
do $test$
declare
  visitor text := repeat(replace(gen_random_uuid()::text,'-',''),2);
  ref text := substr(replace(gen_random_uuid()::text,'-',''),1,20);
  rev text := repeat(replace(gen_random_uuid()::text,'-',''),2);
  row_a jsonb;
  row_b jsonb;
  legacy jsonb;
  batch jsonb;
  total bigint;
  correct bigint;
  i integer;
begin
  row_a := jsonb_build_object('qualification_code','qa-attempt-stats','question_ref',ref,'revision',rev,'attempt_hash',repeat('a',64),'correct',false);
  row_b := row_a || jsonb_build_object('attempt_hash',repeat('b',64),'correct',true);
  legacy := (row_a - 'attempt_hash') || jsonb_build_object('correct',true);
  perform public.record_question_bank_responses(visitor,jsonb_build_array(row_a));
  perform public.record_question_bank_responses(visitor,jsonb_build_array(row_a || jsonb_build_object('correct',true),row_a));
  select total_count,correct_count into total,correct from public.question_bank_response_stats where qualification_code='qa-attempt-stats' and question_ref=ref and revision=rev;
  assert total=1 and correct=0, 'Same-attempt retries must not add or change a response';
  perform public.record_question_bank_responses(visitor,jsonb_build_array(row_b));
  select total_count,correct_count into total,correct from public.question_bank_response_stats where qualification_code='qa-attempt-stats' and question_ref=ref and revision=rev;
  assert total=2 and correct=1, 'A second attempt from the same browser must contribute';
  perform public.record_question_bank_responses(visitor,jsonb_build_array(legacy));
  perform public.record_question_bank_responses(visitor,jsonb_build_array(legacy || jsonb_build_object('correct',false)));
  select total_count,correct_count into total,correct from public.question_bank_response_stats where qualification_code='qa-attempt-stats' and question_ref=ref and revision=rev;
  assert total=3 and correct=2, 'Legacy requests remain idempotent alongside new attempts';
  for i in 0..30 loop
    select jsonb_agg(row_a || jsonb_build_object('attempt_hash',repeat(md5('bulk-' || n::text),2),'correct',n%2=0))
    into batch from generate_series(i*100+1,i*100+100) n;
    perform public.record_question_bank_responses(visitor,batch);
  end loop;
  select total_count,correct_count into total,correct from public.question_bank_response_stats where qualification_code='qa-attempt-stats' and question_ref=ref and revision=rev;
  assert total=3103 and correct=1552, 'Repeated solving must not stop at the former daily 3000-response bound';
  begin
    perform public.record_question_bank_responses(visitor,jsonb_build_array(row_a || jsonb_build_object('attempt_hash','invalid')));
    raise exception 'Invalid attempt hash was accepted';
  exception when check_violation then null;
  end;
  assert not has_function_privilege('anon','public.record_question_bank_responses(text,jsonb)','EXECUTE');
  assert not has_function_privilege('authenticated','public.record_question_bank_responses(text,jsonb)','EXECUTE');
  assert not has_table_privilege('anon','public.question_bank_response_samples','SELECT');
  assert not has_table_privilege('authenticated','public.question_bank_response_samples','INSERT');
end;
$test$;
rollback;
select true as repeated_attempt_and_retry_tests_passed,
  (select count(*) from public.question_bank_response_samples) as persisted_samples,
  (select coalesce(sum(total_count),0) from public.question_bank_response_stats) as persisted_total;
