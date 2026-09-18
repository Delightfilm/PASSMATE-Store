-- PASSMATE V3 provider-neutral payment runtime verification.
-- Fixtures are removed before completion.

do $$
declare
  v_product_id uuid;
  v_version_id uuid;
  v_order_id uuid;
  v_attempt_id uuid;
  v_attempt_again uuid;
  v_result text;
  v_status text;
  v_fulfillment text;
begin
  delete from public.orders o
  where exists (
    select 1
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = o.id and p.code = 'TEST-PAYMENT'
  );
  delete from public.products where code = 'TEST-PAYMENT';

  insert into public.products (
    code, slug, title, price_krw, currency, is_active
  )
  values (
    'TEST-PAYMENT','test-payment-contract','Payment Contract Test',100,'KRW',false
  )
  returning id into v_product_id;

  insert into public.product_versions (
    product_id, version, edition_year, status, published_at
  )
  values (v_product_id,'verify-v1',2027,'published',now())
  returning id into v_version_id;

  insert into public.orders (
    channel, total_amount_krw, currency, status, fulfillment_status
  )
  values ('test',100,'KRW','pending','not_started')
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_version_id, quantity, unit_price_krw
  )
  values (v_order_id,v_product_id,v_version_id,1,100);

  select public.start_payment_attempt(
    v_order_id,'testpg','merchant-paid-1','idem-paid-1'
  ) into v_attempt_id;

  select public.start_payment_attempt(
    v_order_id,'testpg','merchant-paid-1','idem-paid-1'
  ) into v_attempt_again;

  if v_attempt_again <> v_attempt_id then
    raise exception 'idempotent start returned different attempt';
  end if;

  select public.apply_payment_event(
    v_attempt_id,
    'testpg',
    'evt-paid-1',
    'paid',
    repeat('a',64),
    'provider-payment-1',
    100,
    null,
    null
  ) into v_result;

  if v_result <> 'paid' then
    raise exception 'expected paid, got %', v_result;
  end if;

  select status, fulfillment_status
  into v_status, v_fulfillment
  from public.orders
  where id = v_order_id;

  if v_status <> 'paid' or v_fulfillment <> 'queued' then
    raise exception 'paid order/queue invariant failed: %, %', v_status, v_fulfillment;
  end if;

  select public.apply_payment_event(
    v_attempt_id,
    'testpg',
    'evt-paid-1',
    'paid',
    repeat('a',64),
    'provider-payment-1',
    100,
    null,
    null
  ) into v_result;

  if v_result <> 'duplicate' then
    raise exception 'duplicate event was not ignored';
  end if;

  select public.apply_payment_event(
    v_attempt_id,
    'testpg',
    'evt-refund-1',
    'refunded',
    repeat('b',64),
    'provider-payment-1',
    100,
    null,
    null
  ) into v_result;

  if v_result <> 'refunded' then
    raise exception 'expected refunded, got %', v_result;
  end if;

  select status, fulfillment_status
  into v_status, v_fulfillment
  from public.orders
  where id = v_order_id;

  if v_status <> 'refunded' or v_fulfillment <> 'revoked' then
    raise exception 'refund invariant failed';
  end if;

  delete from public.orders where id = v_order_id;

  insert into public.orders (
    channel, total_amount_krw, currency, status, fulfillment_status
  )
  values ('test',100,'KRW','pending','not_started')
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_version_id, quantity, unit_price_krw
  )
  values (v_order_id,v_product_id,v_version_id,1,100);

  select public.start_payment_attempt(
    v_order_id,'testpg','merchant-fail-1','idem-fail-1'
  ) into v_attempt_id;

  select public.apply_payment_event(
    v_attempt_id,
    'testpg',
    'evt-fail-1',
    'failed',
    repeat('c',64),
    null,
    null,
    'DECLINED',
    'runtime verification'
  ) into v_result;

  if v_result <> 'failed' then
    raise exception 'expected failed, got %', v_result;
  end if;

  select status into v_status from public.orders where id = v_order_id;
  if v_status <> 'failed' then
    raise exception 'failed order invariant failed';
  end if;

  select public.start_payment_attempt(
    v_order_id,'testpg','merchant-cancel-2','idem-cancel-2'
  ) into v_attempt_id;

  select public.apply_payment_event(
    v_attempt_id,
    'testpg',
    'evt-cancel-2',
    'cancelled',
    repeat('d',64),
    null,
    null,
    null,
    null
  ) into v_result;

  if v_result <> 'cancelled' then
    raise exception 'expected cancelled, got %', v_result;
  end if;

  select status into v_status from public.orders where id = v_order_id;
  if v_status <> 'cancelled' then
    raise exception 'cancelled order invariant failed';
  end if;

  delete from public.orders where id = v_order_id;
  delete from public.products where id = v_product_id;
end;
$$;
