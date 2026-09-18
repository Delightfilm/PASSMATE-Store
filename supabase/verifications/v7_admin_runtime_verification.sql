-- PASSMATE V7 admin foundation runtime verification.
-- Uses no real auth users and cleans all fixtures.

do $$
declare
  v_product_id uuid;
  v_version_id uuid;
  v_order_id uuid;
  v_item_id uuid;
  v_fulfillment text;
begin
  -- Random/non-admin actors must be rejected by the DB defense layer.
  begin
    perform public.admin_dashboard_summary(gen_random_uuid());
    raise exception 'expected admin summary denial';
  exception
    when insufficient_privilege then
      null;
  end;

  begin
    perform public.admin_retry_issuance_job(gen_random_uuid(), gen_random_uuid());
    raise exception 'expected admin retry denial';
  exception
    when insufficient_privilege then
      null;
  end;

  delete from public.orders o
  where exists (
    select 1
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = o.id
      and p.code = 'TEST-ADMIN-V7'
  );
  delete from public.products where code = 'TEST-ADMIN-V7';

  insert into public.products (
    code, slug, title, price_krw, currency, is_active
  )
  values (
    'TEST-ADMIN-V7',
    'test-admin-v7',
    'Admin V7 Runtime Test',
    100,
    'KRW',
    false
  )
  returning id into v_product_id;

  insert into public.product_versions (
    product_id, version, edition_year, status, published_at
  )
  values (
    v_product_id,
    'verify-v1',
    2027,
    'published',
    now()
  )
  returning id into v_version_id;

  insert into public.orders (
    status,
    fulfillment_status,
    channel,
    total_amount_krw,
    currency
  )
  values (
    'paid',
    'queued',
    'test',
    100,
    'KRW'
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

  insert into public.issuance_jobs (
    order_id,
    order_item_id,
    product_id,
    product_version_id,
    artifact_code,
    generation,
    status,
    attempt_count,
    max_attempts,
    last_error_code
  )
  values (
    v_order_id,
    v_item_id,
    v_product_id,
    v_version_id,
    'bundle',
    1,
    'dead_letter',
    5,
    5,
    'TEST_DEAD'
  );

  perform public.refresh_order_fulfillment(v_order_id);

  select fulfillment_status
  into v_fulfillment
  from public.orders
  where id = v_order_id;

  if v_fulfillment <> 'failed' then
    raise exception 'expected failed for latest dead-letter, got %', v_fulfillment;
  end if;

  update public.product_versions
  set status = 'archived'
  where id = v_version_id;

  -- A later generation must be allowed for the exact purchased archived version.
  insert into public.issuance_jobs (
    order_id,
    order_item_id,
    product_id,
    product_version_id,
    artifact_code,
    generation,
    status,
    attempt_count,
    max_attempts
  )
  values (
    v_order_id,
    v_item_id,
    v_product_id,
    v_version_id,
    'bundle',
    2,
    'queued',
    0,
    5
  );

  perform public.refresh_order_fulfillment(v_order_id);

  select fulfillment_status
  into v_fulfillment
  from public.orders
  where id = v_order_id;

  if v_fulfillment <> 'queued' then
    raise exception 'latest generation aggregate failed: %', v_fulfillment;
  end if;

  delete from public.orders where id = v_order_id;
  delete from public.products where id = v_product_id;
end;
$$;
