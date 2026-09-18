-- PASSMATE V1 schema smoke test
-- Run after 0001_v1_core.sql and 0002_seed_catalog.sql.

do $$
declare
  missing text[];
begin
  select array_agg(name)
  into missing
  from (
    values
      ('profiles'),
      ('products'),
      ('product_versions'),
      ('orders'),
      ('order_items'),
      ('entitlements')
  ) as expected(name)
  where to_regclass('public.' || name) is null;

  if missing is not null then
    raise exception 'Missing PASSMATE V1 tables: %', missing;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from public.products
    where code = 'PM-C2'
      and slug = 'computer-literacy-2'
      and price_krw = 6900
      and is_active = true
  ) then
    raise exception 'PM-C2 seed product is missing or invalid';
  end if;

  if not exists (
    select 1
    from public.product_versions pv
    join public.products p on p.id = pv.product_id
    where p.code = 'PM-C2'
      and pv.version = '2027-v1.0'
      and pv.status = 'draft'
  ) then
    raise exception 'PM-C2 draft version is missing or invalid';
  end if;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'products',
    'product_versions',
    'orders',
    'order_items',
    'entitlements'
  ]
  loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = table_name
        and c.relrowsecurity = true
    ) then
      raise exception 'RLS is not enabled on public.%', table_name;
    end if;
  end loop;
end;
$$;

select 'PASSMATE V1 smoke test passed' as result;
