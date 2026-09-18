-- PASSMATE V7 admin operations foundation.
-- Admin browser never receives service-role credentials.

create table if not exists public.admin_action_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_action_events_created
  on public.admin_action_events(created_at desc);

alter table public.admin_action_events enable row level security;

revoke all on public.admin_action_events from anon, authenticated;

drop policy if exists "admin_action_events_client_deny"
  on public.admin_action_events;

create policy "admin_action_events_client_deny"
on public.admin_action_events
for all
to anon, authenticated
using (false)
with check (false);

create or replace function private.assert_admin_actor(
  p_user_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or not exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.role = 'admin'
  ) then
    raise exception 'admin access required'
      using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all on function private.assert_admin_actor(uuid) from public;

-- For re-issued jobs, only the newest generation participates in the
-- aggregate fulfillment state. Historical failed generations remain auditable.
create or replace function public.refresh_order_fulfillment(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_status text;
  v_target text;
  v_total integer;
  v_dead integer;
  v_leased integer;
  v_waiting integer;
  v_succeeded integer;
  v_cancelled integer;
begin
  select o.status
  into v_order_status
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found or v_order_status <> 'paid' then
    return;
  end if;

  with latest as (
    select distinct on (
      j.order_item_id,
      j.product_version_id,
      j.artifact_code
    )
      j.status
    from public.issuance_jobs j
    where j.order_id = p_order_id
    order by
      j.order_item_id,
      j.product_version_id,
      j.artifact_code,
      j.generation desc,
      j.created_at desc
  )
  select
    count(*)::integer,
    count(*) filter (where status = 'dead_letter')::integer,
    count(*) filter (where status = 'leased')::integer,
    count(*) filter (where status in ('queued', 'retry_wait'))::integer,
    count(*) filter (where status = 'succeeded')::integer,
    count(*) filter (where status = 'cancelled')::integer
  into
    v_total,
    v_dead,
    v_leased,
    v_waiting,
    v_succeeded,
    v_cancelled
  from latest;

  if v_total = 0 then
    v_target := 'not_started';
  elsif v_dead > 0 or v_cancelled > 0 then
    v_target := 'failed';
  elsif v_leased > 0 then
    v_target := 'issuing';
  elsif v_waiting > 0 then
    v_target := 'queued';
  elsif v_succeeded = v_total then
    v_target := 'ready';
  else
    v_target := 'failed';
  end if;

  update public.orders
  set fulfillment_status = v_target
  where id = p_order_id
    and fulfillment_status is distinct from v_target;
end;
$$;

-- Initial issuance still requires a published version. A later admin reissue
-- may use the exact archived version that was purchased.
create or replace function public.validate_issuance_job_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_product_id uuid;
  v_product_version_id uuid;
  v_order_status text;
  v_version_status text;
begin
  if tg_op = 'UPDATE' then
    if
      new.order_id is distinct from old.order_id
      or new.order_item_id is distinct from old.order_item_id
      or new.product_id is distinct from old.product_id
      or new.product_version_id is distinct from old.product_version_id
      or new.artifact_code is distinct from old.artifact_code
      or new.generation is distinct from old.generation
      or new.payload_version is distinct from old.payload_version
    then
      raise exception 'issuance job identity is immutable'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  select
    oi.order_id,
    oi.product_id,
    oi.product_version_id
  into
    v_order_id,
    v_product_id,
    v_product_version_id
  from public.order_items oi
  where oi.id = new.order_item_id;

  if not found then
    raise exception 'issuance job order_item does not exist'
      using errcode = 'foreign_key_violation';
  end if;

  if
    v_order_id <> new.order_id
    or v_product_id <> new.product_id
    or v_product_version_id is distinct from new.product_version_id
  then
    raise exception 'issuance job references do not match order_item'
      using errcode = 'check_violation';
  end if;

  select o.status
  into v_order_status
  from public.orders o
  where o.id = new.order_id;

  if v_order_status <> 'paid' then
    raise exception 'issuance job requires a paid order'
      using errcode = 'check_violation';
  end if;

  select pv.status
  into v_version_status
  from public.product_versions pv
  where pv.id = new.product_version_id
    and pv.product_id = new.product_id;

  if
    (new.generation = 1 and v_version_status is distinct from 'published')
    or (
      new.generation > 1
      and v_version_status not in ('published', 'archived')
    )
  then
    raise exception 'issuance job version status is not eligible'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function public.admin_dashboard_summary(
  p_admin_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.assert_admin_actor(p_admin_user_id);

  select jsonb_build_object(
    'orders_total', (select count(*) from public.orders),
    'orders_paid', (
      select count(*) from public.orders where status = 'paid'
    ),
    'orders_payment_pending', (
      select count(*) from public.orders where status = 'payment_pending'
    ),
    'orders_ready', (
      select count(*) from public.orders
      where status = 'paid' and fulfillment_status = 'ready'
    ),
    'orders_fulfillment_failed', (
      select count(*) from public.orders
      where status = 'paid' and fulfillment_status = 'failed'
    ),
    'jobs_queued', (
      select count(*) from public.issuance_jobs where status = 'queued'
    ),
    'jobs_leased', (
      select count(*) from public.issuance_jobs where status = 'leased'
    ),
    'jobs_retry_wait', (
      select count(*) from public.issuance_jobs where status = 'retry_wait'
    ),
    'jobs_dead_letter', (
      select count(*) from public.issuance_jobs where status = 'dead_letter'
    ),
    'payment_failures', (
      select count(*) from public.payment_attempts where status = 'failed'
    ),
    'downloads_today', (
      select count(*)
      from public.download_events
      where created_at >= date_trunc('day', now())
    )
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.admin_list_orders(
  p_admin_user_id uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  order_id uuid,
  created_at timestamptz,
  status text,
  fulfillment_status text,
  total_amount_krw integer,
  channel text,
  payment_provider text,
  state_version integer,
  product_summary text,
  latest_payment_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin_actor(p_admin_user_id);

  if p_limit < 1 or p_limit > 200 or p_offset < 0 then
    raise exception 'invalid pagination'
      using errcode = 'check_violation';
  end if;

  return query
  select
    o.id,
    o.created_at,
    o.status,
    o.fulfillment_status,
    o.total_amount_krw,
    o.channel,
    o.payment_provider,
    o.state_version,
    coalesce(items.summary, '-'),
    payment.status
  from public.orders o
  left join lateral (
    select string_agg(
      p.code || case when oi.quantity > 1 then ' x' || oi.quantity else '' end,
      ', '
      order by p.code
    ) as summary
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = o.id
  ) items on true
  left join lateral (
    select pa.status
    from public.payment_attempts pa
    where pa.order_id = o.id
    order by pa.created_at desc
    limit 1
  ) payment on true
  order by o.created_at desc
  limit p_limit
  offset p_offset;
end;
$$;

create or replace function public.admin_list_issuance_jobs(
  p_admin_user_id uuid,
  p_limit integer default 100
)
returns table (
  job_id uuid,
  order_id uuid,
  product_code text,
  product_version text,
  status text,
  generation integer,
  attempt_count integer,
  max_attempts integer,
  next_attempt_at timestamptz,
  lease_owner text,
  last_error_code text,
  completed_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin_actor(p_admin_user_id);

  if p_limit < 1 or p_limit > 300 then
    raise exception 'invalid limit'
      using errcode = 'check_violation';
  end if;

  return query
  select
    j.id,
    j.order_id,
    p.code,
    pv.version,
    j.status,
    j.generation,
    j.attempt_count,
    j.max_attempts,
    j.next_attempt_at,
    j.lease_owner,
    j.last_error_code,
    j.completed_at,
    j.created_at
  from public.issuance_jobs j
  join public.products p on p.id = j.product_id
  join public.product_versions pv on pv.id = j.product_version_id
  order by
    case j.status
      when 'dead_letter' then 0
      when 'retry_wait' then 1
      when 'leased' then 2
      when 'queued' then 3
      else 4
    end,
    j.created_at desc
  limit p_limit;
end;
$$;

create or replace function public.admin_list_catalog(
  p_admin_user_id uuid
)
returns table (
  product_id uuid,
  code text,
  title text,
  price_krw integer,
  is_active boolean,
  latest_version text,
  latest_version_status text,
  version_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin_actor(p_admin_user_id);

  return query
  select
    p.id,
    p.code,
    p.title,
    p.price_krw,
    p.is_active,
    latest.version,
    latest.status,
    (
      select count(*)
      from public.product_versions pv_count
      where pv_count.product_id = p.id
    )
  from public.products p
  left join lateral (
    select pv.version, pv.status
    from public.product_versions pv
    where pv.product_id = p.id
    order by pv.created_at desc
    limit 1
  ) latest on true
  order by p.created_at desc;
end;
$$;

create or replace function public.admin_retry_issuance_job(
  p_admin_user_id uuid,
  p_job_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.issuance_jobs%rowtype;
  v_order_status text;
  v_new_job_id uuid;
  v_generation integer;
begin
  perform private.assert_admin_actor(p_admin_user_id);

  select *
  into v_job
  from public.issuance_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'issuance job not found'
      using errcode = 'no_data_found';
  end if;

  select o.status
  into v_order_status
  from public.orders o
  where o.id = v_job.order_id
  for update;

  if v_order_status <> 'paid' then
    raise exception 'only paid orders can be retried'
      using errcode = 'check_violation';
  end if;

  if v_job.status = 'retry_wait' then
    update public.issuance_jobs
    set next_attempt_at = now()
    where id = v_job.id;

    insert into public.admin_action_events (
      actor_user_id,
      action,
      target_type,
      target_id,
      detail
    )
    values (
      p_admin_user_id,
      'expedite_retry_wait',
      'issuance_job',
      v_job.id,
      jsonb_build_object('generation', v_job.generation)
    );

    perform public.refresh_order_fulfillment(v_job.order_id);
    return v_job.id;
  end if;

  if v_job.status <> 'dead_letter' then
    raise exception 'only retry_wait or dead_letter jobs can be retried'
      using errcode = 'check_violation';
  end if;

  select coalesce(max(j.generation), 0) + 1
  into v_generation
  from public.issuance_jobs j
  where j.order_item_id = v_job.order_item_id
    and j.product_version_id = v_job.product_version_id
    and j.artifact_code = v_job.artifact_code;

  insert into public.issuance_jobs (
    order_id,
    order_item_id,
    product_id,
    product_version_id,
    artifact_code,
    generation,
    payload_version,
    status,
    priority,
    attempt_count,
    max_attempts,
    next_attempt_at
  )
  values (
    v_job.order_id,
    v_job.order_item_id,
    v_job.product_id,
    v_job.product_version_id,
    v_job.artifact_code,
    v_generation,
    v_job.payload_version,
    'queued',
    v_job.priority,
    0,
    v_job.max_attempts,
    now()
  )
  returning id into v_new_job_id;

  insert into public.admin_action_events (
    actor_user_id,
    action,
    target_type,
    target_id,
    detail
  )
  values (
    p_admin_user_id,
    'reissue_dead_letter',
    'issuance_job',
    v_new_job_id,
    jsonb_build_object(
      'source_job_id', v_job.id,
      'source_generation', v_job.generation,
      'new_generation', v_generation
    )
  );

  perform public.refresh_order_fulfillment(v_job.order_id);
  return v_new_job_id;
end;
$$;

revoke all on function public.admin_dashboard_summary(uuid)
  from public, anon, authenticated;
revoke all on function public.admin_list_orders(uuid,integer,integer)
  from public, anon, authenticated;
revoke all on function public.admin_list_issuance_jobs(uuid,integer)
  from public, anon, authenticated;
revoke all on function public.admin_list_catalog(uuid)
  from public, anon, authenticated;
revoke all on function public.admin_retry_issuance_job(uuid,uuid)
  from public, anon, authenticated;

grant execute on function public.admin_dashboard_summary(uuid)
  to service_role;
grant execute on function public.admin_list_orders(uuid,integer,integer)
  to service_role;
grant execute on function public.admin_list_issuance_jobs(uuid,integer)
  to service_role;
grant execute on function public.admin_list_catalog(uuid)
  to service_role;
grant execute on function public.admin_retry_issuance_job(uuid,uuid)
  to service_role;
