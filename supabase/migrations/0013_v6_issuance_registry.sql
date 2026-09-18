-- PASSMATE V6 internal issuance registry.
-- Internal operational data only. Never expose this registry in customer UI.

create table if not exists public.issuance_artifacts (
  id uuid primary key default gen_random_uuid(),
  internal_ref text not null unique
    default ('IA-' || replace(gen_random_uuid()::text, '-', '')),
  issuance_job_id uuid not null unique
    references public.issuance_jobs(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_version_id uuid not null references public.product_versions(id) on delete restrict,
  artifact_code text not null,
  generation integer not null check (generation >= 1),
  storage_key text not null unique,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  size_bytes bigint not null check (size_bytes > 0),
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active','superseded','revoked')),
  integrity_status text not null default 'unchecked'
    check (integrity_status in ('unchecked','verified','mismatch','unavailable')),
  last_observed_sha256 text
    check (
      last_observed_sha256 is null
      or last_observed_sha256 ~ '^[a-f0-9]{64}$'
    ),
  last_observed_size_bytes bigint
    check (
      last_observed_size_bytes is null
      or last_observed_size_bytes >= 0
    ),
  registered_at timestamptz not null default now(),
  superseded_at timestamptz,
  revoked_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_issuance_artifacts_order
  on public.issuance_artifacts(order_id, registered_at desc);

create index if not exists idx_issuance_artifacts_product_version
  on public.issuance_artifacts(product_id, product_version_id, registered_at desc);

create index if not exists idx_issuance_artifacts_sha256
  on public.issuance_artifacts(sha256);

create index if not exists idx_issuance_artifacts_status
  on public.issuance_artifacts(lifecycle_status, integrity_status, registered_at desc);

create table if not exists public.issuance_artifact_events (
  id bigint generated always as identity primary key,
  artifact_id uuid not null
    references public.issuance_artifacts(id) on delete cascade,
  event_type text not null
    check (
      event_type in (
        'registered',
        'superseded',
        'revoked',
        'integrity_verified',
        'integrity_mismatch',
        'integrity_unavailable'
      )
    ),
  actor_user_id uuid references auth.users(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_issuance_artifact_events_artifact
  on public.issuance_artifact_events(artifact_id, id);

create index if not exists idx_issuance_artifact_events_actor
  on public.issuance_artifact_events(actor_user_id)
  where actor_user_id is not null;

alter table public.issuance_artifacts enable row level security;
alter table public.issuance_artifact_events enable row level security;

revoke all on public.issuance_artifacts from anon, authenticated;
revoke all on public.issuance_artifact_events from anon, authenticated;

drop policy if exists "issuance_artifacts_client_deny"
  on public.issuance_artifacts;
create policy "issuance_artifacts_client_deny"
on public.issuance_artifacts
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "issuance_artifact_events_client_deny"
  on public.issuance_artifact_events;
create policy "issuance_artifact_events_client_deny"
on public.issuance_artifact_events
for all
to anon, authenticated
using (false)
with check (false);

create or replace function private.register_issuance_artifact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artifact_id uuid;
  v_old_id uuid;
begin
  if new.status <> 'succeeded'
     or old.status = 'succeeded'
     or new.result_storage_key is null
     or new.result_sha256 is null
     or new.result_size_bytes is null then
    return new;
  end if;

  insert into public.issuance_artifacts (
    issuance_job_id,
    order_id,
    order_item_id,
    product_id,
    product_version_id,
    artifact_code,
    generation,
    storage_key,
    sha256,
    size_bytes,
    lifecycle_status,
    integrity_status,
    registered_at
  )
  values (
    new.id,
    new.order_id,
    new.order_item_id,
    new.product_id,
    new.product_version_id,
    new.artifact_code,
    new.generation,
    new.result_storage_key,
    new.result_sha256,
    new.result_size_bytes,
    'active',
    'unchecked',
    coalesce(new.completed_at, now())
  )
  on conflict (issuance_job_id) do nothing
  returning id into v_artifact_id;

  if v_artifact_id is null then
    return new;
  end if;

  for v_old_id in
    update public.issuance_artifacts a
    set
      lifecycle_status = 'superseded',
      superseded_at = now()
    where a.id <> v_artifact_id
      and a.order_item_id = new.order_item_id
      and a.product_version_id = new.product_version_id
      and a.artifact_code = new.artifact_code
      and a.lifecycle_status = 'active'
    returning a.id
  loop
    insert into public.issuance_artifact_events (
      artifact_id,
      event_type,
      detail
    )
    values (
      v_old_id,
      'superseded',
      jsonb_build_object(
        'replacement_job_id', new.id,
        'replacement_generation', new.generation
      )
    );
  end loop;

  insert into public.issuance_artifact_events (
    artifact_id,
    event_type,
    detail
  )
  values (
    v_artifact_id,
    'registered',
    jsonb_build_object(
      'issuance_job_id', new.id,
      'generation', new.generation
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_register_issuance_artifact
  on public.issuance_jobs;

create trigger trg_register_issuance_artifact
after update of status on public.issuance_jobs
for each row
execute function private.register_issuance_artifact();

create or replace function private.revoke_issuance_artifacts_on_refund()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artifact_id uuid;
begin
  if new.status <> 'refunded'
     or old.status = 'refunded' then
    return new;
  end if;

  for v_artifact_id in
    update public.issuance_artifacts a
    set
      lifecycle_status = 'revoked',
      revoked_at = now()
    where a.order_id = new.id
      and a.lifecycle_status <> 'revoked'
    returning a.id
  loop
    insert into public.issuance_artifact_events (
      artifact_id,
      event_type,
      detail
    )
    values (
      v_artifact_id,
      'revoked',
      jsonb_build_object('reason', 'order_refunded')
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_revoke_issuance_artifacts_on_refund
  on public.orders;

create trigger trg_revoke_issuance_artifacts_on_refund
after update of status on public.orders
for each row
execute function private.revoke_issuance_artifacts_on_refund();

-- Backfill already-succeeded jobs, if any.
with ranked as (
  select
    j.*,
    o.status as order_status,
    max(j.generation) over (
      partition by j.order_item_id, j.product_version_id, j.artifact_code
    ) as newest_generation
  from public.issuance_jobs j
  join public.orders o on o.id = j.order_id
  where j.status = 'succeeded'
    and j.result_storage_key is not null
    and j.result_sha256 is not null
    and j.result_size_bytes is not null
)
insert into public.issuance_artifacts (
  issuance_job_id,
  order_id,
  order_item_id,
  product_id,
  product_version_id,
  artifact_code,
  generation,
  storage_key,
  sha256,
  size_bytes,
  lifecycle_status,
  integrity_status,
  registered_at,
  superseded_at,
  revoked_at
)
select
  r.id,
  r.order_id,
  r.order_item_id,
  r.product_id,
  r.product_version_id,
  r.artifact_code,
  r.generation,
  r.result_storage_key,
  r.result_sha256,
  r.result_size_bytes,
  case
    when r.order_status = 'refunded' then 'revoked'
    when r.generation = r.newest_generation then 'active'
    else 'superseded'
  end,
  'unchecked',
  coalesce(r.completed_at, r.created_at),
  case
    when r.order_status <> 'refunded'
     and r.generation <> r.newest_generation
    then coalesce(r.completed_at, r.created_at)
  end,
  case
    when r.order_status = 'refunded'
    then coalesce(r.completed_at, r.created_at)
  end
from ranked r
on conflict (issuance_job_id) do nothing;

insert into public.issuance_artifact_events (
  artifact_id,
  event_type,
  detail
)
select
  a.id,
  'registered',
  jsonb_build_object(
    'issuance_job_id', a.issuance_job_id,
    'generation', a.generation,
    'backfill', true
  )
from public.issuance_artifacts a
where not exists (
  select 1
  from public.issuance_artifact_events e
  where e.artifact_id = a.id
    and e.event_type = 'registered'
);

create or replace function public.admin_list_issuance_artifacts(
  p_admin_user_id uuid,
  p_limit integer default 100
)
returns table (
  artifact_id uuid,
  internal_ref text,
  order_id uuid,
  product_code text,
  product_version text,
  artifact_code text,
  generation integer,
  lifecycle_status text,
  integrity_status text,
  sha256 text,
  size_bytes bigint,
  registered_at timestamptz,
  last_verified_at timestamptz
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
    a.id,
    a.internal_ref,
    a.order_id,
    p.code,
    pv.version,
    a.artifact_code,
    a.generation,
    a.lifecycle_status,
    a.integrity_status,
    a.sha256,
    a.size_bytes,
    a.registered_at,
    a.last_verified_at
  from public.issuance_artifacts a
  join public.products p on p.id = a.product_id
  join public.product_versions pv on pv.id = a.product_version_id
  order by a.registered_at desc
  limit p_limit;
end;
$$;

create or replace function public.admin_get_issuance_artifact(
  p_admin_user_id uuid,
  p_artifact_id uuid
)
returns table (
  artifact_id uuid,
  storage_key text,
  expected_sha256 text,
  expected_size_bytes bigint,
  lifecycle_status text,
  integrity_status text
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
    a.id,
    a.storage_key,
    a.sha256,
    a.size_bytes,
    a.lifecycle_status,
    a.integrity_status
  from public.issuance_artifacts a
  where a.id = p_artifact_id
  limit 1;
end;
$$;

create or replace function public.admin_record_artifact_integrity(
  p_admin_user_id uuid,
  p_artifact_id uuid,
  p_integrity_status text,
  p_observed_sha256 text default null,
  p_observed_size_bytes bigint default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artifact public.issuance_artifacts%rowtype;
  v_event_type text;
begin
  perform private.assert_admin_actor(p_admin_user_id);

  if p_integrity_status not in ('verified','mismatch','unavailable') then
    raise exception 'invalid integrity status'
      using errcode = 'check_violation';
  end if;

  if p_observed_sha256 is not null
     and p_observed_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid observed sha256'
      using errcode = 'check_violation';
  end if;

  if p_observed_size_bytes is not null
     and p_observed_size_bytes < 0 then
    raise exception 'invalid observed size'
      using errcode = 'check_violation';
  end if;

  select *
  into v_artifact
  from public.issuance_artifacts
  where id = p_artifact_id
  for update;

  if not found then
    raise exception 'issuance artifact not found'
      using errcode = 'no_data_found';
  end if;

  if p_integrity_status = 'verified'
     and (
       p_observed_sha256 is distinct from v_artifact.sha256
       or p_observed_size_bytes is distinct from v_artifact.size_bytes
     ) then
    raise exception 'verified observation must match registry'
      using errcode = 'check_violation';
  end if;

  if p_integrity_status = 'mismatch'
     and p_observed_sha256 is not distinct from v_artifact.sha256
     and p_observed_size_bytes is not distinct from v_artifact.size_bytes then
    raise exception 'mismatch observation must differ from registry'
      using errcode = 'check_violation';
  end if;

  update public.issuance_artifacts
  set
    integrity_status = p_integrity_status,
    last_observed_sha256 = p_observed_sha256,
    last_observed_size_bytes = p_observed_size_bytes,
    last_verified_at = now()
  where id = p_artifact_id;

  v_event_type := case p_integrity_status
    when 'verified' then 'integrity_verified'
    when 'mismatch' then 'integrity_mismatch'
    else 'integrity_unavailable'
  end;

  insert into public.issuance_artifact_events (
    artifact_id,
    event_type,
    actor_user_id,
    detail
  )
  values (
    p_artifact_id,
    v_event_type,
    p_admin_user_id,
    jsonb_build_object(
      'observed_sha256', p_observed_sha256,
      'observed_size_bytes', p_observed_size_bytes
    )
  );

  insert into public.admin_action_events (
    actor_user_id,
    action,
    target_type,
    target_id,
    detail
  )
  values (
    p_admin_user_id,
    'verify_issuance_artifact',
    'issuance_artifact',
    p_artifact_id,
    jsonb_build_object('result', p_integrity_status)
  );

  return p_integrity_status;
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
    ),
    'artifacts_active', (
      select count(*)
      from public.issuance_artifacts
      where lifecycle_status = 'active'
    ),
    'artifacts_integrity_attention', (
      select count(*)
      from public.issuance_artifacts
      where integrity_status in ('mismatch','unavailable')
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_list_issuance_artifacts(uuid,integer)
  from public, anon, authenticated;
revoke all on function public.admin_get_issuance_artifact(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.admin_record_artifact_integrity(uuid,uuid,text,text,bigint)
  from public, anon, authenticated;

grant execute on function public.admin_list_issuance_artifacts(uuid,integer)
  to service_role;
grant execute on function public.admin_get_issuance_artifact(uuid,uuid)
  to service_role;
grant execute on function public.admin_record_artifact_integrity(uuid,uuid,text,text,bigint)
  to service_role;
