-- PASSMATE NAS issuance job contract smoke test
-- Run after migrations 0001 through 0004.
-- All fixtures are rolled back.

begin;

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
  v_events integer;
begin
  insert into public.products (
    code,
    slug,
    title,
    display_year,
    badge,
    features,
    price_krw,
    currency,
    is_active
  )
  values (
    'TEST-ISSUE',
    'test-issuance-job',
    'Issuance Contract Test',
    2027,
    'TEST',
    '["contract"]'::jsonb,
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
    total_amount_krw,
    status,
    fulfillment_status
  )
  values (
    100,
    'pending',
    'not_started'
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    product_id,
    product_version_id,
    quantity,
    unit_price_krw
  )
  values (
    v_order_id,
    v_product_id,
    v_version_id,
    1,
    100
  )
  returning id into v_item_id;

  begin
    perform public.enqueue_order_issuance(v_order_id);
    raise exception 'unpaid order unexpectedly enqueued';
  exception
    when check_violation then
      null;
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

  select o.fulfillment_status
  into v_fulfillment
  from public.orders o
  where o.id = v_order_id;

  if v_fulfillment <> 'queued' then
    raise exception 'expected queued fulfillment, got %', v_fulfillment;
  end if;

  select
    c.job_id,
    c.lease_token,
    c.attempt
  into
    v_job_id,
    v_lease_token,
    v_attempt
  from public.claim_issuance_job('nas-test-worker', 300) c;

  if v_job_id is null or v_lease_token is null or v_attempt <> 1 then
    raise exception 'first claim payload is invalid';
  end if;

  select o.fulfillment_status
  into v_fulfillment
  from public.orders o
  where o.id = v_order_id;

  if v_fulfillment <> 'issuing' then
    raise exception 'claim must set fulfillment to issuing';
  end if;

  if not public.renew_issuance_lease(
    v_job_id,
    v_lease_token,
    'nas-test-worker',
    300
  ) then
    raise exception 'lease heartbeat failed';
  end if;

  select public.fail_issuance_job(
    v_job_id,
    v_lease_token,
    'STORAGE_UPLOAD_FAILED',
    'test retry',
    true
  )
  into v_result;

  if v_result <> 'retry_wait' then
    raise exception 'expected retry_wait, got %', v_result;
  end if;

  -- Make retry immediately claimable for the smoke test.
  update public.issuance_jobs
  set next_attempt_at = now() - interval '1 second'
  where id = v_job_id;

  select
    c.job_id,
    c.lease_token,
    c.attempt
  into
    v_job_id,
    v_lease_token,
    v_attempt
  from public.claim_issuance_job('nas-test-worker', 300) c;

  if v_attempt <> 2 then
    raise exception 'expected attempt 2, got %', v_attempt;
  end if;

  if not public.complete_issuance_job(
    v_job_id,
    v_lease_token,
    'issued/TEST-ISSUE/test-v1/output.pdf',
    repeat('a', 64),
    1024
  ) then
    raise exception 'completion failed';
  end if;

  select o.fulfillment_status
  into v_fulfillment
  from public.orders o
  where o.id = v_order_id;

  if v_fulfillment <> 'ready' then
    raise exception 'expected ready fulfillment, got %', v_fulfillment;
  end if;

  if public.complete_issuance_job(
    v_job_id,
    v_lease_token,
    'issued/TEST-ISSUE/test-v1/output-duplicate.pdf',
    repeat('b', 64),
    2048
  ) then
    raise exception 'stale lease unexpectedly completed twice';
  end if;

  select count(*)
  into v_events
  from public.issuance_job_events e
  where e.job_id = v_job_id;

  if v_events <> 5 then
    raise exception 'expected 5 issuance job events, got %', v_events;
  end if;

  update public.orders
  set
    status = 'refunded',
    fulfillment_status = 'revoked'
  where id = v_order_id;

  select o.fulfillment_status
  into v_fulfillment
  from public.orders o
  where o.id = v_order_id;

  if v_fulfillment <> 'revoked' then
    raise exception 'refund must revoke fulfillment';
  end if;
end;
$$;

-- Multi-item aggregation: one success + one queued item must return issuing -> queued.
do $$
declare
  v_product_id uuid;
  v_version_id uuid;
  v_order_id uuid;
  v_first_job uuid;
  v_first_lease uuid;
  v_fulfillment text;
begin
  select p.id
  into v_product_id
  from public.products p
  where p.code = 'TEST-ISSUE';

  select pv.id
  into v_version_id
  from public.product_versions pv
  where
    pv.product_id = v_product_id
    and pv.version = 'test-v1';

  insert into public.orders (
    total_amount_krw,
    status,
    fulfillment_status
  )
  values (
    200,
    'pending',
    'not_started'
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    product_id,
    product_version_id,
    quantity,
    unit_price_krw
  )
  values
    (v_order_id, v_product_id, v_version_id, 1, 100),
    (v_order_id, v_product_id, v_version_id, 1, 100);

  update public.orders
  set status = 'payment_pending'
  where id = v_order_id;

  update public.orders
  set status = 'paid'
  where id = v_order_id;

  perform public.enqueue_order_issuance(v_order_id);

  select c.job_id, c.lease_token
  into v_first_job, v_first_lease
  from public.claim_issuance_job('nas-multi-worker', 300) c;

  if not public.complete_issuance_job(
    v_first_job,
    v_first_lease,
    'issued/TEST-ISSUE/test-v1/first.pdf',
    repeat('c', 64),
    100
  ) then
    raise exception 'multi-item first completion failed';
  end if;

  select o.fulfillment_status
  into v_fulfillment
  from public.orders o
  where o.id = v_order_id;

  if v_fulfillment <> 'queued' then
    raise exception
      'multi-item order must return to queued while another job waits; got %',
      v_fulfillment;
  end if;
end;
$$;

select 'PASSMATE issuance job contract test passed' as result;

rollback;
