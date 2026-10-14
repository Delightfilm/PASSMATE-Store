create table public.traffic_aggregate_daily (
 bucket_date date not null, dimension text not null check(dimension in ('total','source','page')),
 dimension_key text not null check(length(dimension_key)<=202),
 page_views bigint not null check(page_views>=0),visit_starts bigint not null check(visit_starts>=0 and visit_starts<=page_views),active_ms bigint not null check(active_ms>=0),
 primary key(bucket_date,dimension,dimension_key)
);
create table public.traffic_aggregate_receipts(digest text primary key check(digest ~ '^[0-9a-f]{64}$'),expires_at timestamptz not null);
create index traffic_aggregate_receipts_expiry on public.traffic_aggregate_receipts(expires_at);
create table public.traffic_aggregate_state(
 singleton boolean primary key default true check(singleton),enabled boolean not null default false,started_at timestamptz,
 maintenance_job_id bigint,maintenance_last_attempt_at timestamptz,maintenance_last_success_at timestamptz,maintenance_last_status text check(maintenance_last_status in ('ok','error') or maintenance_last_status is null)
);
insert into public.traffic_aggregate_state(singleton) values(true);
alter table public.traffic_aggregate_daily enable row level security;
alter table public.traffic_aggregate_receipts enable row level security;
alter table public.traffic_aggregate_state enable row level security;
revoke all on public.traffic_aggregate_daily,public.traffic_aggregate_receipts,public.traffic_aggregate_state from PUBLIC,anon,authenticated;
grant select,insert,update,delete on public.traffic_aggregate_daily,public.traffic_aggregate_receipts,public.traffic_aggregate_state to service_role;

create function public.cleanup_traffic_aggregates() returns void language plpgsql security invoker set search_path = public, pg_temp as $$
begin
 update public.traffic_aggregate_state set maintenance_last_attempt_at=now() where singleton;
 begin
  delete from public.traffic_aggregate_receipts where expires_at<=now();
  delete from public.traffic_aggregate_daily where bucket_date<(now() at time zone 'Asia/Seoul')::date-89;
  update public.traffic_aggregate_state set maintenance_last_success_at=now(),maintenance_last_status='ok' where singleton;
 exception when others then
  update public.traffic_aggregate_state set maintenance_last_status='error' where singleton;
 end;
end $$;

create function public.ingest_traffic_aggregates(p_digest text,p_packet jsonb) returns boolean language plpgsql security invoker set search_path = public, pg_temp as $$
declare
 d date := (now() at time zone 'Asia/Seoul')::date;
 row_data jsonb; dim text; rows_data jsonb; m jsonb; field text; n numeric;
 views bigint; starts bigint; active bigint; inserted integer;
