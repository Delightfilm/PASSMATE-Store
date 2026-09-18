-- PASSMATE V1.5 NAS issuance queue
-- Requires 0001_v1_core.sql and 0003_order_state_machine.sql.

create table if not exists public.issuance_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_version_id uuid not null references public.product_versions(id),
  artifact_code text not null default 'bundle',
  generation integer not null default 1 check (generation > 0),
  payload_version integer not null default 1 check (payload_version > 0),

  status text not null default 'queued'
    check (status in (
      'queued',
      'leased',
      'retry_wait',
      'succeeded',
      'dead_letter',
      'cancelled'
    )),

  priority smallint not null default 100,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0),
  next_attempt_at timestamptz not null default now(),

  lease_token uuid,
  lease_owner text,
  lease_expires_at timestamptz,

  result_storage_key text,
  result_sha256 text,
  result_size_bytes bigint check (
    result_size_bytes is null or result_size_bytes >= 0
  ),

  last_error_code text,
  last_error_detail text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint issuance_jobs_unique_generation
    unique (
      order_item_id,
      product_version_id,
      artifact_code,
      generation
    ),

  constraint issuance_jobs_lease_shape
    check (
      (
        status = 'leased'
        and lease_token is not null
        and lease_owner is not null
        and lease_expires_at is not null
      )
      or
      (
        status <> 'leased'
        and lease_token is null
        and lease_owner is null
        and lease_expires_at is null
      )
    ),

  constraint issuance_jobs_sha256_format
    check (
      result_sha256 is null
      or result_sha256 ~ '^[a-f0-9]{64}$'
    ),

  constraint issuance_jobs_success_result
    check (
      status <> 'succeeded'
      or (
        result_storage_key is not null
        and length(result_storage_key) > 0
        and result_sha256 is not null
        and result_size_bytes is not null
        and completed_at is not null
      )
    )
);

create index if not exists idx_issuance_jobs_claim
  on public.issuance_jobs (
    status,
    next_attempt_at,
    priority,
    created_at
  );

create index if not exists idx_issuance_jobs_order_id
  on public.issuance_jobs(order_id);

create index if not exists idx_issuance_jobs_lease_expiry
  on public.issuance_jobs(lease_expires_at)
  where status = 'leased';

drop trigger if exists trg_issuance_jobs_updated_at on public.issuance_jobs;
create trigger trg_issuance_jobs_updated_at
before update on public.issuance_jobs
for each row execute function public.set_updated_at();

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
  where
    pv.id = new.product_version_id
    and pv.product_id = new.product_id;

  if v_version_status is distinct from 'published' then
    raise exception 'issuance job requires a published product version'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_issuance_jobs_identity on public.issuance_jobs;
create trigger trg_issuance_jobs_identity
before insert or update on public.issuance_jobs
for each row execute function public.validate_issuance_job_identity();

create or replace function public.enforce_issuance_job_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_allowed boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  v_allowed := case old.status
    when 'queued' then new.status in ('leased', 'cancelled')
    when 'leased' then new.status in (
      'succeeded',
      'retry_wait',
      'dead_letter',
      'cancelled'
    )
    when 'retry_wait' then new.status in ('leased', 'cancelled')
    when 'dead_letter' then new.status = 'cancelled'
    when 'succeeded' then false
    when 'cancelled' then false
    else false
  end;

  if not v_allowed then
    raise exception 'invalid issuance job transition: % -> %',
      old.status, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_issuance_jobs_transition on public.issuance_jobs;
create trigger trg_issuance_jobs_transition
before update on public.issuance_jobs
for each row execute function public.enforce_issuance_job_transition();

create table if not exists public.issuance_job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.issuance_jobs(id) on delete cascade,
  from_status text,
  to_status text not null,
  attempt_count integer not null,
  lease_owner text,
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists idx_issuance_job_events_job_id
  on public.issuance_job_events(job_id, id);

