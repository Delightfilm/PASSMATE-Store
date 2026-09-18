-- PASSMATE V3.1 authenticated direct checkout transaction boundary.
-- Called only by trusted server/Edge Function after verifying the Supabase user JWT.

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
  v_order_id uuid;
  v_attempt_id uuid;
begin
  if p_user_id is null or not exists (
    select 1 from auth.users u where u.id = p_user_id
  ) then
    raise exception 'authenticated user not found'
      using errcode = 'check_violation';
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
