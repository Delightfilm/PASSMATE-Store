-- PASSMATE Payment P1-1: end-to-end idempotent direct checkout.
-- Replaying the same provider + idempotency key returns the original order/payment attempt.
-- A transaction-scoped advisory lock closes concurrent duplicate-create races.

create or replace function public.create_direct_checkout(
  p_user_id uuid,
  p_product_slug text,
  p_provider text,
  p_merchant_order_id text,
  p_idempotency_key text
)
returns table (
  order_id uuid,
  payment_attempt_id uuid,
  amount_krw integer,
  product_code text,
  product_title text,
  product_version text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_version public.product_versions%rowtype;
  v_order public.orders%rowtype;
  v_attempt public.payment_attempts%rowtype;
  v_order_id uuid;
  v_attempt_id uuid;
begin
  if p_user_id is null or not exists (
    select 1 from auth.users u where u.id = p_user_id
  ) then
    raise exception 'authenticated user not found'
      using errcode = 'check_violation';
  end if;

  if p_product_slug is null or length(p_product_slug) not between 1 and 160 then
    raise exception 'invalid product slug'
      using errcode = 'check_violation';
  end if;

  if p_provider is null or p_provider !~ '^[a-z0-9_-]{2,32}$' then
    raise exception 'invalid payment provider'
      using errcode = 'check_violation';
  end if;

  if p_merchant_order_id is null or length(p_merchant_order_id) not between 1 and 128 then
    raise exception 'invalid merchant order id'
      using errcode = 'check_violation';
  end if;

  if p_idempotency_key is null or length(p_idempotency_key) not between 1 and 128 then
    raise exception 'invalid payment idempotency key'
      using errcode = 'check_violation';
  end if;

  -- Serialize the logical checkout request so two concurrent HTTP retries
  -- cannot both create an order before the unique constraint becomes visible.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'passmate:checkout:' || p_provider || ':' || p_idempotency_key,
      0
    )
  );

  select pa.*
  into v_attempt
  from public.payment_attempts pa
  where pa.provider = p_provider
    and pa.idempotency_key = p_idempotency_key;

  if found then
    select *
    into v_order
    from public.orders o
    where o.id = v_attempt.order_id;

    if not found then
      raise exception 'idempotent payment attempt references missing order'
        using errcode = 'data_exception';
    end if;

    if v_order.user_id is distinct from p_user_id then
      raise exception 'idempotency key reused by another user'
        using errcode = 'unique_violation';
    end if;

    select p.*
    into v_product
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = v_order.id
      and p.slug = p_product_slug
    order by oi.created_at, oi.id
    limit 1;

    if not found then
      raise exception 'idempotency key reused for different product'
        using errcode = 'unique_violation';
    end if;

    select pv.*
    into v_version
    from public.order_items oi
    join public.product_versions pv on pv.id = oi.product_version_id
    where oi.order_id = v_order.id
      and oi.product_id = v_product.id
    order by oi.created_at, oi.id
    limit 1;

    if not found then
      raise exception 'idempotent checkout is missing pinned product version'
        using errcode = 'data_exception';
    end if;

    return query
    select
      v_order.id,
      v_attempt.id,
      v_order.total_amount_krw,
      v_product.code,
      v_product.title,
      v_version.version;
    return;
  end if;

  select *
  into v_product
  from public.products p
  where p.slug = p_product_slug
    and p.is_active = true
  for share;

  if not found then
    raise exception 'active product not found'
      using errcode = 'no_data_found';
  end if;

  select pv.*
  into v_version
  from public.product_versions pv
  where pv.product_id = v_product.id
    and pv.status = 'published'
  order by pv.published_at desc nulls last, pv.created_at desc
  limit 1
  for share;

  if not found then
    raise exception 'published product version not found'
      using errcode = 'check_violation';
  end if;

  insert into public.orders (
    user_id,
    status,
    fulfillment_status,
    channel,
    total_amount_krw,
    currency
  )
  values (
    p_user_id,
    'pending',
    'not_started',
    'direct',
    v_product.price_krw,
    v_product.currency
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
    v_product.id,
    v_version.id,
    1,
    v_product.price_krw
  );

  select public.start_payment_attempt(
    v_order_id,
    p_provider,
    p_merchant_order_id,
    p_idempotency_key
  )
  into v_attempt_id;

  return query
  select
    v_order_id,
    v_attempt_id,
    v_product.price_krw,
    v_product.code,
    v_product.title,
    v_version.version;
end;
$$;

revoke all on function public.create_direct_checkout(uuid,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.create_direct_checkout(uuid,text,text,text,text)
  to service_role;
