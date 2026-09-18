-- PASSMATE order-scoped entitlement grant runtime verification.
-- Read-only: validates the migrated schema and all existing source-order grants.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entitlements'::regclass
      and conname = 'entitlements_user_id_product_id_key'
  ) then
    raise exception 'legacy (user_id, product_id) entitlement uniqueness remains';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entitlements'::regclass
      and conname = 'entitlements_user_order_product_version_key'
  ) then
    raise exception 'order-scoped entitlement uniqueness is missing';
  end if;

  if exists (
    select 1
    from public.entitlements e
    where e.source_order_id is not null
      and e.product_version_id is not null
    group by
      e.user_id,
      e.source_order_id,
      e.product_id,
      e.product_version_id
    having count(*) > 1
  ) then
    raise exception 'duplicate order-scoped entitlement grants exist';
  end if;

  if exists (
    select 1
    from public.orders o
    join (
      select distinct order_id, product_id, product_version_id
      from public.order_items
      where product_version_id is not null
    ) oi
      on oi.order_id = o.id
    where o.user_id is not null
      and o.status = 'paid'
      and not exists (
        select 1
        from public.entitlements e
        where e.user_id = o.user_id
          and e.source_order_id = o.id
          and e.product_id = oi.product_id
          and e.product_version_id = oi.product_version_id
          and e.status = 'active'
      )
  ) then
    raise exception 'a paid order is missing its active historical entitlement grant';
  end if;

  if exists (
    select 1
    from public.entitlements e
    join public.orders o on o.id = e.source_order_id
    where o.status = 'refunded'
      and e.status <> 'revoked'
  ) then
    raise exception 'a refunded order still has a non-revoked entitlement grant';
  end if;

  if exists (
    select 1
    from public.entitlements e
    join public.orders o on o.id = e.source_order_id
    where o.user_id is distinct from e.user_id
  ) then
    raise exception 'an entitlement user does not match its source order user';
  end if;

  if exists (
    select 1
    from public.entitlements e
    join public.product_versions pv on pv.id = e.product_version_id
    where pv.product_id <> e.product_id
  ) then
    raise exception 'an entitlement product version belongs to another product';
  end if;
end;
$$;

select 'PASSMATE order-scoped entitlement runtime verification passed' as result;
