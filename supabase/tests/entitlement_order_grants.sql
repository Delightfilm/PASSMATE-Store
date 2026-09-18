-- PASSMATE order-scoped entitlement grant regression test.
-- Covers duplicate paid delivery, repurchase, refund of the later order,
-- and loss of effective access only after every successful order is refunded.
-- The DO block is atomic on failure and explicitly removes fixtures on success.

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_product_id uuid;
  v_version_id uuid;
  v_order_1 uuid;
  v_order_2 uuid;
  v_attempt_1 uuid;
  v_attempt_2 uuid;
  v_result text;
  v_total integer;
  v_active integer;
  v_revoked integer;
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entitlements'::regclass
      and conname = 'entitlements_user_id_product_id_key'
  ) then
    raise exception 'legacy entitlement uniqueness still blocks repurchase grants';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entitlements'::regclass
      and conname = 'entitlements_user_order_product_version_key'
  ) then
    raise exception 'order-scoped entitlement uniqueness is missing';
  end if;

  insert into auth.users (id, email)
  values (
    v_user_id,
    format('entitlement-order-grants-%s@example.invalid', v_user_id)
  );

  insert into public.products (
    code,
    slug,
    title,
    price_krw,
    currency,
    is_active
  )
  values (
    'TEST-ENT-GRANT',
    'test-entitlement-order-grants',
    'Entitlement Order Grant Test',
    100,
    'KRW',
    false
  )
  returning id into v_product_id;

  insert into public.product_versions (
    product_id,
    version,
    edition_year,
    status,
    published_at
  )
  values (
    v_product_id,
    'test-v1',
    2027,
    'published',
    now()
  )
  returning id into v_version_id;

  insert into public.orders (
    user_id,
    channel,
    total_amount_krw,
    currency,
    status,
    fulfillment_status
  )
  values (
    v_user_id,
    'test',
    100,
    'KRW',
    'pending',
    'not_started'
  )
  returning id into v_order_1;

  insert into public.order_items (
    order_id,
    product_id,
    product_version_id,
    quantity,
    unit_price_krw
  )
  values (v_order_1, v_product_id, v_version_id, 1, 100);

  select public.start_payment_attempt(
    v_order_1,
    'testpg',
    'entitlement-order-1',
    'entitlement-idem-1'
  )
  into v_attempt_1;

  select public.apply_payment_event(
    v_attempt_1,
    'testpg',
    'entitlement-paid-1',
    'paid',
    repeat('1', 64),
    'entitlement-payment-1',
    100,
    null,
    null
  )
  into v_result;

  if v_result <> 'paid' then
    raise exception 'first paid event returned %, expected paid', v_result;
  end if;

  select count(*), count(*) filter (where status = 'active')
  into v_total, v_active
  from public.entitlements
  where user_id = v_user_id
    and product_id = v_product_id
    and product_version_id = v_version_id;

  if v_total <> 1 or v_active <> 1 then
    raise exception 'first purchase must create exactly one active grant';
  end if;

  select public.apply_payment_event(
    v_attempt_1,
    'testpg',
    'entitlement-paid-1',
    'paid',
    repeat('1', 64),
    'entitlement-payment-1',
    100,
    null,
    null
  )
  into v_result;

  if v_result <> 'duplicate' then
    raise exception 'duplicate paid webhook returned %, expected duplicate', v_result;
  end if;

  select count(*)
  into v_total
  from public.entitlements
  where user_id = v_user_id
    and product_id = v_product_id
    and product_version_id = v_version_id;

  if v_total <> 1 then
    raise exception 'duplicate paid webhook created % grants, expected 1', v_total;
  end if;

  insert into public.orders (
    user_id,
    channel,
    total_amount_krw,
    currency,
    status,
    fulfillment_status
  )
  values (
    v_user_id,
    'test',
    100,
    'KRW',
    'pending',
    'not_started'
  )
  returning id into v_order_2;

  insert into public.order_items (
    order_id,
    product_id,
    product_version_id,
    quantity,
    unit_price_krw
  )
  values (v_order_2, v_product_id, v_version_id, 1, 100);

  select public.start_payment_attempt(
    v_order_2,
    'testpg',
    'entitlement-order-2',
    'entitlement-idem-2'
  )
  into v_attempt_2;

  select public.apply_payment_event(
    v_attempt_2,
    'testpg',
    'entitlement-paid-2',
    'paid',
    repeat('2', 64),
    'entitlement-payment-2',
    100,
    null,
    null
  )
  into v_result;

  if v_result <> 'paid' then
    raise exception 'repurchase paid event returned %, expected paid', v_result;
  end if;

  select
    count(*),
    count(*) filter (where status = 'active'),
    count(distinct source_order_id)
  into v_total, v_active, v_revoked
  from public.entitlements
  where user_id = v_user_id
    and product_id = v_product_id
    and product_version_id = v_version_id;

  if v_total <> 2 or v_active <> 2 or v_revoked <> 2 then
    raise exception
      'repurchase must preserve two active order grants (total %, active %, orders %)',
      v_total,
      v_active,
      v_revoked;
  end if;

  select public.apply_payment_event(
    v_attempt_2,
    'testpg',
    'entitlement-refund-2',
    'refunded',
    repeat('3', 64),
    'entitlement-payment-2',
    100,
    null,
    null
  )
  into v_result;

  if v_result <> 'refunded' then
    raise exception 'later-order refund returned %, expected refunded', v_result;
  end if;

  select
    count(*) filter (where status = 'active'),
    count(*) filter (where status = 'revoked')
  into v_active, v_revoked
  from public.entitlements
  where user_id = v_user_id
    and product_id = v_product_id
    and product_version_id = v_version_id;

  if v_active <> 1 or v_revoked <> 1 then
    raise exception
      'later-order refund must leave the earlier grant active (active %, revoked %)',
      v_active,
      v_revoked;
  end if;

  if not exists (
    select 1
    from public.entitlements
    where user_id = v_user_id
      and product_id = v_product_id
      and product_version_id = v_version_id
      and source_order_id = v_order_1
      and status = 'active'
  ) then
    raise exception 'earlier purchase grant was not preserved';
  end if;

  if not exists (
    select 1
    from public.entitlements
    where user_id = v_user_id
      and product_id = v_product_id
      and product_version_id = v_version_id
      and status = 'active'
  ) then
    raise exception 'effective access disappeared after refunding only the later order';
  end if;

  select public.apply_payment_event(
    v_attempt_2,
    'testpg',
    'entitlement-refund-2',
    'refunded',
    repeat('3', 64),
    'entitlement-payment-2',
    100,
    null,
    null
  )
  into v_result;

  if v_result <> 'duplicate' then
    raise exception 'duplicate refund webhook returned %, expected duplicate', v_result;
  end if;

  select public.apply_payment_event(
    v_attempt_1,
    'testpg',
    'entitlement-refund-1',
    'refunded',
    repeat('4', 64),
    'entitlement-payment-1',
    100,
    null,
    null
  )
  into v_result;

  if v_result <> 'refunded' then
    raise exception 'earlier-order refund returned %, expected refunded', v_result;
  end if;

  select
    count(*) filter (where status = 'active'),
    count(*) filter (where status = 'revoked')
  into v_active, v_revoked
  from public.entitlements
  where user_id = v_user_id
    and product_id = v_product_id
    and product_version_id = v_version_id;

  if v_active <> 0 or v_revoked <> 2 then
    raise exception
      'refund-all must revoke every order grant (active %, revoked %)',
      v_active,
      v_revoked;
  end if;

  if exists (
    select 1
    from public.entitlements
    where user_id = v_user_id
      and product_id = v_product_id
      and product_version_id = v_version_id
      and status = 'active'
  ) then
    raise exception 'effective access remained after all successful orders were refunded';
  end if;

  delete from public.orders
  where id in (v_order_1, v_order_2);

  delete from public.products
  where id = v_product_id;

  delete from auth.users
  where id = v_user_id;
end;
$$;

select 'PASSMATE order-scoped entitlement grants test passed' as result;