create or replace function public.log_issuance_job_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.issuance_job_events (
      job_id,
      from_status,
      to_status,
      attempt_count,
      lease_owner,
      error_code
    )
    values (
      new.id,
      null,
      new.status,
      new.attempt_count,
      new.lease_owner,
      new.last_error_code
    );

    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.issuance_job_events (
      job_id,
      from_status,
      to_status,
      attempt_count,
      lease_owner,
      error_code
    )
    values (
      new.id,
      old.status,
      new.status,
      new.attempt_count,
      new.lease_owner,
      new.last_error_code
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_issuance_job_event_insert on public.issuance_jobs;
create trigger trg_issuance_job_event_insert
after insert on public.issuance_jobs
for each row execute function public.log_issuance_job_event();

drop trigger if exists trg_issuance_job_event_update on public.issuance_jobs;
create trigger trg_issuance_job_event_update
after update on public.issuance_jobs
for each row execute function public.log_issuance_job_event();

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

  select
    count(*)::integer,
    count(*) filter (where j.status = 'dead_letter')::integer,
    count(*) filter (where j.status = 'leased')::integer,
    count(*) filter (
      where j.status in ('queued', 'retry_wait')
    )::integer,
    count(*) filter (where j.status = 'succeeded')::integer,
    count(*) filter (where j.status = 'cancelled')::integer
  into
    v_total,
    v_dead,
    v_leased,
    v_waiting,
    v_succeeded,
    v_cancelled
  from public.issuance_jobs j
  where j.order_id = p_order_id;

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
  where
    id = p_order_id
    and fulfillment_status is distinct from v_target;
end;
$$;

create or replace function public.enqueue_order_issuance(
  p_order_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_status text;
  v_inserted integer;
begin
  select o.status
  into v_order_status
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'order not found'
      using errcode = 'no_data_found';
  end if;

  if v_order_status <> 'paid' then
    raise exception 'order must be paid before enqueue'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from public.order_items oi
    where
      oi.order_id = p_order_id
      and oi.product_version_id is null
  ) then
    raise exception 'every order item must pin a product version'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from public.order_items oi
    join public.product_versions pv
      on pv.id = oi.product_version_id
    where
      oi.order_id = p_order_id
      and (
        pv.product_id <> oi.product_id
        or pv.status <> 'published'
      )
  ) then
    raise exception 'every order item must reference a published version'
      using errcode = 'check_violation';
  end if;

  insert into public.issuance_jobs (
    order_id,
    order_item_id,
    product_id,
    product_version_id,
    artifact_code,
    generation,
    payload_version,
    status,
    max_attempts
  )
  select
    oi.order_id,
    oi.id,
    oi.product_id,
    oi.product_version_id,
    'bundle',
    1,
    1,
    'queued',
    5
  from public.order_items oi
  where oi.order_id = p_order_id
  on conflict (
    order_item_id,
    product_version_id,
    artifact_code,
    generation
  ) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    perform public.refresh_order_fulfillment(p_order_id);
  end if;

  return v_inserted;
end;
$$;

