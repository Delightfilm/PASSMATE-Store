begin;
create function public.admin_exam_usage(p_start date,p_end date,p_group text)
returns jsonb language plpgsql stable security invoker
set search_path=public,pg_temp set statement_timeout='8s'
as $$
declare result jsonb;
begin
  if p_start is null or p_end is null or p_end<p_start or p_end-p_start>89
    or p_end>(current_timestamp at time zone 'Asia/Seoul')::date
    or p_group is null or p_group not in ('qualification','exam') then
    raise exception 'invalid_exam_usage_request';
  end if;
  with cohort as (
    select a.user_id,a.submitted_at,a.config,
      coalesce(c.name,nullif(a.config->>'certSlug',''),nullif(a.config->>'certId',''),'종목 정보 없음') as qualification,
      case when jsonb_typeof(a.config->'examIds')='array' and jsonb_array_length(a.config->'examIds')=1
        then a.config->'examIds'->>0 else '__mixed__' end as exam_key
    from public.question_bank_attempts a
    left join public.question_bank_certs c on c.id::text=a.config->>'certId'
    where a.started_at>=p_start::timestamp at time zone 'Asia/Seoul'
      and a.started_at<(p_end+1)::timestamp at time zone 'Asia/Seoul'
  ), labeled as (
    select a.user_id,a.submitted_at,a.qualification,
      case when p_group='qualification' then '' else a.exam_key end as exam_key,
      case when p_group='qualification' then '전체 회차'
        when a.exam_key='__mixed__' then '여러 회차 · 맞춤'
        else coalesce(nullif(e.title,''),e.year::text||'년 '||e.round,'회차 '||a.exam_key) end as exam_label
    from cohort a
    left join public.question_bank_exams e on e.id::text=a.exam_key
  ), grouped as (
    select qualification,exam_key,exam_label,count(*) as starts,
      count(*) filter(where submitted_at is not null) as completions,count(distinct user_id) as users
    from labeled group by qualification,exam_key,exam_label
  ), top_rows as (
    select * from grouped order by starts desc,qualification,exam_key limit 500
  )
  select jsonb_build_object(
    'rows',coalesce((select jsonb_agg(jsonb_build_object('qualification',qualification,'examKey',exam_key,'examLabel',exam_label,'starts',starts,'completions',completions,'users',users) order by starts desc,qualification,exam_key) from top_rows),'[]'::jsonb),
    'totals',(select jsonb_build_object('starts',count(*),'completions',count(*) filter(where submitted_at is not null),'users',count(distinct user_id)) from cohort),
    'truncated',(select count(*)>500 from grouped)
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_exam_usage(date,date,text) from public,anon,authenticated;
grant execute on function public.admin_exam_usage(date,date,text) to service_role;
comment on function public.admin_exam_usage(date,date,text) is 'Server-only member attempt aggregates by started-at cohort in Asia/Seoul. Guest browser-only attempts excluded. No personal IDs or answers returned.';
commit;
