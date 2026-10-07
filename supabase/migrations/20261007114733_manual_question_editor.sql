-- Additive editor contract; immutable banks, reports, attempts and scores untouched.
alter table public.question_bank_review_events alter column report_id drop not null;
create table public.question_bank_edit_assets (
  sha256 text primary key check(sha256 ~ '^[a-f0-9]{64}$'),
  question_ref text not null,
  actor_user_id uuid not null references auth.users(id),
  byte_size integer not null check(byte_size between 1 and 5000000),
  created_at timestamptz not null default now()
);
-- The same decoded pixels may be uploaded for multiple questions; authorization is
-- attached to the immutable asset hash, not to a client-supplied filename or URL.
alter table public.question_bank_edit_assets enable row level security;
revoke all on public.question_bank_edit_assets from public,anon,authenticated;
grant select,insert on public.question_bank_edit_assets to service_role;

create function public.save_question_bank_edit(
 p_actor uuid, p_question_ref text, p_qualification_code text, p_source_hash text,
 p_patch jsonb, p_source jsonb, p_expected_version integer, p_reason text,
 p_report_id text default null, p_resolve boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 c public.question_bank_question_corrections%rowtype;
 r public.question_bank_issue_reports%rowtype;
 previous jsonb; next_version integer; changed boolean; choice_count integer;
begin
 perform private.assert_admin_actor(p_actor);
 if p_question_ref is null or (p_question_ref !~ '^[a-f0-9]{20}$' and p_question_ref !~ '^[a-f0-9-]{36}$')
   or coalesce(length(p_qualification_code),0) not between 1 and 80
   or coalesce(length(p_source_hash),0)=0 or p_expected_version is null or p_expected_version<0
   or coalesce(length(btrim(p_reason)),0) not between 1 and 2000
   or jsonb_typeof(p_patch) is distinct from 'object' or jsonb_typeof(p_source) is distinct from 'object'
   or p_patch->>'schemaVersion' is distinct from '2'
   or jsonb_typeof(p_patch->'stem') is distinct from 'string'
   or coalesce(length(btrim(p_patch->>'stem')),0) not between 1 and 20000
   or jsonb_typeof(p_patch->'choices') is distinct from 'array'
   or jsonb_typeof(p_patch->'images') is distinct from 'array'
   or jsonb_typeof(p_patch->'acceptedAnswers') is distinct from 'array'
   or jsonb_typeof(p_patch->'explanation') is distinct from 'string'
   or length(p_patch->>'explanation')>20000
   then raise exception 'invalid_question_patch'; end if;
 choice_count:=jsonb_array_length(p_patch->'choices');
 if choice_count not between 2 and 10 or jsonb_array_length(p_patch->'images')>10
   or jsonb_typeof(p_patch->'answer') is distinct from 'number' or coalesce(p_patch->>'answer','') !~ '^[0-9]$'
   or (p_patch->>'answer')::integer>=choice_count
   or jsonb_array_length(p_patch->'acceptedAnswers') not between 1 and choice_count
   or not (p_patch->'acceptedAnswers' @> jsonb_build_array((p_patch->>'answer')::integer))
   or exists(select 1 from jsonb_array_elements(p_patch->'acceptedAnswers') a
     where jsonb_typeof(a) is distinct from 'number' or (a #>> '{}') !~ '^[0-9]$' or (a #>> '{}')::integer>=choice_count)
   or (select count(distinct a) from jsonb_array_elements(p_patch->'acceptedAnswers') a)<>jsonb_array_length(p_patch->'acceptedAnswers')
   or exists(select 1 from jsonb_array_elements(p_patch->'choices') choice where
      jsonb_typeof(choice) is distinct from 'object' or jsonb_typeof(choice->'text') is distinct from 'string'
      or length(choice->>'text')>10000 or jsonb_typeof(choice->'label') is distinct from 'string'
      or jsonb_typeof(choice->'images') is distinct from 'array'
      or case when jsonb_typeof(choice->'images')='array' then jsonb_array_length(choice->'images')>10
           or (length(btrim(choice->>'text'))=0 and jsonb_array_length(choice->'images')=0) else true end)
   then raise exception 'invalid_question_patch'; end if;
 -- Only registered immutable uploads or source/current references may be linked.
 if p_report_id is not null then
   select * into r from public.question_bank_issue_reports where id=p_report_id for update;
   if not found or coalesce(r.question_ref,r.question_id::text)<>p_question_ref then raise exception 'report_not_found'; end if;
   if r.status<>'open' then raise exception 'report_already_resolved'; end if;
 elsif p_resolve then raise exception 'report_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_question_ref,0));
 select * into c from public.question_bank_question_corrections where question_ref=p_question_ref for update;
 if coalesce(c.version,0)<>p_expected_version then raise exception 'question_version_conflict'; end if;
 if c.question_ref is not null and (c.source_hash<>p_source_hash or c.qualification_code<>p_qualification_code) then raise exception 'question_source_changed'; end if;
 if exists(
   with requested as (
     select image from jsonb_array_elements(p_patch->'images') image
     union all select image from jsonb_array_elements(p_patch->'choices') choice, jsonb_array_elements(choice->'images') image
   ), trusted as (
     select image from jsonb_array_elements(coalesce(p_source->'images','[]')) image
     union select image from jsonb_array_elements(p_source->'choices') choice,jsonb_array_elements(coalesce(choice->'images','[]')) image
     union select image from jsonb_array_elements(coalesce(c.content->'images','[]')) image
     union select image from jsonb_array_elements(coalesce(c.content->'choices','[]')) choice,jsonb_array_elements(coalesce(choice->'images','[]')) image
   ) select 1 from requested q where jsonb_typeof(q.image)<>'string' or
     (not exists(select 1 from trusted t where t.image=q.image) and
      not exists(select 1 from public.question_bank_edit_assets a where
        'https://content.mypassmate.com/admin-images/'||a.sha256||'.png'=(q.image #>> '{}')))
 ) then raise exception 'invalid_question_image'; end if;
 -- Strip arbitrary client metadata before public storage/audit.
 p_patch:=jsonb_build_object('schemaVersion',2,'stem',p_patch->>'stem','images',p_patch->'images',
   'choices',(select jsonb_agg(jsonb_build_object('label',v->>'label','text',v->>'text','images',v->'images') order by ord) from jsonb_array_elements(p_patch->'choices') with ordinality x(v,ord)),
   'answer',(p_patch->>'answer')::integer,'acceptedAnswers',p_patch->'acceptedAnswers','explanation',p_patch->>'explanation');
 previous:=coalesce(c.content,p_source); changed:=previous is distinct from p_patch; next_version:=coalesce(c.version,0);
 if changed then
   next_version:=next_version+1;
   insert into public.question_bank_question_corrections(question_ref,qualification_code,source_hash,content,version)
     values(p_question_ref,p_qualification_code,p_source_hash,p_patch,next_version)
     on conflict(question_ref) do update set content=excluded.content,version=excluded.version,updated_at=now();
   insert into public.question_bank_review_events(report_id,question_ref,qualification_code,actor_user_id,action,reason,before_content,after_content)
     values(p_report_id,p_question_ref,p_qualification_code,p_actor,'edit_question',btrim(p_reason),previous,p_patch);
 end if;
 if p_report_id is not null then
   update public.question_bank_issue_reports set qualification_code=p_qualification_code where id=p_report_id;
 end if;
 if p_resolve then
   update public.question_bank_issue_reports set status='resolved',resolved_at=now(),resolved_by=p_actor where id=p_report_id;
   insert into public.question_bank_review_events(report_id,question_ref,qualification_code,actor_user_id,action,reason,before_content,after_content)
     values(p_report_id,p_question_ref,p_qualification_code,p_actor,'resolve_report',btrim(p_reason),jsonb_build_object('status','open'),jsonb_build_object('status','resolved'));
 end if;
 return jsonb_build_object('resolved',p_resolve,'changed',changed,'version',next_version);
end;
$$;
revoke all on function public.save_question_bank_edit(uuid,text,text,text,jsonb,jsonb,integer,text,text,boolean) from public,anon,authenticated;
grant execute on function public.save_question_bank_edit(uuid,text,text,text,jsonb,jsonb,integer,text,text,boolean) to service_role;
