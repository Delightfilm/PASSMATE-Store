-- PASSMATE V6 issuance registry runtime verification.

do $$
declare
  v_product_id uuid;
  v_version_id uuid;
  v_order_id uuid;
  v_item_id uuid;
  v_job1 uuid;
  v_job2 uuid;
  v_lease1 uuid := gen_random_uuid();
  v_lease2 uuid := gen_random_uuid();
  v_artifact1 uuid;
  v_artifact2 uuid;
  v_status text;
begin
  delete from public.orders o
  where exists (
    select 1
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = o.id
      and p.code = 'TEST-V6-REGISTRY'
  );
  delete from public.products where code = 'TEST-V6-REGISTRY';

  insert into public.products (
    code, slug, title, price_krw, currency, is_active
  )
  values (
    'TEST-V6-REGISTRY',
    'test-v6-registry',
    'V6 Registry Runtime Test',
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
    lease_token,
    lease_owner,
    lease_expires_at
  )
  values (
    v_order_id,
    v_item_id,
    v_product_id,
    v_version_id,
    'bundle',
    1,
    'leased',
    1,
    5,
    v_lease1,
    'verify-v6',
    now() + interval '5 minutes'
  )
  returning id into v_job1;

  if not public.complete_issuance_job(
    v_job1,
    v_lease1,
    'issued/TEST-V6-REGISTRY/verify-v1/order/g1.pdf',
    repeat('a',64),
    1000
  ) then
    raise exception 'generation 1 completion failed';
  end if;

  select id, lifecycle_status
  into v_artifact1, v_status
  from public.issuance_artifacts
  where issuance_job_id = v_job1;

  if v_artifact1 is null or v_status <> 'active' then
    raise exception 'generation 1 registry failed';
  end if;

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
    lease_token,
    lease_owner,
    lease_expires_at
  )
  values (
    v_order_id,
    v_item_id,
    v_product_id,
    v_version_id,
    'bundle',
    2,
    'leased',
    1,
    5,
    v_lease2,
    'verify-v6',
    now() + interval '5 minutes'
  )
  returning id into v_job2;

  if not public.complete_issuance_job(
    v_job2,
    v_lease2,
    'issued/TEST-V6-REGISTRY/verify-v1/order/g2.pdf',
    repeat('b',64),
    1100
  ) then
    raise exception 'generation 2 completion failed';
  end if;

  select lifecycle_status
  into v_status
  from public.issuance_artifacts
  where id = v_artifact1;

  if v_status <> 'superseded' then
    raise exception 'generation 1 was not superseded';
  end if;

  select id, lifecycle_status
  into v_artifact2, v_status
  from public.issuance_artifacts
  where issuance_job_id = v_job2;

  if v_artifact2 is null or v_status <> 'active' then
    raise exception 'generation 2 registry failed';
  end if;

  update public.orders
  set
    status = 'refunded',
    fulfillment_status = 'revoked'
  where id = v_order_id;

  if exists (
    select 1
    from public.issuance_artifacts
    where order_id = v_order_id
      and lifecycle_status <> 'revoked'
  ) then
    raise exception 'refund did not revoke all artifacts';
  end if;

  if (
    select count(*)
    from public.issuance_artifact_events
    where artifact_id in (v_artifact1, v_artifact2)
  ) < 4 then
    raise exception 'artifact audit events missing';
  end if;

  begin
    perform public.admin_list_issuance_artifacts(gen_random_uuid(), 10);
    raise exception 'expected non-admin registry denial';
  exception
    when insufficient_privilege then
      null;
  end;

  delete from public.orders where id = v_order_id;
  delete from public.products where id = v_product_id;
end;
$$;
