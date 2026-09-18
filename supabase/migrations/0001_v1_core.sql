-- PASSMATE V1 core schema
-- Customer-facing app data only. Internal issuance infrastructure is added in later versions.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  slug text not null unique,
  title text not null,
  subtitle text,
  description text,
  price_krw integer not null check (price_krw >= 0),
  currency text not null default 'KRW',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  version text not null,
  edition_year integer,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique(product_id, version)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'refunded', 'failed')),
  channel text not null default 'direct',
  total_amount_krw integer not null default 0 check (total_amount_krw >= 0),
  currency text not null default 'KRW',
  payment_provider text,
  provider_order_id text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_version_id uuid references public.product_versions(id),
  quantity integer not null default 1 check (quantity > 0),
  unit_price_krw integer not null check (unit_price_krw >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  product_version_id uuid references public.product_versions(id),
  source_order_id uuid references public.orders(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(user_id, product_id)
);

create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_entitlements_user_id on public.entitlements(user_id);
create index if not exists idx_product_versions_product_id on public.product_versions(product_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_versions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.entitlements enable row level security;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "products_public_read_active"
on public.products for select
to anon, authenticated
using (is_active = true or public.is_admin());

create policy "products_admin_all"
on public.products for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "product_versions_public_read_published"
on public.product_versions for select
to anon, authenticated
using (status = 'published' or public.is_admin());

create policy "product_versions_admin_all"
on public.product_versions for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "orders_select_own"
on public.orders for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "orders_admin_all"
on public.orders for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "order_items_select_own"
on public.order_items for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_id
      and (o.user_id = auth.uid() or public.is_admin())
  )
);

create policy "order_items_admin_all"
on public.order_items for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "entitlements_select_own"
on public.entitlements for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "entitlements_admin_all"
on public.entitlements for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


-- Explicit API privileges
-- Keep customer-visible reads narrow and prevent privilege escalation through profiles.role.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

revoke all on public.product_versions from anon, authenticated;
grant select on public.product_versions to anon, authenticated;
grant insert, update, delete on public.product_versions to authenticated;

revoke all on public.orders from anon, authenticated;
grant select, insert, update, delete on public.orders to authenticated;

revoke all on public.order_items from anon, authenticated;
grant select, insert, update, delete on public.order_items to authenticated;

revoke all on public.entitlements from anon, authenticated;
grant select, insert, update, delete on public.entitlements to authenticated;

-- role changes are intentionally server-side/service-role only.
