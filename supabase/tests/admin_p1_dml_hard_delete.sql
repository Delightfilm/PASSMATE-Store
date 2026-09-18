-- PASSMATE Admin P1 regression verification.
-- Confirms browser-authenticated admins no longer have direct write/delete
-- paths and runtime request context cannot hard-delete protected records.

do $$
declare
  v_table text;
  v_mutation_tables text[] := array[
    'products',
    'product_versions',
    'orders',
    'order_items',
    'entitlements'
  ];
  v_protected_tables text[] := array[
    'products',
    'product_versions',
    'orders',
    'order_items',
    'payment_attempts',
    'payment_events',
    'entitlements',
    'issuance_jobs',
    'issuance_job_events',
    'order_state_events',
    'download_events',
    'admin_action_events',
    'issuance_artifacts',
    'issuance_artifact_events'
  ];
  v_policy_count integer;
  v_trigger_count integer;
  v_product_id uuid;
  v_delete_blocked boolean := false;
begin
  foreach v_table in array v_mutation_tables loop
    if has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'TRUNCATE')
    then
      raise exception 'authenticated direct mutation privilege remains on %', v_table;
    end if;
  end loop;

  select count(*)
  into v_policy_count
  from pg_policies
  where schemaname = 'public'
    and policyname in (
      'products_admin_insert',
      'products_admin_update',
      'products_admin_delete',
      'product_versions_admin_insert',
      'product_versions_admin_update',
      'product_versions_admin_delete',
      'orders_admin_insert',
      'orders_admin_update',
      'orders_admin_delete',
      'order_items_admin_insert',
      'order_items_admin_update',
      'order_items_admin_delete',
      'entitlements_admin_insert',
      'entitlements_admin_update',
      'entitlements_admin_delete'
    );

  if v_policy_count <> 0 then
    raise exception 'legacy authenticated admin mutation policies remain: %',
      v_policy_count;
  end if;

  foreach v_table in array v_protected_tables loop
    if has_table_privilege('service_role', format('public.%I', v_table), 'DELETE')
       or has_table_privilege('service_role', format('public.%I', v_table), 'TRUNCATE')
    then
      raise exception 'service_role destructive privilege remains on %', v_table;
    end if;

    select count(*)
    into v_trigger_count
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = v_table
      and not t.tgisinternal
      and t.tgname in (
        'passmate_block_runtime_delete',
        'passmate_block_runtime_truncate'
      );

    if v_trigger_count <> 2 then
      raise exception 'hard-delete triggers missing on %: %', v_table, v_trigger_count;
    end if;
  end loop;

  insert into public.products (
    code,
    slug,
    title,
    price_krw,
    currency,
    is_active
  )
  values (
    'TEST-ADMIN-P1-DELETE',
    'test-admin-p1-delete',
    'Admin P1 hard delete guard',
    1,
    'KRW',
    false
  )
  returning id into v_product_id;

  perform set_config(
    'request.jwt.claims',
    '{"role":"service_role","sub":"00000000-0000-0000-0000-000000000000"}',
    true
  );

  begin
    delete from public.products where id = v_product_id;
  exception
    when insufficient_privilege then
      v_delete_blocked := true;
  end;

  perform set_config('request.jwt.claims', '{}', true);

  if not v_delete_blocked then
    raise exception 'runtime hard delete trigger did not block service-role request context';
  end if;

  if not exists (
    select 1 from public.products where id = v_product_id
  ) then
    raise exception 'protected fixture was unexpectedly deleted';
  end if;

  delete from public.products where id = v_product_id;
end;
$$;

select 'PASSMATE admin P1 direct DML / hard-delete guard passed' as result;
