-- PASSMATE Admin P1: remove browser-admin direct mutation paths and
-- prevent runtime API hard-delete/truncate of commercial, financial, and
-- issuance records. Maintenance migrations executed outside an API request
-- remain able to clean fixtures deliberately.

-- Admins keep read access through existing SELECT policies and perform
-- mutations only through audited service-role RPC/Edge Function paths.
drop policy if exists "products_admin_insert" on public.products;
drop policy if exists "products_admin_update" on public.products;
drop policy if exists "products_admin_delete" on public.products;

drop policy if exists "product_versions_admin_insert" on public.product_versions;
drop policy if exists "product_versions_admin_update" on public.product_versions;
drop policy if exists "product_versions_admin_delete" on public.product_versions;

drop policy if exists "orders_admin_insert" on public.orders;
drop policy if exists "orders_admin_update" on public.orders;
drop policy if exists "orders_admin_delete" on public.orders;

drop policy if exists "order_items_admin_insert" on public.order_items;
drop policy if exists "order_items_admin_update" on public.order_items;
drop policy if exists "order_items_admin_delete" on public.order_items;

drop policy if exists "entitlements_admin_insert" on public.entitlements;
drop policy if exists "entitlements_admin_update" on public.entitlements;
drop policy if exists "entitlements_admin_delete" on public.entitlements;

revoke insert, update, delete, truncate
  on public.products, public.product_versions, public.orders,
     public.order_items, public.entitlements
  from anon, authenticated;

-- service_role may still INSERT/UPDATE where runtime processors require it,
-- but destructive removal is never part of a normal API workflow.
revoke delete, truncate
  on public.products,
     public.product_versions,
     public.orders,
     public.order_items,
     public.payment_attempts,
     public.payment_events,
     public.entitlements,
     public.issuance_jobs,
     public.issuance_job_events,
     public.order_state_events,
     public.download_events,
     public.admin_action_events,
     public.issuance_artifacts,
     public.issuance_artifact_events
  from service_role;

create or replace function private.reject_runtime_hard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_request_role text;
  v_claims_text text;
begin
  v_request_role := nullif(
    current_setting('request.jwt.claim.role', true),
    ''
  );

  if v_request_role is null then
    v_claims_text := nullif(
      current_setting('request.jwt.claims', true),
      ''
    );

    if v_claims_text is not null then
      begin
        v_request_role := (v_claims_text::jsonb)->>'role';
      exception
        when others then
          v_request_role := null;
      end;
    end if;
  end if;

  if current_user in ('anon', 'authenticated', 'service_role', 'authenticator')
     or v_request_role in ('anon', 'authenticated', 'service_role') then
    raise exception 'runtime hard delete is disabled for %.%',
      tg_table_schema,
      tg_table_name
      using errcode = 'insufficient_privilege';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return null;
end;
$$;

revoke all on function private.reject_runtime_hard_delete() from public;

do $$
declare
  v_table text;
  v_tables text[] := array[
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
begin
  foreach v_table in array v_tables loop
    execute format(
      'drop trigger if exists %I on public.%I',
      'passmate_block_runtime_delete',
      v_table
    );
    execute format(
      'create trigger %I before delete on public.%I for each row execute function private.reject_runtime_hard_delete()',
      'passmate_block_runtime_delete',
      v_table
    );

    execute format(
      'drop trigger if exists %I on public.%I',
      'passmate_block_runtime_truncate',
      v_table
    );
    execute format(
      'create trigger %I before truncate on public.%I for each statement execute function private.reject_runtime_hard_delete()',
      'passmate_block_runtime_truncate',
      v_table
    );
  end loop;
end;
$$;
