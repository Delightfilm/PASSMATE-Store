-- READ-ONLY catalog checks; do not open production in_progress attempts.
-- Connection/project ref must be independently verified before execution.
-- 19 * 60 = 1,140, while stated inventory is 1,138; at least two missing
-- occurrences must be located. Fixed mock sampling does not require each round
-- to have 20 questions, only a verified mapping and >=20 available per subject.
select c.name as cert,e.year,e.round,s.name as internal_subject,
  r.official_name, count(q.id)::int as published,
  r.question_count as expected,
  greatest(r.question_count-count(q.id)::int,0) as missing,
  case when count(q.id)=r.question_count then '정상' when count(q.id)<r.question_count then '부족' else '초과' end as result
from public.question_bank_exams e
join public.question_bank_certs c on c.id=e.cert_id
join public.question_bank_subjects s on s.cert_id=c.id
join public.question_bank_mock_subjects r on r.cert_name=c.name and s.name in (r.internal_name,r.official_name)
left join public.question_bank_questions q on q.exam_id=e.id and q.subject_id=s.id and q.status='published'
where c.name='금속도장기능사'
group by c.name,e.id,e.year,e.round,s.id,s.name,s.part_number,r.official_name,r.question_count
order by e.year desc,e.round,s.part_number,s.name;

-- Mapping must match exactly one subject. Valid all-round pool decides mock readiness.
select r.cert_name,r.official_name,r.question_count as required,
  count(distinct s.id)::int as mapped_subjects,
  count(q.id) filter(where jsonb_array_length(q.choices)=4 and q.answer between 0 and 3)::int as valid_pool,
  case when count(distinct s.id)=1 and count(q.id) filter(where jsonb_array_length(q.choices)=4 and q.answer between 0 and 3)>=r.question_count then '출제 가능' else '시작 차단' end as mock_status
from public.question_bank_mock_subjects r
join public.question_bank_certs c on c.name=r.cert_name
left join public.question_bank_subjects s on s.cert_id=c.id and s.name in (r.internal_name,r.official_name)
left join public.question_bank_questions q on q.cert_id=c.id and q.subject_id=s.id and q.status='published'
group by r.cert_name,r.position,r.official_name,r.question_count order by r.cert_name,r.position;

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

-- Legacy client INSERT/UPDATE must be true; direct RPC execute must be false.
-- Grants alone cannot prove managed rows are blocked: run the two-connection script.
select has_table_privilege('authenticated','public.question_bank_attempts','UPDATE') as client_update,
  has_table_privilege('authenticated','public.question_bank_attempts','INSERT') as client_insert,
  has_function_privilege('authenticated','public.cbt_start(uuid,uuid,text,jsonb,integer,text)','EXECUTE') as client_start,
  has_function_privilege('anon','public.cbt_submit(uuid,text)','EXECUTE') as anon_submit;
select policyname,permissive,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename='question_bank_attempts' order by policyname;

-- All functions fix search_path; they intentionally use SECURITY INVOKER.
select proname,prosecdef,proconfig from pg_proc
where oid in ('public.cbt_start(uuid,uuid,text,jsonb,integer,text)'::regprocedure,
  'public.cbt_answer(uuid,text,uuid,integer,boolean)'::regprocedure,
  'public.cbt_submit(uuid,text)'::regprocedure,
  'public.cbt_prepare_identity(uuid)'::regprocedure);