begin
 if not exists(select 1 from public.traffic_aggregate_state where singleton and enabled and started_at is not null) then return false;end if;
 if p_digest !~ '^[0-9a-f]{64}$' or octet_length(p_packet::text)>8192 or p_packet->>'version'<>'1' or
    jsonb_typeof(p_packet)<>'object' or (select count(*) from jsonb_object_keys(p_packet))<>5 then raise exception 'invalid packet';end if;
 if not(p_packet ?& array['version','nonce','totals','sources','pages']) or p_packet->>'nonce' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'invalid packet';end if;
 for m in select p_packet->'totals' union all select value->'metrics' from jsonb_array_elements(p_packet->'sources') union all select value->'metrics' from jsonb_array_elements(p_packet->'pages') loop
  if jsonb_typeof(m)<>'object' or not(m ?& array['pageViews','visitStarts','activeMs']) or (select count(*) from jsonb_object_keys(m))<>3 then raise exception 'invalid metrics';end if;
  foreach field in array array['pageViews','visitStarts','activeMs'] loop
   if jsonb_typeof(m->field)<>'number' then raise exception 'invalid metric';end if;
   n=(m->>field)::numeric;
   if n<0 or n<>trunc(n) or n>(case when field='activeMs' then 60000 else 20 end) then raise exception 'metric limit';end if;
  end loop;
  if (m->>'visitStarts')::bigint>(m->>'pageViews')::bigint then raise exception 'starts exceed views';end if;
 end loop;
 views=(p_packet#>>'{totals,pageViews}')::bigint;starts=(p_packet#>>'{totals,visitStarts}')::bigint;active=(p_packet#>>'{totals,activeMs}')::bigint;
 if views+starts+active=0 then raise exception 'empty packet';end if;
 foreach dim in array array['source','page'] loop
  rows_data=p_packet->(case when dim='source' then 'sources' else 'pages' end);
  if jsonb_typeof(rows_data)<>'array' or jsonb_array_length(rows_data)<1 or jsonb_array_length(rows_data)>(case when dim='source' then 7 else 20 end) then raise exception 'invalid rows';end if;
  if (select count(distinct value->>'key') from jsonb_array_elements(rows_data))<>jsonb_array_length(rows_data) then raise exception 'duplicate key';end if;
  for row_data in select value from jsonb_array_elements(rows_data) loop
   if jsonb_typeof(row_data)<>'object' or not(row_data ?& array['key','metrics']) or (select count(*) from jsonb_object_keys(row_data))<>2 then raise exception 'invalid row';end if;
   if dim='source' and not(row_data->>'key'=any(array['naver','google','daum','bing','social','other','unknown'])) then raise exception 'source key';end if;
   if dim='page' and not(row_data->>'key' in ('home','cbt') or row_data->>'key' ~ '^[qe]:[[:alnum:]-]{1,200}$') then raise exception 'page key';end if;
  end loop;
  if (select sum((value#>>'{metrics,pageViews}')::bigint) from jsonb_array_elements(rows_data))<>views or
     (select sum((value#>>'{metrics,visitStarts}')::bigint) from jsonb_array_elements(rows_data))<>starts or
     (select sum((value#>>'{metrics,activeMs}')::bigint) from jsonb_array_elements(rows_data))<>active then raise exception 'marginal mismatch';end if;
 end loop;
 delete from public.traffic_aggregate_receipts where expires_at<=now();
 insert into public.traffic_aggregate_receipts values(p_digest,now()+interval '30 minutes') on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then return false;end if;
 insert into public.traffic_aggregate_daily values(d,'total','all',views,starts,active)
 on conflict(bucket_date,dimension,dimension_key) do update set page_views=traffic_aggregate_daily.page_views+excluded.page_views,visit_starts=traffic_aggregate_daily.visit_starts+excluded.visit_starts,active_ms=traffic_aggregate_daily.active_ms+excluded.active_ms;
 foreach dim in array array['source','page'] loop
  rows_data=p_packet->(case when dim='source' then 'sources' else 'pages' end);
  for row_data in select value from jsonb_array_elements(rows_data) loop
   insert into public.traffic_aggregate_daily values(d,dim,row_data->>'key',(row_data#>>'{metrics,pageViews}')::bigint,(row_data#>>'{metrics,visitStarts}')::bigint,(row_data#>>'{metrics,activeMs}')::bigint)
   on conflict(bucket_date,dimension,dimension_key) do update set page_views=traffic_aggregate_daily.page_views+excluded.page_views,visit_starts=traffic_aggregate_daily.visit_starts+excluded.visit_starts,active_ms=traffic_aggregate_daily.active_ms+excluded.active_ms;
  end loop;
 end loop;
 return true;
end $$;

create function public.read_traffic_aggregate_report(p_start date,p_end date,p_dimension text) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare result jsonb; today date:=(now() at time zone 'Asia/Seoul')::date;
begin
 if p_start is null or p_end is null or p_start>p_end or p_end>today or p_start<today-89 or p_dimension not in ('date','source','page') then raise exception 'invalid range';end if;
 delete from public.traffic_aggregate_receipts where expires_at<=now();
 with raw_rows as (
  select case when p_dimension='date' then bucket_date::text else dimension_key end key,sum(page_views) v,sum(visit_starts) s,sum(active_ms) a
  from public.traffic_aggregate_daily where bucket_date between p_start and p_end and dimension=case when p_dimension='date' then 'total' else p_dimension end
  group by 1
 ),folded as (
  select case when p_dimension<>'date' and v<5 then 'small' else key end key,sum(v) v,sum(s) s,sum(a) a from raw_rows group by 1
 ), top_rows as (select * from folded order by case when p_dimension='date' then key end asc,v desc,key limit 100)
 select jsonb_build_object(
  'totals',(select jsonb_build_object('pageViews',coalesce(sum(page_views),0),'visitStarts',coalesce(sum(visit_starts),0),'activeMs',coalesce(sum(active_ms),0)) from public.traffic_aggregate_daily where bucket_date between p_start and p_end and dimension='total'),
  'rows',coalesce((select jsonb_agg(jsonb_build_object('key',key,'metrics',jsonb_build_object('pageViews',v,'visitStarts',s,'activeMs',a))) from top_rows),'[]'::jsonb),
  'thresholded',exists(select 1 from raw_rows where p_dimension<>'date' and v<5),
  'enabled',enabled,'measurementStartedAt',started_at,
  'maintenanceHealthy',coalesce(maintenance_last_status='ok' and maintenance_last_success_at>now()-interval '25 hours',false)
 ) into result from public.traffic_aggregate_state where singleton;
 return result;
end $$;
revoke all on function public.ingest_traffic_aggregates(text,jsonb),public.read_traffic_aggregate_report(date,date,text),public.cleanup_traffic_aggregates() from PUBLIC,anon,authenticated;
grant execute on function public.ingest_traffic_aggregates(text,jsonb),public.read_traffic_aggregate_report(date,date,text),public.cleanup_traffic_aggregates() to service_role;
