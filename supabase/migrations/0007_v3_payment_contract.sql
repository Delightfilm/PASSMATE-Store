-- PASSMATE V3 provider-neutral payment contract.
-- No provider-specific secrets or signature rules belong in this migration.

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z0-9_-]{2,32}$'),
  merchant_order_id text not null,
  provider_payment_id text,
  idempotency_key text not null,
  status text not null default 'pending'
    check (status in ('pending','paid','failed','cancelled','refunded')),
  amount_krw integer not null check (amount_krw >= 0),
  currency text not null default 'KRW' check (currency = 'KRW'),
  failure_code text,
  failure_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  unique(provider, idempotency_key),
  unique(provider, merchant_order_id),
  check (length(idempotency_key) between 1 and 128),
  check (length(merchant_order_id) between 1 and 128)
);

create unique index if not exists uq_payment_attempt_provider_payment
  on public.payment_attempts(provider, provider_payment_id)
  where provider_payment_id is not null;

create index if not exists idx_payment_attempts_order_id
  on public.payment_attempts(order_id);

drop trigger if exists trg_payment_attempts_updated_at on public.payment_attempts;
create trigger trg_payment_attempts_updated_at
before update on public.payment_attempts
for each row execute function public.set_updated_at();

create table if not exists public.payment_events (
  id bigint generated always as identity primary key,
  payment_attempt_id uuid not null references public.payment_attempts(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  provider_event_id text not null,
  event_type text not null
    check (event_type in ('paid','failed','cancelled','refunded')),
  provider_payment_id text,
  amount_krw integer,
  payload_sha256 text not null
    check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  failure_code text,
  created_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

create index if not exists idx_payment_events_order_id
  on public.payment_events(order_id, id);

create index if not exists idx_payment_events_attempt_id
  on public.payment_events(payment_attempt_id, id);

alter table public.payment_attempts enable row level security;
alter table public.payment_events enable row level security;

revoke all on public.payment_attempts from anon, authenticated;
revoke all on public.payment_events from anon, authenticated;

drop policy if exists "payment_attempts_client_deny" on public.payment_attempts;
create policy "payment_attempts_client_deny"
on public.payment_attempts
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "payment_events_client_deny" on public.payment_events;
create policy "payment_events_client_deny"
on public.payment_events
for all
to anon, authenticated
using (false)
with check (false);

create or replace function public.start_payment_attempt(
  p_order_id uuid,
  p_provider text,
  p_merchant_order_id text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_attempt_id uuid;
begin
  if p_provider is null or p_provider !~ '^[a-z0-9_-]{2,32}$' then
    raise exception 'invalid payment provider'
      using errcode = 'check_violation';
  end if;

  if p_merchant_order_id is null or length(p_merchant_order_id) not between 1 and 128 then
    raise exception 'invalid merchant order id'
      using errcode = 'check_violation';
  end if;

  if p_idempotency_key is null or length(p_idempotency_key) not between 1 and 128 then
    raise exception 'invalid payment idempotency key'
      using errcode = 'check_violation';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order not found'
      using errcode = 'no_data_found';
  end if;

  select pa.id
  into v_attempt_id
  from public.payment_attempts pa
  where pa.provider = p_provider
    and pa.idempotency_key = p_idempotency_key;

  if found then
    if not exists (
      select 1
      from public.payment_attempts pa
      where pa.id = v_attempt_id
        and pa.order_id = p_order_id
        and pa.merchant_order_id = p_merchant_order_id
    ) then
      raise exception 'idempotency key reused with different payment identity'
        using errcode = 'unique_violation';
    end if;
    return v_attempt_id;
  end if;

  if v_order.status not in ('pending','failed') then
    raise exception 'order cannot start payment from status %', v_order.status
      using errcode = 'check_violation';
  end if;

  if v_order.channel = 'direct' and v_order.user_id is null then
    raise exception 'direct order requires authenticated user'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.order_items oi where oi.order_id = p_order_id
  ) then
    raise exception 'order has no items'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from public.order_items oi
    left join public.product_versions pv on pv.id = oi.product_version_id
    where oi.order_id = p_order_id
      and (
        oi.product_version_id is null
        or pv.id is null
        or pv.product_id <> oi.product_id
        or pv.status <> 'published'
      )
  ) then
    raise exception 'all order items must pin published product versions'
      using errcode = 'check_violation';
  end if;

  if (
    select coalesce(sum(oi.quantity * oi.unit_price_krw), 0)
    from public.order_items oi
    where oi.order_id = p_order_id
  ) <> v_order.total_amount_krw then
    raise exception 'order total does not match order items'
      using errcode = 'check_violation';
  end if;

  insert into public.payment_attempts (
    order_id,
    provider,
    merchant_order_id,
    idempotency_key,
    amount_krw,
    currency,
    status
  )
  values (
    p_order_id,
    p_provider,
    p_merchant_order_id,
    p_idempotency_key,
    v_order.total_amount_krw,
    v_order.currency,
    'pending'
  )
  returning id into v_attempt_id;

  update public.orders
  set
    status = 'payment_pending',
    payment_provider = p_provider,
    provider_order_id = p_merchant_order_id
  where id = p_order_id;

  return v_attempt_id;
end;
$$;

create or replace function public.apply_payment_event(
  p_attempt_id uuid,
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_payload_sha256 text,
  p_provider_payment_id text default null,
  p_amount_krw integer default null,
  p_failure_code text default null,
  p_failure_detail text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.payment_attempts%rowtype;
  v_order public.orders%rowtype;
  v_event_inserted integer;
begin
  if p_event_type not in ('paid','failed','cancelled','refunded') then
    raise exception 'invalid payment event type'
      using errcode = 'check_violation';
  end if;

  if p_provider_event_id is null or length(p_provider_event_id) not between 1 and 160 then
    raise exception 'invalid provider event id'
      using errcode = 'check_violation';
  end if;

  if p_payload_sha256 is null or p_payload_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid payment payload fingerprint'
      using errcode = 'check_violation';
  end if;

  select *
  into v_attempt
  from public.payment_attempts
  where id = p_attempt_id
  for update;

  if not found then
    raise exception 'payment attempt not found'
      using errcode = 'no_data_found';
  end if;

  if v_attempt.provider <> p_provider then
    raise exception 'payment provider mismatch'
      using errcode = 'check_violation';
  end if;

  select *
  into v_order
  from public.orders
  where id = v_attempt.order_id
  for update;

  insert into public.payment_events (
    payment_attempt_id,
    order_id,
    provider,
    provider_event_id,
    event_type,
    provider_payment_id,
    amount_krw,
    payload_sha256,
    failure_code
  )
  values (
    v_attempt.id,
    v_attempt.order_id,
    p_provider,
    p_provider_event_id,
    p_event_type,
    p_provider_payment_id,
    p_amount_krw,
    p_payload_sha256,
    p_failure_code
  )
  on conflict (provider, provider_event_id) do nothing;

  get diagnostics v_event_inserted = row_count;
  if v_event_inserted = 0 then
    return 'duplicate';
  end if;

  if p_event_type = 'paid' then
    if v_attempt.status <> 'pending' or v_order.status <> 'payment_pending' then
      raise exception 'payment cannot be marked paid from current status'
        using errcode = 'check_violation';
    end if;

    if p_provider_payment_id is null or btrim(p_provider_payment_id) = '' then
      raise exception 'provider payment id required for paid event'
        using errcode = 'check_violation';
    end if;

    if p_amount_krw is null
       or p_amount_krw <> v_attempt.amount_krw
       or p_amount_krw <> v_order.total_amount_krw then
      raise exception 'verified payment amount mismatch'
        using errcode = 'check_violation';
    end if;

    update public.payment_attempts
    set
      status = 'paid',
      provider_payment_id = p_provider_payment_id,
      paid_at = now(),
      failure_code = null,
      failure_detail = null
    where id = v_attempt.id;

    update public.orders
    set status = 'paid'
    where id = v_order.id;

    if v_order.user_id is not null then
      insert into public.entitlements (
        user_id,
        product_id,
        product_version_id,
        source_order_id,
        status,
        granted_at,
        revoked_at
      )
      select
        v_order.user_id,
        oi.product_id,
        oi.product_version_id,
        v_order.id,
        'active',
        now(),
        null
      from public.order_items oi
      where oi.order_id = v_order.id
      on conflict (user_id, product_id) do update set
        product_version_id = excluded.product_version_id,
        source_order_id = excluded.source_order_id,
        status = 'active',
        granted_at = excluded.granted_at,
        revoked_at = null;
    end if;

    perform public.enqueue_order_issuance(v_order.id);
    return 'paid';

  elsif p_event_type = 'failed' then
    if v_attempt.status <> 'pending' or v_order.status <> 'payment_pending' then
      raise exception 'payment cannot fail from current status'
        using errcode = 'check_violation';
    end if;

    update public.payment_attempts
    set
      status = 'failed',
      failure_code = coalesce(p_failure_code, 'PAYMENT_FAILED'),
      failure_detail = left(p_failure_detail, 1000)
    where id = v_attempt.id;

    update public.orders
    set
      status = 'failed',
      failure_code = coalesce(p_failure_code, 'PAYMENT_FAILED'),
      failure_detail = left(p_failure_detail, 1000)
    where id = v_order.id;

    return 'failed';

  elsif p_event_type = 'cancelled' then
    if v_attempt.status <> 'pending' or v_order.status <> 'payment_pending' then
      raise exception 'payment cannot be cancelled from current status'
        using errcode = 'check_violation';
    end if;

    update public.payment_attempts
    set
      status = 'cancelled',
      cancelled_at = now()
    where id = v_attempt.id;

    update public.orders
    set status = 'cancelled'
    where id = v_order.id;

    return 'cancelled';

  else
    if v_attempt.status <> 'paid' or v_order.status <> 'paid' then
      raise exception 'payment cannot be refunded from current status'
        using errcode = 'check_violation';
    end if;

    if p_amount_krw is not null and p_amount_krw <> v_attempt.amount_krw then
      raise exception 'V3 supports full refund only'
        using errcode = 'check_violation';
    end if;

    update public.payment_attempts
    set
      status = 'refunded',
      refunded_at = now()
    where id = v_attempt.id;

    update public.orders
    set
      status = 'refunded',
      fulfillment_status = 'revoked'
    where id = v_order.id;

    return 'refunded';
  end if;
end;
$$;

revoke all on function public.start_payment_attempt(uuid,text,text,text)
  from public, anon, authenticated;
revoke all on function public.apply_payment_event(uuid,text,text,text,text,text,integer,text,text)
  from public, anon, authenticated;

grant execute on function public.start_payment_attempt(uuid,text,text,text)
  to service_role;
grant execute on function public.apply_payment_event(uuid,text,text,text,text,text,integer,text,text)
  to service_role;
