-- PASSMATE order state machine smoke test
-- Run after migrations 0001, 0002, and 0003.
-- This test rolls back all temporary rows.

begin;

do $$
declare
  v_order_id uuid;
  v_version integer;
  v_event_count integer;
begin
  insert into public.orders (
    total_amount_krw,
    status,
    fulfillment_status
  )
  values (
    6900,
    'pending',
    'not_started'
  )
  returning id, state_version into v_order_id, v_version;

  if v_version <> 0 then
    raise exception 'initial state_version must be 0';
  end if;

  update public.orders
  set status = 'payment_pending'
  where id = v_order_id;

  update public.orders
  set status = 'paid'
  where id = v_order_id;

  update public.orders
  set fulfillment_status = 'queued'
  where id = v_order_id;

  update public.orders
  set fulfillment_status = 'issuing'
  where id = v_order_id;

  update public.orders
  set fulfillment_status = 'ready'
  where id = v_order_id;

  select state_version
  into v_version
  from public.orders
  where id = v_order_id;

  if v_version <> 5 then
    raise exception 'expected state_version 5, got %', v_version;
  end if;

  begin
    update public.orders
    set status = 'cancelled'
    where id = v_order_id;

    raise exception 'paid -> cancelled unexpectedly succeeded';
  exception
    when check_violation then
      null;
  end;

  update public.orders
  set
    status = 'refunded',
    fulfillment_status = 'revoked'
  where id = v_order_id;

  select count(*)
  into v_event_count
  from public.order_state_events
  where order_id = v_order_id;

  if v_event_count <> 7 then
    raise exception 'expected 7 state events, got %', v_event_count;
  end if;

  begin
    update public.orders
    set status = 'paid'
    where id = v_order_id;

    raise exception 'refunded -> paid unexpectedly succeeded';
  exception
    when check_violation then
      null;
  end;
end;
$$;

do $$
declare
  v_order_id uuid;
begin
  insert into public.orders (
    total_amount_krw,
    status,
    fulfillment_status
  )
  values (
    6900,
    'pending',
    'not_started'
  )
  returning id into v_order_id;

  begin
    update public.orders
    set fulfillment_status = 'queued'
    where id = v_order_id;

    raise exception 'unpaid fulfillment unexpectedly started';
  exception
    when check_violation then
      null;
  end;

  update public.orders
  set status = 'payment_pending'
  where id = v_order_id;

  update public.orders
  set
    status = 'failed',
    failure_code = 'PAYMENT_DECLINED'
  where id = v_order_id;

  update public.orders
  set status = 'payment_pending'
  where id = v_order_id;

  if exists (
    select 1
    from public.orders
    where id = v_order_id
      and fulfillment_status <> 'not_started'
  ) then
    raise exception 'payment retry must not start fulfillment';
  end if;
end;
$$;

select 'PASSMATE order state machine test passed' as result;

rollback;
