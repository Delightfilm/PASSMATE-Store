-- READ-ONLY catalog checks; do not open production in_progress attempts.
-- Connection/project ref must be independently verified before execution.
-- 19 * 60 = 1,140, while stated inventory is 1,138; at least two missing
-- occurrences must be located. Fixed mock sampling does not require each round
-- to have 20 questions, only a verified mapping and >=20 available per subject.
select e.year, e.round, s.name, count(q.id)::int as available
from public.question_bank_exams e
join public.question_bank_certs c on c.id=e.cert_id
join public.question_bank_subjects s on s.cert_id=c.id
left join public.question_bank_questions q on q.exam_id=e.id and q.subject_id=s.id and q.status='published'
where c.name='금속도장기능사'
group by e.id,e.year,e.round,s.id,s.name
order by e.year desc,e.round,s.part_number,s.name;

-- TEST DB ONLY. Fill the temporary test attempt ID. No updates in this file.
-- Before/after GET, browser reload and expired record display: compare all fields.
select client_id,status,question_ids,answers,config->>'seed' as seed,
  config->>'practiceNumber' as practice_number,started_at,end_at,submitted_at,score
from public.question_bank_attempts
where client_id = 'REPLACE_WITH_TEST_ATTEMPT_ID';

-- Exactly one row; two final submit responses must retain identical score,
-- submittedAt and answers. Second RPC response has alreadySubmitted=true.
select client_id,count(*),min(score),max(score),min(submitted_at),max(submitted_at)
from public.question_bank_attempts where client_id='REPLACE_WITH_TEST_ATTEMPT_ID'
group by client_id;

-- Internal QA: daily number uniqueness; service_role/admin only.
select day,count(*) as registered,count(distinct number) as unique_numbers
from cbt_private.daily_numbers group by day;

-- RPC/table grants: all client-write/execute columns must be false.
select has_table_privilege('authenticated','public.question_bank_attempts','UPDATE') as client_update,
  has_table_privilege('authenticated','public.question_bank_attempts','INSERT') as client_insert,
  has_function_privilege('authenticated','public.cbt_start(uuid,uuid,text,jsonb,integer,text)','EXECUTE') as client_start,
  has_function_privilege('anon','public.cbt_submit(uuid,text)','EXECUTE') as anon_submit;

-- All functions fix search_path; they intentionally use SECURITY INVOKER.
select proname,prosecdef,proconfig from pg_proc
where oid in ('public.cbt_start(uuid,uuid,text,jsonb,integer,text)'::regprocedure,
  'public.cbt_answer(uuid,text,uuid,integer,boolean)'::regprocedure,
  'public.cbt_submit(uuid,text)'::regprocedure,
  'public.cbt_prepare_identity(uuid)'::regprocedure);
