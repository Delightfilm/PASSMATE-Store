-- PASSMATE admin product creation.
-- Creates a hidden product with an initial draft version only.

create or replace function public.admin_create_product(
  p_admin_user_id uuid,
  p_code text,
  p_slug text,
  p_title text,
  p_subtitle text,
  p_description text,
  p_display_year integer,
  p_badge text,
  p_features jsonb,
  p_price_krw integer,
  p_initial_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_id uuid;
begin
  perform private.assert_admin_actor(p_admin_user_id);

  if coalesce(p_code, '') !~ '^[A-Z0-9][A-Z0-9-]{2,39}$' then
    raise exception 'product code is invalid'
      using errcode = 'check_violation';
  end if;

  if coalesce(p_slug, '') !~ '^[a-z0-9][a-z0-9-]{2,79}$' then
    raise exception 'product slug is invalid'
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

  if length(trim(coalesce(p_initial_version, ''))) < 3 then
    raise exception 'initial version is invalid'
      using errcode = 'check_violation';
  end if;

  insert into public.products (
    code,
    slug,
    title,
    subtitle,
    description,
    display_year,
    badge,
    features,
    price_krw,
    currency,
    is_active
  )
  values (
    trim(p_code),
    trim(p_slug),
    trim(p_title),
    nullif(trim(coalesce(p_subtitle, '')), ''),
    nullif(trim(coalesce(p_description, '')), ''),
    p_display_year,
    nullif(trim(coalesce(p_badge, '')), ''),
    p_features,
    p_price_krw,
    'KRW',
    false
  )
  returning id into v_product_id;

  insert into public.product_versions (
    product_id,
    version,
    edition_year,
    status,
    published_at
  )
  values (
    v_product_id,
    trim(p_initial_version),
    p_display_year,
    'draft',
    null
  );

  insert into public.admin_action_events (
    actor_user_id,
    action,
    target_type,
    target_id,
    detail
  )
  values (
    p_admin_user_id,
    'create_product',
    'product',
    v_product_id,
    jsonb_build_object(
      'code', trim(p_code),
      'slug', trim(p_slug),
      'initial_version', trim(p_initial_version)
    )
  );

  return v_product_id;
end;
$$;

revoke all on function public.admin_create_product(
  uuid,text,text,text,text,text,integer,text,jsonb,integer,text
) from public, anon, authenticated;

grant execute on function public.admin_create_product(
  uuid,text,text,text,text,text,integer,text,jsonb,integer,text
) to service_role;
