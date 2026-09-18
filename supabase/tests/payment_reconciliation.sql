-- PASSMATE Payment P1 reconciliation convergence regression test.
-- Separate verified sources (browser sync + webhook) may report the same
-- authoritative state with different event ids; side effects must run once.

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_product_id uuid;
  v_version_id uuid;
  v_order_id uuid;
  v_attempt_id uuid;
  v_first text;
  v_second text;
  v_refund_first text;
  v_refund_second text;
  v_entitlements integer;
begin
  insert into auth.users (id, email)
  values (
    v_user_id,
    format('payment-reconcile-%s@example.invalid', v_user_id)
  );

  insert into public.products (
    code, slug, title, price_krw, currency, is_active
  )
  values (
    'TEST-PAY-RECON',
    'test-payment-reconciliation',
    'Payment Reconciliation Test',
    4321,
    'KRW',
    false
  )
  returning id into v_product_id;

  insert into public.product_versions (
    product_id, version, edition_year, status, published_at
  )
  values (
    v_product_id, 'test-v1', 2027, 'published', now()
  )
  returning id into v_version_id;

  insert into public.orders (
    user_id, status, fulfillment_status, channel, total_amount_krw, currency
  )
  values (
    v_user_id, 'pending', 'not_started', 'test', 4321, 'KRW'
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_version_id, quantity, unit_price_krw
  )
  values (
    v_order_id, v_product_id, v_version_id, 1, 4321
  );

  select public.start_payment_attempt(
    v_order_id,
    'portone_kcp',
    'pm-reconcile-test',
    'idem-reconcile-test'
  )
  into v_attempt_id;

  select public.apply_payment_event(
    v_attempt_id,
    'portone_kcp',
    'sync-event-paid',
    'paid',
    repeat('a', 64),
    'tx-reconcile-paid',
    4321,
    null,
    null
  )
  into v_first;

  select public.apply_payment_event(
    v_attempt_id,
    'portone_kcp',
    'webhook-event-paid',
    'paid',
    repeat('b', 64),
    'tx-reconcile-paid',
    4321,
    null,
    null
  )
  into v_second;

  if v_first <> 'paid' or v_second <> 'already_applied' then
    raise exception 'paid convergence failed: first %, second %', v_first, v_second;
  end if;

  select count(*)
  into v_entitlements
  from public.entitlements
  where user_id = v_user_id
    and source_order_id = v_order_id
    and status = 'active';

  if v_entitlements <> 1 then
    raise exception 'paid convergence created % active grants, expected 1', v_entitlements;
  end if;

  select public.apply_payment_event(
    v_attempt_id,
    'portone_kcp',
    'webhook-event-refund',
    'refunded',
    repeat('c', 64),
    'tx-reconcile-paid',
    4321,
    null,
    null
  )
  into v_refund_first;

  select public.apply_payment_event(
    v_attempt_id,
    'portone_kcp',
    'sync-event-refund',
    'refunded',
    repeat('d', 64),
    'tx-reconcile-paid',
    4321,
    null,
    null
  )
  into v_refund_second;

  if v_refund_first <> 'refunded' or v_refund_second <> 'already_applied' then
    raise exception 'refund convergence failed: first %, second %',
      v_refund_first, v_refund_second;
  end if;

  delete from public.orders where id = v_order_id;
  delete from public.products where id = v_product_id;
  delete from auth.users where id = v_user_id;
end;
$$;

select 'PASSMATE payment reconciliation convergence test passed' as result;
