create extension if not exists pg_cron with schema pg_catalog;
do $$
declare job bigint;
begin
 select jobid into job from cron.job where jobname='passmate-traffic-aggregate-retention';
 if job is null then
  job=cron.schedule('passmate-traffic-aggregate-retention','0 20 * * *','select public.cleanup_traffic_aggregates();');
 end if;
 update public.traffic_aggregate_state set maintenance_job_id=job where singleton;
end $$;
select public.cleanup_traffic_aggregates();
