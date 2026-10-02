-- READ ONLY. Catalog metadata only; never query/open production attempts.
-- Known live exam UUID, independently checked 2026-10-02: 2001 / 4회.
-- Run with the catalog administrator to distinguish hidden rows from absent rows.
-- anon/authenticated SELECT is RLS filtered: NULL means "not visible", not "absent".
-- EXECUTION (operator): verify host/project ref and use a read-only catalog
-- administrator connection with SELECT permission on the five catalog tables
-- below + admin_action_events. A separate read-only role may need BYPASSRLS or
-- administrative catalog SELECT policies to distinguish absent from hidden rows.
-- Never use an app service credential merely to run this report. Check this file
-- contains only BEGIN READ ONLY / SELECT / COMMIT: no RPC, UPDATE, INSERT, DELETE.
-- Excludes attempts, user IDs, question stem/choices/answer/explanation, asset URLs,
-- full metadata/detail JSON and issue-report free text. Treat file names/source IDs
-- as internal catalog data; share only the diagnostic counts/statuses.
-- RESULT / INTERPRETATION / NEXT ACTION:
-- no visible row | read-only role may be RLS-filtered | admin SELECT then source manifest
-- no admin row   | import absence; cause unproven    | match source UID/page + import batch
-- nonpublished   | draft/review/disabled row exists | review before publishing; don't force status
-- assets/review  | image count is a review clue     | compare authorized NAS source; not proof of loss
-- duplicate no   | more than one published row     | verify source IDs, correct import in separate PR
-- source 60/import 58 | parser/validation possible  | inspect original + error log on NAS, no fake fill
-- count 58/published 58 | current public count agrees | NOT evidence that original had only 58
-- count != published | stale/mixed count possible  | inspect publish audit; separate corrective review
-- Expected result columns: no/status/subject/import batch/source UID/page/assets.
-- With no q row, source UID/page/assets must remain NULL, not invented.
begin read only;

-- This particular source round uses 색채 1–20 / 재료 21–40 / 도장 41–60.
-- These are source number ranges, not mock sampling order.
with expected as (
  select n, case when n<=20 then '색채' when n<=40 then '금속도장재료' else '금속도장' end as source_subject
  from generate_series(1,60) n
)
select e.n as question_no,e.source_subject,
  count(q.id)::int as visible_rows,
  count(q.id) filter(where q.status='published')::int as published_rows,
  coalesce(string_agg(distinct q.status,', '),'조회 가능한 행 없음') as visible_statuses,
  case when count(q.id)=0 then 'DB 미존재 또는 RLS 비공개 — 관리자 확인'
       when count(q.id) filter(where q.status='published')=0 then '비공개 상태 행 존재'
       else '공개 중복 확인' end as follow_up
from expected e left join public.question_bank_questions q
  on q.exam_id='7e0f9af1-f77a-4986-bb8a-e2ee2a9d001b'::uuid and q.no=e.n
group by e.n,e.source_subject
having count(q.id) filter(where q.status='published')<>1
order by e.n;

-- No stem/choices/answer or personal information selected.
-- needs_visual_review is evidence for review, never proof of the missing cause.
select q.id,q.no,q.status,s.name as subject,q.import_batch_id,
  q.source_question_uid,q.source_uid,q.source_page,q.review_status,q.answer_status,
  q.metadata->>'needs_visual_review' as needs_visual_review,
  case when jsonb_typeof(q.images)='array' then jsonb_array_length(q.images) else 0 end as image_count,
  case when jsonb_typeof(q.metadata->'visual_assets')='array' then jsonb_array_length(q.metadata->'visual_assets') else 0 end as visual_asset_count,
  q.created_at,q.updated_at
from public.question_bank_questions q
left join public.question_bank_subjects s on s.id=q.subject_id
where q.exam_id='7e0f9af1-f77a-4986-bb8a-e2ee2a9d001b'::uuid and q.no in (12,43)
order by q.no,q.created_at;

-- This may identify parser/validation errors; actual original file stays on NAS.
-- Restricted administrative catalog data; inspect metadata locally, never paste secrets.
select b.id,b.file_name,b.status,b.row_count,b.error_count,
  b.metadata->>'expected_questions' as import_expected_questions,
  b.created_at,b.completed_at,b.published_at
from public.question_bank_import_batches b
where b.id in (select distinct import_batch_id from public.question_bank_questions
  where exam_id='7e0f9af1-f77a-4986-bb8a-e2ee2a9d001b'::uuid)
order by b.created_at;

-- Provenance: importer start_import does NOT write exam.question_count.
-- Baseline question_bank_publish_batch recalculates this field from ALL currently
-- published questions by exam, even when publishing a different batch.
-- This mutable count cannot by itself prove the original/import-time count.
-- Confirm deployed publisher resembles the checked-in implementation without
-- returning its full source/body or any question contents.
select p.proname,
  strpos(pg_get_functiondef(p.oid),'set question_count = counts.question_count')>0 as recomputes_exam_count,
  strpos(pg_get_functiondef(p.oid),'where status = ''published''')>0 as counts_published_rows
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='question_bank_publish_batch';
select e.id,e.year,e.round,e.question_count as stored_question_count,
  count(q.id)::int as visible_catalog_rows,
  count(q.id) filter(where q.status='published')::int as visible_published_rows,
  e.metadata->>'expected_questions' as source_expected_questions_if_recorded,
  e.metadata->>'round_source' as round_source,e.metadata->>'round_confidence' as round_confidence,
  e.created_at,e.updated_at
from public.question_bank_exams e left join public.question_bank_questions q on q.exam_id=e.id
where e.id='7e0f9af1-f77a-4986-bb8a-e2ee2a9d001b'::uuid
group by e.id;

-- Whitelisted audit fields only. Batch totals are NOT this single exam's totals.
-- Missing audit/history/source snapshot => [확인 필요], never infer import count.
select b.id as import_batch_id,b.metadata->>'expected_questions' as batch_expected_questions,
  a.action,a.created_at,a.detail->>'expected_questions' as import_expected_questions,
  a.detail->>'row_count' as imported_rows,a.detail->>'error_count' as import_errors,
  a.detail->>'published_questions' as batch_published_questions
from public.question_bank_import_batches b left join public.admin_action_events a
  on a.target_id=b.id and a.target_type='question_bank_import_batch'
  and a.action in ('question_bank_start_import','question_bank_finish_import','question_bank_publish_batch')
where b.id in (select distinct import_batch_id from public.question_bank_questions
  where exam_id='7e0f9af1-f77a-4986-bb8a-e2ee2a9d001b'::uuid)
order by b.created_at,a.created_at;

-- An issue report can explain broken assets only if the missing row still exists.
select r.question_id,r.kind,r.status,count(*) as reports
from public.question_bank_issue_reports r
join public.question_bank_questions q on q.id=r.question_id
where q.exam_id='7e0f9af1-f77a-4986-bb8a-e2ee2a9d001b'::uuid and q.no in (12,43)
group by r.question_id,r.kind,r.status;
commit;
