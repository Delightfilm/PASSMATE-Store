begin;
-- Auth stays unexposed. This narrow reporting function needs its owner's auth.users
-- read privilege; no auth table grants, login triggers, or member writes are added.
create function public.admin_member_report(
  p_admin_user_id uuid,p_view text,p_start date,p_end date,
  p_query text default '',p_provider text default 'all',p_page integer default 1,
  p_period_only boolean default false,p_member_id uuid default null
)
returns jsonb language plpgsql stable security definer
set search_path='' set statement_timeout='5s'
as $$
declare result jsonb; today date:=(current_timestamp at time zone 'Asia/Seoul')::date;
begin
  if not exists(select 1 from public.profiles where id=p_admin_user_id and role='admin')
    or not private.is_designated_admin_user(p_admin_user_id) then
    raise exception 'admin_required' using errcode='42501';
  end if;
  if p_view is null or p_view not in ('summary','members','detail') or p_start is null or p_end is null
    or p_end<p_start or p_end-p_start>89 or p_end>today or p_query is null or length(p_query)>100
    or p_provider is null or p_provider not in ('all','email','google','kakao')
    or p_page is null or p_page<1 or p_page>100000 or p_period_only is null
    or (p_view='detail' and p_member_id is null) then
    raise exception 'invalid_member_request';
  end if;
  if p_view='detail' then
    select jsonb_build_object(
      'member',jsonb_build_object('id',u.id,'displayName',left(coalesce(nullif(p.display_name,''),nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name',''),'이름 없음'),200),
        'email',u.email,'createdAt',u.created_at,'lastSignInAt',u.last_sign_in_at,'emailConfirmed',u.email_confirmed_at is not null,
        'providers',coalesce(u.raw_app_meta_data->'providers',jsonb_build_array(coalesce(u.raw_app_meta_data->>'provider','email')))),
      'learning',jsonb_build_object(
        'starts',(select count(*) from public.question_bank_attempts a where a.user_id=u.id),
        'completed',(select count(*) from public.question_bank_attempts a where a.user_id=u.id and a.submitted_at is not null),
        'averageScore',(select round(avg(a.score)::numeric,1) from public.question_bank_attempts a where a.user_id=u.id and a.submitted_at is not null),
        'wrongNotes',(select count(*) from public.question_bank_wrong_notes w where w.user_id=u.id and w.wrong_count>0)
          +(select count(*) from public.question_bank_user_question_state s where s.user_id=u.id and s.wrong_count>0),
        'bookmarks',(select count(*) from public.question_bank_bookmarks b where b.user_id=u.id)
          +(select count(*) from public.question_bank_user_question_state s where s.user_id=u.id and s.bookmarked)))
    into result from auth.users u left join public.profiles p on p.id=u.id
    where u.id=p_member_id and u.deleted_at is null and not coalesce(u.is_anonymous,false);
    return coalesce(result,jsonb_build_object('member',null,'learning',null));
  end if;
  with members as materialized (
    select u.id,u.email,u.created_at,u.last_sign_in_at,u.email_confirmed_at,
      left(coalesce(nullif(p.display_name,''),nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name',''),'이름 없음'),200) as display_name,
      coalesce(u.raw_app_meta_data->'providers',jsonb_build_array(coalesce(u.raw_app_meta_data->>'provider','email'))) as providers
    from auth.users u left join public.profiles p on p.id=u.id
    where u.deleted_at is null and not coalesce(u.is_anonymous,false)
  ), filtered as (
    select * from members m where
      (p_provider='all' or m.providers ? p_provider)
      -- strpos makes %, _ and quotes literal search characters. No dynamic SQL.
      and (p_query='' or strpos(lower(m.display_name),lower(p_query))>0 or strpos(lower(coalesce(m.email,'')),lower(p_query))>0)
      and (not p_period_only or (m.created_at>=p_start::timestamp at time zone 'Asia/Seoul' and m.created_at<(p_end+1)::timestamp at time zone 'Asia/Seoul'))
  ), paged as (
    select * from filtered order by created_at desc,id limit 20 offset (p_page-1)*20
  ), daily as (
    select (m.created_at at time zone 'Asia/Seoul')::date as day,count(*) as joined
    from members m where m.created_at>=p_start::timestamp at time zone 'Asia/Seoul'
      and m.created_at<(p_end+1)::timestamp at time zone 'Asia/Seoul'
    group by 1
  )
  select case when p_view='summary' then jsonb_build_object(
    'totals',(select jsonb_build_object('totalMembers',count(*),
      'joinedToday',count(*) filter(where created_at>=today::timestamp at time zone 'Asia/Seoul' and created_at<(today+1)::timestamp at time zone 'Asia/Seoul'),
      'joined7Days',count(*) filter(where created_at>=(today-6)::timestamp at time zone 'Asia/Seoul' and created_at<(today+1)::timestamp at time zone 'Asia/Seoul'),
      'joinedInPeriod',count(*) filter(where created_at>=p_start::timestamp at time zone 'Asia/Seoul' and created_at<(p_end+1)::timestamp at time zone 'Asia/Seoul'),
      'confirmedMembers',count(*) filter(where email_confirmed_at is not null)) from members),
    'trend',coalesce((select jsonb_agg(jsonb_build_object('date',day,'count',joined) order by day) from daily),'[]'::jsonb)
  ) else jsonb_build_object('total',(select count(*) from filtered),'page',p_page,
    'rows',coalesce((select jsonb_agg(jsonb_build_object('id',id,'displayName',display_name,'email',email,
      'createdAt',created_at,'lastSignInAt',last_sign_in_at,'emailConfirmed',email_confirmed_at is not null,'providers',providers)
      order by created_at desc,id) from paged),'[]'::jsonb)) end into result;
  return result;
end;
$$;
revoke all on function public.admin_member_report(uuid,text,date,date,text,text,integer,boolean,uuid) from public,anon,authenticated;
grant execute on function public.admin_member_report(uuid,text,date,date,text,text,integer,boolean,uuid) to service_role;
comment on function public.admin_member_report(uuid,text,date,date,text,text,integer,boolean,uuid) is
  'Read-only designated-admin member reporting. Current permanent accounts only; deleted/anonymous users excluded. No credentials, answers or auth metadata returned.';
commit;
