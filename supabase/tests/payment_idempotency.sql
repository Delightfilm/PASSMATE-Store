-- PASSMATE Payment P1-1 idempotent checkout regression test.
-- Replaying the same provider/idempotency key with a different proposed
-- merchant order id must return the original order/payment attempt.

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_other_user_id uuid := gen_random_uuid();
  v_product_id uuid;
  v_first record;
  v_second record;
  v_attempt public.payment_attempts%rowtype;
  v_order_count integer;
  v_attempt_count integer;
  v_cross_user_blocked boolean := false;
begin
  insert into auth.users (id, email)
  values
    (v_user_id, format('payment-idem-%s@example.invalid', v_user_id)),
    (v_other_user_id, format('payment-idem-other-%s@example.invalid', v_other_user_id));

  insert into public.products (
    code, slug, title, price_krw, currency, is_active
  )
  values (
    'TEST-PAY-IDEM',
    'test-payment-idempotency',
    'Payment Idempotency Test',
    3210,
    'KRW',
    true
  )
  returning id into v_product_id;

  insert into public.product_versions (
    product_id, version, edition_year, status, published_at
  )
  values (
    v_product_id, 'test-v1', 2027, 'published', now()
  );

  select *
  into v_first
  from public.create_direct_checkout(
    v_user_id,
    'test-payment-idempotency',
    'portone_kcp',
    'pm-idem-original',
    'idem-replay-key'
  );

  select *
  into v_second
  from public.create_direct_checkout(
    v_user_id,
    'test-payment-idempotency',
    'portone_kcp',
    'pm-idem-should-not-replace',
    'idem-replay-key'
  );

  if v_first.order_id is distinct from v_second.order_id
     or v_first.payment_attempt_id is distinct from v_second.payment_attempt_id
     or v_first.amount_krw is distinct from v_second.amount_krw then
    raise exception 'idempotent replay did not return original checkout';
  end if;

  select *
  into v_attempt
  from public.payment_attempts
  where id = v_first.payment_attempt_id;

  if v_attempt.merchant_order_id <> 'pm-idem-original' then
    raise exception 'replay replaced persisted payment id: %', v_attempt.merchant_order_id;
  end if;

  select count(*)
  into v_order_count
  from public.orders
  where user_id = v_user_id
    and channel = 'direct';

  select count(*)
  into v_attempt_count
  from public.payment_attempts
  where provider = 'portone_kcp'
    and idempotency_key = 'idem-replay-key';

  if v_order_count <> 1 or v_attempt_count <> 1 then
    raise exception 'replay created duplicates (orders %, attempts %)',
      v_order_count, v_attempt_count;
  end if;

  begin
    perform *
    from public.create_direct_checkout(
      v_other_user_id,
      'test-payment-idempotency',
      'portone_kcp',
      'pm-cross-user',
      'idem-replay-key'
    );
  exception
    when unique_violation then
      v_cross_user_blocked := true;
  end;

  if not v_cross_user_blocked then
    raise exception 'cross-user idempotency key reuse was not rejected';
  end if;

  delete from public.orders where id = v_first.order_id;
  delete from public.products where id = v_product_id;
  delete from auth.users where id in (v_user_id, v_other_user_id);
end;
$$;

select 'PASSMATE payment idempotency test passed' as result;
