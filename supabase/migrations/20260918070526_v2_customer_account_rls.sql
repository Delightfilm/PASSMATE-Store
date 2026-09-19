-- PASSMATE V2 customer account metadata access.
-- Purchased users retain read access to product/version metadata
-- even after a product is delisted or a version is archived.

drop policy if exists "products_auth_read_active_or_admin" on public.products;

create policy "products_auth_read_active_owned_or_admin"
on public.products
for select
to authenticated
using (
  is_active = true
  or (select private.is_admin())
  or exists (
    select 1
    from public.entitlements e
    where e.product_id = products.id
      and e.user_id = (select auth.uid())
      and e.status = 'active'
  )
);

drop policy if exists "product_versions_auth_read_published_or_admin"
on public.product_versions;

create policy "product_versions_auth_read_published_owned_or_admin"
on public.product_versions
for select
to authenticated
using (
  status = 'published'
  or (select private.is_admin())
  or exists (
    select 1
    from public.entitlements e
    where e.user_id = (select auth.uid())
      and e.status = 'active'
      and (
        e.product_version_id = product_versions.id
        or (
          e.product_version_id is null
          and e.product_id = product_versions.product_id
        )
      )
  )
);

create index if not exists idx_entitlements_user_product_status
  on public.entitlements(user_id, product_id, status);

create index if not exists idx_entitlements_user_version_status
  on public.entitlements(user_id, product_version_id, status)
  where product_version_id is not null;
