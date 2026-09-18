-- PASSMATE security/performance hardening
-- Applies Supabase advisor findings after V1/V1.5 schema creation.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

alter function public.set_updated_at() set search_path = '';

-- Replace overlapping policies with one SELECT policy per client role/action.
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.is_admin())
);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "products_public_read_active" on public.products;
drop policy if exists "products_admin_all" on public.products;

create policy "products_anon_read_active"
on public.products
for select
to anon
using (is_active = true);

create policy "products_auth_read_active_or_admin"
on public.products
for select
to authenticated
using (
  is_active = true
  or (select private.is_admin())
);

create policy "products_admin_insert"
on public.products
for insert
to authenticated
with check ((select private.is_admin()));

create policy "products_admin_update"
on public.products
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "products_admin_delete"
on public.products
for delete
to authenticated
using ((select private.is_admin()));

drop policy if exists "product_versions_public_read_published" on public.product_versions;
drop policy if exists "product_versions_admin_all" on public.product_versions;

create policy "product_versions_anon_read_published"
on public.product_versions
for select
to anon
using (status = 'published');

create policy "product_versions_auth_read_published_or_admin"
on public.product_versions
for select
to authenticated
using (
  status = 'published'
  or (select private.is_admin())
);

create policy "product_versions_admin_insert"
on public.product_versions
for insert
to authenticated
with check ((select private.is_admin()));

create policy "product_versions_admin_update"
on public.product_versions
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "product_versions_admin_delete"
on public.product_versions
for delete
to authenticated
using ((select private.is_admin()));

drop policy if exists "orders_select_own" on public.orders;
drop policy if exists "orders_admin_all" on public.orders;

create policy "orders_select_own_or_admin"
on public.orders
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
);

create policy "orders_admin_insert"
on public.orders
for insert
to authenticated
with check ((select private.is_admin()));

create policy "orders_admin_update"
on public.orders
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "orders_admin_delete"
on public.orders
for delete
to authenticated
using ((select private.is_admin()));

drop policy if exists "order_items_select_own" on public.order_items;
drop policy if exists "order_items_admin_all" on public.order_items;

create policy "order_items_select_own_or_admin"
on public.order_items
for select
to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1
    from public.orders o
    where o.id = order_id
      and o.user_id = (select auth.uid())
  )
);

create policy "order_items_admin_insert"
on public.order_items
for insert
to authenticated
with check ((select private.is_admin()));

create policy "order_items_admin_update"
on public.order_items
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "order_items_admin_delete"
on public.order_items
for delete
to authenticated
using ((select private.is_admin()));

drop policy if exists "entitlements_select_own" on public.entitlements;
drop policy if exists "entitlements_admin_all" on public.entitlements;

create policy "entitlements_select_own_or_admin"
on public.entitlements
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
);

create policy "entitlements_admin_insert"
on public.entitlements
for insert
to authenticated
with check ((select private.is_admin()));

create policy "entitlements_admin_update"
on public.entitlements
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "entitlements_admin_delete"
on public.entitlements
for delete
to authenticated
using ((select private.is_admin()));

-- Queue tables are server-only. Keep explicit deny policies for client roles.
drop policy if exists "issuance_jobs_client_deny" on public.issuance_jobs;
create policy "issuance_jobs_client_deny"
on public.issuance_jobs
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "issuance_job_events_client_deny" on public.issuance_job_events;
create policy "issuance_job_events_client_deny"
on public.issuance_job_events
for all
to anon, authenticated
using (false)
with check (false);

-- Supabase grants function EXECUTE to API roles by default.
-- Remove direct RPC access from all trigger/internal helpers.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_order_state_event() from public, anon, authenticated;
revoke execute on function public.log_issuance_job_event() from public, anon, authenticated;
revoke execute on function public.cancel_issuance_jobs_on_refund() from public, anon, authenticated;
revoke execute on function public.refresh_order_fulfillment(uuid) from public, anon, authenticated;
revoke execute on function public.enforce_order_state_transition() from public, anon, authenticated;
revoke execute on function public.enforce_issuance_job_transition() from public, anon, authenticated;
revoke execute on function public.validate_issuance_job_identity() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Worker RPC surface: service-role only.
revoke execute on function public.enqueue_order_issuance(uuid) from public, anon, authenticated;
revoke execute on function public.claim_issuance_job(text, integer) from public, anon, authenticated;
revoke execute on function public.renew_issuance_lease(uuid, uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.complete_issuance_job(uuid, uuid, text, text, bigint) from public, anon, authenticated;
revoke execute on function public.fail_issuance_job(uuid, uuid, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.reap_expired_issuance_jobs() from public, anon, authenticated;

grant execute on function public.enqueue_order_issuance(uuid) to service_role;
grant execute on function public.claim_issuance_job(text, integer) to service_role;
grant execute on function public.renew_issuance_lease(uuid, uuid, text, integer) to service_role;
grant execute on function public.complete_issuance_job(uuid, uuid, text, text, bigint) to service_role;
grant execute on function public.fail_issuance_job(uuid, uuid, text, text, boolean) to service_role;
grant execute on function public.reap_expired_issuance_jobs() to service_role;

-- public.is_admin is superseded by private.is_admin.
drop function if exists public.is_admin();

-- Cover foreign keys reported by the advisor.
create index if not exists idx_order_items_product_id
  on public.order_items(product_id);
create index if not exists idx_order_items_product_version_id
  on public.order_items(product_version_id);
create index if not exists idx_entitlements_product_id
  on public.entitlements(product_id);
create index if not exists idx_entitlements_product_version_id
  on public.entitlements(product_version_id);
create index if not exists idx_entitlements_source_order_id
  on public.entitlements(source_order_id);
create index if not exists idx_issuance_jobs_product_id
  on public.issuance_jobs(product_id);
create index if not exists idx_issuance_jobs_product_version_id
  on public.issuance_jobs(product_version_id);
create index if not exists idx_order_state_events_actor_user_id
  on public.order_state_events(actor_user_id);
