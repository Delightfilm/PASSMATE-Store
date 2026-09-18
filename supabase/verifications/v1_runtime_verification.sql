-- PASSMATE V1/V1.5 runtime contract verification
-- Intended for one-time environment verification. Creates temporary fixtures
-- in normal tables, asserts state-machine/issuance behavior, then removes them.

do $$
declare
  v_product_id uuid;
  v_version_id uuid;
  v_order_id uuid;
  v_item_id uuid;
  v_enqueued integer;
  v_job_id uuid;
  v_lease_token uuid;
  v_attempt integer;
  v_result text;
  v_fulfillment text;
begin
  -- Best-effort cleanup from an interrupted prior verification.
  delete from public.orders o
  where exists (
    select 1
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = o.id
      and p.code = 'TEST-RUNTIME-VERIFY'
  );

  delete from public.products
  where code = 'TEST-RUNTIME-VERIFY';

  insert into public.products (
    code, slug, title, display_year, badge, features,
    price_krw, currency, is_active
  )
  values (
    'TEST-RUNTIME-VERIFY',
    'test-runtime-verify',
    'Runtime Contract Verification',
    2027,
    'TEST',
    '["runtime-contract"]'::jsonb,
    100,
    'KRW',
    false
  )
  returning id into v_product_id;

  insert into public.product_versions (
    product_id, version, edition_year, status, published_at
  )
  values (
    v_product_id, 'verify-v1', 2027, 'published', now()
  )
  returning id into v_version_id;

  insert into public.orders (
    total_amount_krw, status, fulfillment_status
  )
  values (100, 'pending', 'not_started')
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_version_id, quantity, unit_price_krw
  )
  values (
    v_order_id, v_product_id, v_version_id, 1, 100
  )
  returning id into v_item_id;

  begin
    perform public.enqueue_order_issuance(v_order_id);
    raise exception 'unpaid order unexpectedly enqueued';
  exception
    when check_violation then null;
  end;

  update public.orders
  set status = 'payment_pending'
  where id = v_order_id;

  update public.orders
  set status = 'paid'
  where id = v_order_id;

  select public.enqueue_order_issuance(v_order_id)
  into v_enqueued;

  if v_enqueued <> 1 then
    raise exception 'expected one issuance job, got %', v_enqueued;
  end if;

  select public.enqueue_order_issuance(v_order_id)
  into v_enqueued;

  if v_enqueued <> 0 then
    raise exception 'duplicate enqueue must be idempotent';
  end if;

  select fulfillment_status
  into v_fulfillment
  from public.orders
  where id = v_order_id;

  if v_fulfillment <> 'queued' then
    raise exception 'expected queued fulfillment, got %', v_fulfillment;
  end if;

  select c.job_id, c.lease_token, c.attempt
  into v_job_id, v_lease_token, v_attempt
  from public.claim_issuance_job('runtime-verifier', 300) c;

  if v_job_id is null or v_lease_token is null or v_attempt <> 1 then
    raise exception 'first claim payload invalid';
  end if;

  select fulfillment_status
  into v_fulfillment
  from public.orders
  where id = v_order_id;

  if v_fulfillment <> 'issuing' then
    raise exception 'claim must set fulfillment to issuing';
  end if;

  if not public.renew_issuance_lease(
    v_job_id, v_lease_token, 'runtime-verifier', 300
  ) then
    raise exception 'lease heartbeat failed';
  end if;

  select public.fail_issuance_job(
    v_job_id,
    v_lease_token,
    'STORAGE_UPLOAD_FAILED',
    'runtime verification retry',
    true
  )
  into v_result;

  if v_result <> 'retry_wait' then
    raise exception 'expected retry_wait, got %', v_result;
  end if;

  update public.issuance_jobs
  set next_attempt_at = now() - interval '1 second'
  where id = v_job_id;

  select c.job_id, c.lease_token, c.attempt
  into v_job_id, v_lease_token, v_attempt
  from public.claim_issuance_job('runtime-verifier', 300) c;

  if v_attempt <> 2 then
    raise exception 'expected attempt 2, got %', v_attempt;
  end if;

  if not public.complete_issuance_job(
    v_job_id,
    v_lease_token,
    'issued/TEST-RUNTIME-VERIFY/verify-v1/output.pdf',
    repeat('a', 64),
    1024
  ) then
    raise exception 'completion failed';
  end if;

  select fulfillment_status
  into v_fulfillment
  from public.orders
  where id = v_order_id;

  if v_fulfillment <> 'ready' then
    raise exception 'expected ready fulfillment, got %', v_fulfillment;
  end if;

  if public.complete_issuance_job(
    v_job_id,
    v_lease_token,
    'issued/TEST-RUNTIME-VERIFY/verify-v1/duplicate.pdf',
    repeat('b', 64),
    2048
  ) then
    raise exception 'stale lease unexpectedly completed twice';
  end if;

  begin
    update public.orders
    set status = 'cancelled'
    where id = v_order_id;
    raise exception 'paid -> cancelled unexpectedly succeeded';
  exception
    when check_violation then null;
  end;

  update public.orders
  set status = 'refunded',
      fulfillment_status = 'revoked'
  where id = v_order_id;

  if not exists (
    select 1 from public.orders
    where id = v_order_id
      and status = 'refunded'
      and fulfillment_status = 'revoked'
  ) then
    raise exception 'refund invariant failed';
  end if;

  -- Cleanup verification fixtures.
  delete from public.orders where id = v_order_id;
  delete from public.products where id = v_product_id;
end;
$$;