create or replace function public.claim_issuance_job(
  p_worker_id text,
  p_lease_seconds integer default 300
)
returns table (
  schema_version integer,
  job_id uuid,
  lease_token uuid,
  attempt integer,
  generation integer,
  order_id uuid,
  order_item_id uuid,
  product_code text,
  product_version text,
  edition_year integer,
  artifact_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id uuid;
  v_order_id uuid;
begin
  if p_worker_id is null or btrim(p_worker_id) = '' then
    raise exception 'worker_id is required'
      using errcode = 'check_violation';
  end if;

  if p_lease_seconds < 60 or p_lease_seconds > 1800 then
    raise exception 'lease_seconds must be between 60 and 1800'
      using errcode = 'check_violation';
  end if;

  select j.id
  into v_job_id
  from public.issuance_jobs j
  join public.orders o on o.id = j.order_id
  where
    o.status = 'paid'
    and j.attempt_count < j.max_attempts
    and (
      j.status = 'queued'
      or (
        j.status = 'retry_wait'
        and j.next_attempt_at <= now()
      )
      or (
        j.status = 'leased'
        and j.lease_expires_at <= now()
      )
    )
  order by j.priority asc, j.created_at asc
  for update of j skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.issuance_jobs j
  set
    status = 'leased',
    attempt_count = j.attempt_count + 1,
    lease_token = gen_random_uuid(),
    lease_owner = p_worker_id,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    last_error_code = null,
    last_error_detail = null
  where j.id = v_job_id
  returning j.order_id into v_order_id;

  perform public.refresh_order_fulfillment(v_order_id);

  return query
  select
    j.payload_version,
    j.id,
    j.lease_token,
    j.attempt_count,
    j.generation,
    j.order_id,
    j.order_item_id,
    p.code,
    pv.version,
    pv.edition_year,
    j.artifact_code
  from public.issuance_jobs j
  join public.products p on p.id = j.product_id
  join public.product_versions pv on pv.id = j.product_version_id
  where j.id = v_job_id;
end;
$$;

create or replace function public.renew_issuance_lease(
  p_job_id uuid,
  p_lease_token uuid,
  p_worker_id text,
  p_lease_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_lease_seconds < 60 or p_lease_seconds > 1800 then
    return false;
  end if;

  update public.issuance_jobs j
  set lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  where
    j.id = p_job_id
    and j.status = 'leased'
    and j.lease_token = p_lease_token
    and j.lease_owner = p_worker_id
    and j.lease_expires_at > now();

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

create or replace function public.complete_issuance_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_storage_key text,
  p_sha256 text,
  p_size_bytes bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
begin
  if p_storage_key is null or btrim(p_storage_key) = '' then
    return false;
  end if;

  if p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  if p_size_bytes is null or p_size_bytes < 0 then
    return false;
  end if;

  update public.issuance_jobs j
  set
    status = 'succeeded',
    result_storage_key = p_storage_key,
    result_sha256 = p_sha256,
    result_size_bytes = p_size_bytes,
    completed_at = now(),
    lease_token = null,
    lease_owner = null,
    lease_expires_at = null,
    last_error_code = null,
    last_error_detail = null
  where
    j.id = p_job_id
    and j.status = 'leased'
    and j.lease_token = p_lease_token
    and j.lease_expires_at > now()
  returning j.order_id into v_order_id;

  if not found then
    return false;
  end if;

  perform public.refresh_order_fulfillment(v_order_id);
  return true;
end;
$$;

create or replace function public.fail_issuance_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_error_code text,
  p_error_detail text,
  p_retryable boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_attempt integer;
  v_max_attempts integer;
  v_target text;
  v_delay_seconds integer;
begin
  select
    j.order_id,
    j.attempt_count,
    j.max_attempts
  into
    v_order_id,
    v_attempt,
    v_max_attempts
  from public.issuance_jobs j
  where
    j.id = p_job_id
    and j.status = 'leased'
    and j.lease_token = p_lease_token
    and j.lease_expires_at > now()
  for update;

  if not found then
    return 'lease_lost';
  end if;

  if coalesce(p_retryable, false) and v_attempt < v_max_attempts then
    v_target := 'retry_wait';
    v_delay_seconds := case v_attempt
      when 1 then 60
      when 2 then 300
      when 3 then 900
      else 3600
    end;
  else
    v_target := 'dead_letter';
    v_delay_seconds := 0;
  end if;

  update public.issuance_jobs j
  set
    status = v_target,
    next_attempt_at = case
      when v_target = 'retry_wait'
        then now() + make_interval(secs => v_delay_seconds)
      else j.next_attempt_at
    end,
    lease_token = null,
    lease_owner = null,
    lease_expires_at = null,
    last_error_code = coalesce(p_error_code, 'INVALID_JOB'),
    last_error_detail = left(p_error_detail, 1000),
    completed_at = case
      when v_target = 'dead_letter' then now()
      else null
    end
  where j.id = p_job_id;

  perform public.refresh_order_fulfillment(v_order_id);
  return v_target;
end;
$$;

create or replace function public.reap_expired_issuance_jobs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_count integer := 0;
begin
  for v_order_id in
    with expired as (
      update public.issuance_jobs j
      set
        status = 'dead_letter',
        lease_token = null,
        lease_owner = null,
        lease_expires_at = null,
        last_error_code = 'LEASE_LOST',
        last_error_detail = 'lease expired after max attempts',
        completed_at = now()
      where
        j.status = 'leased'
        and j.lease_expires_at <= now()
        and j.attempt_count >= j.max_attempts
      returning j.order_id
    )
    select distinct e.order_id
    from expired e
  loop
    v_count := v_count + 1;
    perform public.refresh_order_fulfillment(v_order_id);
  end loop;

  return v_count;
end;
$$;

create or replace function public.cancel_issuance_jobs_on_refund()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'refunded' and old.status <> 'refunded' then
    update public.issuance_jobs j
    set
      status = 'cancelled',
      lease_token = null,
      lease_owner = null,
      lease_expires_at = null,
      completed_at = coalesce(j.completed_at, now()),
      last_error_code = null,
      last_error_detail = null
    where
      j.order_id = new.id
      and j.status in (
        'queued',
        'retry_wait',
        'leased',
        'dead_letter'
      );

    update public.entitlements e
    set
      status = 'revoked',
      revoked_at = coalesce(e.revoked_at, now())
    where
      e.source_order_id = new.id
      and e.status = 'active';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_cancel_issuance_jobs_on_refund on public.orders;
create trigger trg_cancel_issuance_jobs_on_refund
after update of status on public.orders
for each row execute function public.cancel_issuance_jobs_on_refund();

alter table public.issuance_jobs enable row level security;
alter table public.issuance_job_events enable row level security;

revoke all on public.issuance_jobs from anon, authenticated;
revoke all on public.issuance_job_events from anon, authenticated;

revoke all on function public.refresh_order_fulfillment(uuid) from public;
revoke all on function public.enqueue_order_issuance(uuid) from public;
revoke all on function public.claim_issuance_job(text, integer) from public;
revoke all on function public.renew_issuance_lease(uuid, uuid, text, integer) from public;
revoke all on function public.complete_issuance_job(uuid, uuid, text, text, bigint) from public;
revoke all on function public.fail_issuance_job(uuid, uuid, text, text, boolean) from public;
revoke all on function public.reap_expired_issuance_jobs() from public;

grant execute on function public.enqueue_order_issuance(uuid) to service_role;
grant execute on function public.claim_issuance_job(text, integer) to service_role;
grant execute on function public.renew_issuance_lease(uuid, uuid, text, integer) to service_role;
grant execute on function public.complete_issuance_job(uuid, uuid, text, text, bigint) to service_role;
grant execute on function public.fail_issuance_job(uuid, uuid, text, text, boolean) to service_role;
grant execute on function public.reap_expired_issuance_jobs() to service_role;
