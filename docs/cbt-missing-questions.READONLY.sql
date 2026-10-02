-- READ ONLY. Catalog metadata only; never query/open production attempts.
-- Known live exam UUID, independently checked 2026-10-02: 2001 / 4회.
-- Run with the catalog administrator to distinguish hidden rows from absent rows.
-- anon/authenticated SELECT is RLS filtered: NULL means "not visible", not "absent".
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
select b.id,b.file_name,b.status,b.row_count,b.error_count,b.metadata,
  b.created_at,b.completed_at,b.published_at
from public.question_bank_import_batches b
where b.id in (select distinct import_batch_id from public.question_bank_questions
  where exam_id='7e0f9af1-f77a-4986-bb8a-e2ee2a9d001b'::uuid)
order by b.created_at;

-- An issue report can explain broken assets only if the missing row still exists.
select r.question_id,r.kind,r.status,count(*) as reports
from public.question_bank_issue_reports r
join public.question_bank_questions q on q.id=r.question_id
where q.exam_id='7e0f9af1-f77a-4986-bb8a-e2ee2a9d001b'::uuid and q.no in (12,43)
group by r.question_id,r.kind,r.status;
commit;
