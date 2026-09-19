-- PASSMATE admin product data management.
-- Product writes stay service-role only and require the designated admin actor.

create or replace function public.admin_update_product(
  p_admin_user_id uuid,
  p_product_id uuid,
  p_title text,
  p_subtitle text,
  p_description text,
  p_display_year integer,
  p_badge text,
  p_features jsonb,
  p_price_krw integer,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
begin
  perform private.assert_admin_actor(p_admin_user_id);

  if p_product_id is null then
    raise exception 'product id is required'
      using errcode = 'check_violation';
  end if;

  if length(trim(coalesce(p_title, ''))) < 2 then
    raise exception 'product title is invalid'
      using errcode = 'check_violation';
  end if;

  if p_display_year is null or p_display_year < 2026 or p_display_year > 2100 then
    raise exception 'display year is invalid'
      using errcode = 'check_violation';
  end if;

  if p_price_krw is null or p_price_krw < 0 or p_price_krw > 10000000 then
    raise exception 'product price is invalid'
      using errcode = 'check_violation';
  end if;

  if p_features is null or jsonb_typeof(p_features) <> 'array' then
    raise exception 'features must be an array'
      using errcode = 'check_violation';
  end if;

  select *
  into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'product not found'
      using errcode = 'no_data_found';
  end if;

  if p_is_active and not exists (
    select 1
    from public.product_versions pv
    where pv.product_id = p_product_id
      and pv.status = 'published'
  ) then
    raise exception 'active product requires a published version'
      using errcode = 'check_violation';
  end if;

  update public.products
  set
    title = trim(p_title),
    subtitle = nullif(trim(coalesce(p_subtitle, '')), ''),
    description = nullif(trim(coalesce(p_description, '')), ''),
    display_year = p_display_year,
    badge = nullif(trim(coalesce(p_badge, '')), ''),
    features = p_features,
    price_krw = p_price_krw,
    is_active = p_is_active,
    updated_at = now()
  where id = p_product_id;

  insert into public.admin_action_events (
    actor_user_id,
    action,
    target_type,
    target_id,
    detail
  )
  values (
    p_admin_user_id,
    'update_product',
    'product',
    p_product_id,
    jsonb_build_object(
      'code', v_product.code,
      'price_krw', p_price_krw,
      'is_active', p_is_active,
      'display_year', p_display_year
    )
  );

  return p_product_id;
end;
$$;

revoke all on function public.admin_update_product(
  uuid,uuid,text,text,text,integer,text,jsonb,integer,boolean
) from public, anon, authenticated;

grant execute on function public.admin_update_product(
  uuid,uuid,text,text,text,integer,text,jsonb,integer,boolean
) to service_role;
