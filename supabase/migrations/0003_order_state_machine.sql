-- PASSMATE V1.5 order state machine
-- Separates commercial/payment lifecycle from fulfillment lifecycle.

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add column if not exists fulfillment_status text not null default 'not_started',
  add column if not exists state_version integer not null default 0,
  add column if not exists failure_code text,
  add column if not exists failure_detail text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists refunded_at timestamptz;

alter table public.orders
  add constraint orders_status_check
  check (
    status in (
      'pending',
      'payment_pending',
      'paid',
      'failed',
      'cancelled',
      'refunded'
    )
  );

alter table public.orders
  add constraint orders_fulfillment_status_check
  check (
    fulfillment_status in (
      'not_started',
      'queued',
      'issuing',
      'ready',
      'failed',
      'revoked'
    )
  );

alter table public.orders
  add constraint orders_state_version_nonnegative
  check (state_version >= 0);

alter table public.orders
  add constraint orders_cross_state_check
  check (
    (
      status = 'paid'
      and fulfillment_status in (
        'not_started',
        'queued',
        'issuing',
        'ready',
        'failed'
      )
    )
    or (
      status = 'refunded'
      and fulfillment_status = 'revoked'
    )
    or (
      status in (
        'pending',
        'payment_pending',
        'failed',
        'cancelled'
      )
      and fulfillment_status = 'not_started'
    )
  );

create table if not exists public.order_state_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  from_fulfillment_status text,
  to_fulfillment_status text not null,
  state_version integer not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'system'
    check (actor_type in ('system', 'user')),
  failure_code text,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_state_events_order_id
  on public.order_state_events(order_id, id);

create or replace function public.enforce_order_state_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  order_transition_allowed boolean;
  fulfillment_transition_allowed boolean;
begin
  if new.status = old.status then
    order_transition_allowed := true;
  else
    order_transition_allowed := case old.status
      when 'pending' then new.status in ('payment_pending', 'cancelled')
      when 'payment_pending' then new.status in ('paid', 'failed', 'cancelled')
      when 'failed' then new.status in ('payment_pending', 'cancelled')
      when 'paid' then new.status = 'refunded'
      when 'cancelled' then false
      when 'refunded' then false
      else false
    end;
  end if;

  if not order_transition_allowed then
    raise exception 'invalid order status transition: % -> %',
      old.status, new.status
      using errcode = 'check_violation';
  end if;

  if new.fulfillment_status = old.fulfillment_status then
    fulfillment_transition_allowed := true;
  else
    fulfillment_transition_allowed := case old.fulfillment_status
      when 'not_started' then new.fulfillment_status in ('queued', 'revoked')
      when 'queued' then new.fulfillment_status in ('issuing', 'failed', 'revoked')
      when 'issuing' then new.fulfillment_status in ('queued', 'ready', 'failed', 'revoked')
      when 'ready' then new.fulfillment_status = 'revoked'
      when 'failed' then new.fulfillment_status in ('queued', 'revoked')
      when 'revoked' then false
      else false
    end;
  end if;

  if not fulfillment_transition_allowed then
    raise exception 'invalid fulfillment transition: % -> %',
      old.fulfillment_status, new.fulfillment_status
      using errcode = 'check_violation';
  end if;

  if new.status = 'paid' then
    if new.fulfillment_status = 'revoked' then
      raise exception 'paid order cannot have revoked fulfillment'
        using errcode = 'check_violation';
    end if;
  elsif new.status = 'refunded' then
    if new.fulfillment_status <> 'revoked' then
      raise exception 'refunded order must have revoked fulfillment'
        using errcode = 'check_violation';
    end if;
  elsif new.fulfillment_status <> 'not_started' then
    raise exception 'unpaid order cannot start fulfillment'
      using errcode = 'check_violation';
  end if;

  if
    new.status is distinct from old.status
    or new.fulfillment_status is distinct from old.fulfillment_status
  then
    new.state_version := old.state_version + 1;

    if new.status = 'paid' and old.status <> 'paid' and new.paid_at is null then
      new.paid_at := now();
    end if;

    if new.status = 'cancelled' and old.status <> 'cancelled' then
      new.cancelled_at := coalesce(new.cancelled_at, now());
    end if;

    if new.status = 'refunded' and old.status <> 'refunded' then
      new.refunded_at := coalesce(new.refunded_at, now());
    end if;

    if new.status <> 'failed' and new.fulfillment_status <> 'failed' then
      new.failure_code := null;
      new.failure_detail := null;
    end if;
  else
    new.state_version := old.state_version;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_state_transition on public.orders;
create trigger trg_orders_state_transition
before update on public.orders
for each row execute function public.enforce_order_state_transition();

create or replace function public.log_order_state_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_state_events (
      order_id,
      from_status,
      to_status,
      from_fulfillment_status,
      to_fulfillment_status,
      state_version,
      actor_user_id,
      actor_type,
      failure_code
    )
    values (
      new.id,
      null,
      new.status,
      null,
      new.fulfillment_status,
      new.state_version,
      auth.uid(),
      case when auth.uid() is null then 'system' else 'user' end,
      new.failure_code
    );

    return new;
  end if;

  if
    new.status is distinct from old.status
    or new.fulfillment_status is distinct from old.fulfillment_status
  then
    insert into public.order_state_events (
      order_id,
      from_status,
      to_status,
      from_fulfillment_status,
      to_fulfillment_status,
      state_version,
      actor_user_id,
      actor_type,
      failure_code
    )
    values (
      new.id,
      old.status,
      new.status,
      old.fulfillment_status,
      new.fulfillment_status,
      new.state_version,
      auth.uid(),
      case when auth.uid() is null then 'system' else 'user' end,
      new.failure_code
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_state_event_insert on public.orders;
create trigger trg_orders_state_event_insert
after insert on public.orders
for each row execute function public.log_order_state_event();

drop trigger if exists trg_orders_state_event_update on public.orders;
create trigger trg_orders_state_event_update
after update on public.orders
for each row execute function public.log_order_state_event();

alter table public.order_state_events enable row level security;

revoke all on public.order_state_events from anon, authenticated;
grant select on public.order_state_events to authenticated;

create policy "order_state_events_admin_read"
on public.order_state_events
for select
to authenticated
using (public.is_admin());
