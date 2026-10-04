-- Preserve trusted original images; permit image-only choices without renumbering.
create or replace function public.review_question_bank_report(
  p_actor uuid, p_report_id text, p_resolve boolean,
  p_patch jsonb default null, p_source jsonb default null,
  p_qualification_code text default null, p_source_hash text default null,
  p_expected_version integer default 0, p_reason text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.question_bank_issue_reports%rowtype;
  c public.question_bank_question_corrections%rowtype;
  ref text; previous jsonb; next_version integer; changed boolean := false;
begin
  perform private.assert_admin_actor(p_actor);
  select * into r from public.question_bank_issue_reports where id=p_report_id for update;
  if not found then raise exception 'report_not_found'; end if;
  if r.status <> 'open' then
    if p_patch is not null then raise exception 'report_already_resolved'; end if;
    return jsonb_build_object('resolved',true,'alreadyResolved',true);
  end if;
  ref := coalesce(r.question_ref, r.question_id::text);
  if p_patch is not null then
    if p_qualification_code is null or length(p_qualification_code) not between 1 and 80
      or p_source_hash is null or length(p_source_hash)=0
      or jsonb_typeof(p_patch) <> 'object' or jsonb_typeof(p_source) <> 'object'
      or coalesce(length(btrim(p_patch->>'stem')),0) not between 1 and 20000
      or jsonb_typeof(p_patch->'choices') is distinct from 'array'
      or coalesce(length(btrim(p_reason)),0) not between 1 and 2000
      or jsonb_typeof(p_patch->'answer') is distinct from 'number'
      or coalesce(p_patch->>'answer','') !~ '^[0-3]$'
      or coalesce(length(p_patch->>'explanation'),0)>20000
      or jsonb_typeof(p_patch->'explanation') is distinct from 'string'
      then raise exception 'invalid_question_patch'; end if;
    if jsonb_array_length(p_patch->'choices') <> 4 or exists (
      select 1 from jsonb_array_elements(p_patch->'choices') with ordinality as entries(choice,position)
      where jsonb_typeof(choice->'text') is distinct from 'string'
        or coalesce(length(btrim(choice->>'text')),0)>10000
        or (coalesce(length(btrim(choice->>'text')),0)=0 and
            case when jsonb_typeof(choice->'images')='array' then jsonb_array_length(choice->'images')=0 else true end)
        or (choice ? 'images' and jsonb_typeof(choice->'images') is distinct from 'array')
        or coalesce(choice->'images','[]'::jsonb) is distinct from coalesce(p_source->'choices'->(position::integer-1)->'images','[]'::jsonb)
        or case when jsonb_typeof(choice->'images')='array' then jsonb_array_length(choice->'images')>10 else false end
        or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(choice->'images')='array' then choice->'images' else '[]'::jsonb end) image
            where jsonb_typeof(image) is distinct from 'string'
               or (image #>> '{}') !~ '^https://content[.]mypassmate[.]com/images/[a-f0-9]{2}/[a-f0-9]{64}[.](png|jpg|jpeg|gif|webp)$')
        or jsonb_typeof(choice->'label') is distinct from 'string'
    ) then raise exception 'invalid_question_patch'; end if;
    p_patch := jsonb_build_object('stem',p_patch->>'stem','choices',p_patch->'choices','answer',(p_patch->>'answer')::integer,'explanation',p_patch->>'explanation');
    perform pg_advisory_xact_lock(hashtextextended(ref,0));
    select * into c from public.question_bank_question_corrections where question_ref=ref for update;
    if coalesce(c.version,0) <> p_expected_version then raise exception 'question_version_conflict'; end if;
    if c.question_ref is not null and (c.source_hash <> p_source_hash or c.qualification_code <> p_qualification_code) then raise exception 'question_source_changed'; end if;
    previous := coalesce(c.content,p_source);
    changed := previous is distinct from p_patch;
    next_version := coalesce(c.version,0);
    if changed then
      next_version := next_version+1;
      insert into public.question_bank_question_corrections(question_ref,qualification_code,source_hash,content,version)
        values(ref,p_qualification_code,p_source_hash,p_patch,next_version)
        on conflict(question_ref) do update set content=excluded.content,version=excluded.version,updated_at=now();
      insert into public.question_bank_review_events(report_id,question_ref,qualification_code,actor_user_id,action,reason,before_content,after_content)
        values(r.id,ref,p_qualification_code,p_actor,'edit_question',btrim(p_reason),previous,p_patch);
    end if;
    update public.question_bank_issue_reports set qualification_code=p_qualification_code where id=r.id;
  end if;
  if p_resolve then
    update public.question_bank_issue_reports set status='resolved',resolved_at=now(),resolved_by=p_actor where id=r.id;
    insert into public.question_bank_review_events(report_id,question_ref,qualification_code,actor_user_id,action,reason,before_content,after_content)
      values(r.id,ref,coalesce(p_qualification_code,r.qualification_code),p_actor,'resolve_report',coalesce(p_reason,''),jsonb_build_object('status','open'),jsonb_build_object('status','resolved'));
  end if;
  return jsonb_build_object('resolved',p_resolve,'changed',changed,'version',next_version);
end;
$$;
revoke all on function public.review_question_bank_report(uuid,text,boolean,jsonb,jsonb,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.review_question_bank_report(uuid,text,boolean,jsonb,jsonb,text,text,integer,text) to service_role;
