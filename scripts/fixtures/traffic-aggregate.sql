begin;
do $$ begin
 if to_regclass('traffic_aggregate_qa.traffic_aggregate_daily') is null then raise exception 'QA aggregate relation missing'; end if;
end $$;
update traffic_aggregate_qa.traffic_aggregate_state set enabled=true,started_at=now() where singleton;
do $$
declare p jsonb := '{"version":1,"nonce":"12345678-1234-4123-8123-123456789012","totals":{"pageViews":1,"visitStarts":1,"activeMs":5000},"sources":[{"key":"naver","metrics":{"pageViews":1,"visitStarts":1,"activeMs":5000}}],"pages":[{"key":"home","metrics":{"pageViews":1,"visitStarts":1,"activeMs":5000}}]}';
begin
 if not traffic_aggregate_qa.ingest_traffic_aggregates(repeat('a',64),p) then raise exception 'first ingest rejected'; end if;
 if traffic_aggregate_qa.ingest_traffic_aggregates(repeat('a',64),p) then raise exception 'duplicate ingest accepted'; end if;
 if (select page_views from traffic_aggregate_qa.traffic_aggregate_daily where dimension='total' and dimension_key='all' and bucket_date=(now() at time zone 'Asia/Seoul')::date)<>1 then raise exception 'wrong total';end if;
 if ('2026-10-14 15:00:00+00'::timestamptz at time zone 'Asia/Seoul')::date <> '2026-10-15'::date then raise exception 'timezone boundary';end if;
 if has_table_privilege('anon','traffic_aggregate_qa.traffic_aggregate_daily','select') or has_table_privilege('authenticated','traffic_aggregate_qa.traffic_aggregate_receipts','insert') or has_function_privilege('anon','traffic_aggregate_qa.ingest_traffic_aggregates(text,jsonb)','execute') then raise exception 'public access';end if;
end $$;
insert into traffic_aggregate_qa.traffic_aggregate_receipts values(repeat('b',64),now()-interval '1 hour');
insert into traffic_aggregate_qa.traffic_aggregate_daily values((now() at time zone 'Asia/Seoul')::date-90,'total','all',1,0,0),((now() at time zone 'Asia/Seoul')::date-89,'total','all',1,0,0);
select traffic_aggregate_qa.cleanup_traffic_aggregates();
do $$ begin
 if exists(select 1 from traffic_aggregate_qa.traffic_aggregate_receipts where digest=repeat('b',64)) then raise exception 'expired receipt retained';end if;
 if exists(select 1 from traffic_aggregate_qa.traffic_aggregate_daily where bucket_date<(now() at time zone 'Asia/Seoul')::date-89) then raise exception 'old bucket retained';end if;
 if not exists(select 1 from traffic_aggregate_qa.traffic_aggregate_daily where bucket_date=(now() at time zone 'Asia/Seoul')::date-89) then raise exception '90th day lost';end if;
 if not exists(select 1 from traffic_aggregate_qa.traffic_aggregate_state where maintenance_last_status='ok') then raise exception 'maintenance health missing';end if;
end $$;
rollback;
