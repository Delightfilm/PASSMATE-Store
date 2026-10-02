-- Sparse public corrections; source bundles and private reports remain unchanged.
alter table public.question_bank_issue_reports add column qualification_code text;
alter table public.question_bank_issue_reports add constraint issue_report_qualification_length check (qualification_code is null or length(qualification_code) between 1 and 80);
create table public.question_bank_question_corrections (
  question_ref text primary key,
  qualification_code text not null check (length(qualification_code) between 1 and 80),
  source_hash text not null,
  content jsonb not null,
  version integer not null check (version > 0),
  updated_at timestamptz not null default now(),
  check (question_ref ~ '^[a-f0-9]{20}$' or question_ref ~ '^[a-f0-9-]{36}$')
);
create index question_bank_corrections_qualification_idx on public.question_bank_question_corrections(qualification_code);
alter table public.question_bank_question_corrections enable row level security;
revoke all on public.question_bank_question_corrections from anon, authenticated;
grant select on public.question_bank_question_corrections to anon, authenticated;
grant all on public.question_bank_question_corrections to service_role;
create policy corrections_public_read on public.question_bank_question_corrections for select to anon, authenticated using (true);

-- Text references are intentional: NAS hashes and report IDs are not UUIDs.
create table public.question_bank_review_events (
  id bigint generated always as identity primary key,
  report_id text not null,
  question_ref text not null,
  qualification_code text,
  actor_user_id uuid not null references auth.users(id),
  action text not null check (action in ('edit_question','resolve_report')),
  reason text not null default '',
  before_content jsonb,
  after_content jsonb,
  created_at timestamptz not null default now()
);
create index question_bank_review_events_created_idx on public.question_bank_review_events(created_at desc, id desc);
create index question_bank_review_events_actor_idx on public.question_bank_review_events(actor_user_id);
alter table public.question_bank_review_events enable row level security;
revoke all on public.question_bank_review_events from anon, authenticated, service_role;
grant select, insert on public.question_bank_review_events to service_role;
grant usage, select on sequence public.question_bank_review_events_id_seq to service_role;
create policy review_events_admin_read on public.question_bank_review_events for select to authenticated using ((select private.is_admin()));

create function public.authorize_question_bank_review(p_actor uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin perform private.assert_admin_actor(p_actor); return true; end;
$$;
revoke all on function public.authorize_question_bank_review(uuid) from public,anon,authenticated;
grant execute on function public.authorize_question_bank_review(uuid) to service_role;

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
      select 1 from jsonb_array_elements(p_patch->'choices') choice
      where jsonb_typeof(choice->'text') is distinct from 'string'
        or coalesce(length(btrim(choice->>'text')),0) not between 1 and 10000
        or jsonb_typeof(choice->'label') is distinct from 'string'
    ) then raise exception 'invalid_question_patch'; end if;
    -- Only editable content can become public; never publish report memos/actor details.
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
