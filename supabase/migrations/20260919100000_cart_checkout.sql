-- PASSMATE cart + locked 2-SKU checkout.
-- Not applied to live Supabase as of 2026-09-19.

update public.products
set
  price_krw = 5900,
  subtitle = '핵심요약 + 공식·숫자 치트시트 + 시험직전 체크리스트',
  features = '["CORE 핵심요약","SHEET 공식·숫자 치트시트","CHECK 시험직전 체크리스트"]'::jsonb
where code in ('PM-C2', 'PM-SS3-CORE');

with package_map(base_code, pass_code, pass_slug, pass_title) as (
  values
    ('PM-C2', 'PM-C2-PASS', 'computer-literacy-2-pass-pack', '컴퓨터활용능력 2급 합격팩'),
    ('PM-SS3-CORE', 'PM-SS3-PASS', 'stage-sound-level-3-pass-pack', '무대음향 3급 합격팩')
)
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
select
  m.pass_code,
  m.pass_slug,
  m.pass_title,
  '상세 합격교재 + 핵심요약 + 공식·숫자 치트시트 + 시험직전 체크리스트',
  base.description,
  base.display_year,
  'PASS PACK',
  '["PASS PACK 상세 합격교재","CORE 핵심요약","SHEET 공식·숫자 치트시트","CHECK 시험직전 체크리스트"]'::jsonb,
  9900,
  base.currency,
  base.is_active
from package_map m
join public.products base on base.code = m.base_code
on conflict (code) do update set
  slug = excluded.slug,
  title = excluded.title,
  subtitle = excluded.subtitle,
  description = excluded.description,
  display_year = excluded.display_year,
  badge = excluded.badge,
  features = excluded.features,
  price_krw = excluded.price_krw,
  currency = excluded.currency,
  is_active = excluded.is_active;

with package_map(base_code, pass_code) as (
  values
    ('PM-C2', 'PM-C2-PASS'),
    ('PM-SS3-CORE', 'PM-SS3-PASS')
)
insert into public.product_versions (
  product_id,
  version,
  edition_year,
  status,
  published_at
)
select
  pass.id,
  base_version.version,
  base_version.edition_year,
  base_version.status,
  base_version.published_at
from package_map m
join public.products base on base.code = m.base_code
join public.products pass on pass.code = m.pass_code
join public.product_versions base_version on base_version.product_id = base.id
on conflict (product_id, version) do nothing;

drop function if exists public.create_direct_checkout(
  uuid,
  text,
  text[],
  text,
  text,
  text
);

create function public.create_direct_checkout(
  p_user_id uuid,
  p_product_slug text,
  p_product_slugs text[],
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
  product_version text,
  order_name text,
  items jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_version public.product_versions%rowtype;
  v_first_product public.products%rowtype;
  v_first_version public.product_versions%rowtype;
  v_order public.orders%rowtype;
  v_attempt public.payment_attempts%rowtype;
  v_order_id uuid;
  v_attempt_id uuid;
  v_total integer := 0;
  v_slug text;
  v_requested_slugs text[];
  v_existing_slugs text[];
  v_distinct_count integer;
  v_item_count integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_order_name text;
begin
  if p_user_id is null or not exists (
    select 1 from auth.users u where u.id = p_user_id
  ) then
    raise exception 'authenticated user not found'
      using errcode = 'check_violation';
  end if;

  if p_provider is null or p_provider !~ '^[a-z0-9_-]{2,32}$' then
    raise exception 'invalid payment provider'
      using errcode = 'check_violation';
  end if;

  if p_merchant_order_id is null
     or length(p_merchant_order_id) not between 1 and 128 then
    raise exception 'invalid merchant order id'
      using errcode = 'check_violation';
  end if;

  if p_idempotency_key is null
     or length(p_idempotency_key) not between 1 and 128 then
    raise exception 'invalid payment idempotency key'
      using errcode = 'check_violation';
  end if;

  if p_product_slugs is null
     or cardinality(p_product_slugs) < 1
     or cardinality(p_product_slugs) > 20 then
    raise exception 'products required'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from unnest(p_product_slugs) as requested(slug)
    where requested.slug is null
       or length(requested.slug) not between 1 and 160
  ) then
    raise exception 'invalid product slug'
      using errcode = 'check_violation';
  end if;

  if p_product_slug is distinct from p_product_slugs[1] then
    raise exception 'primary product slug mismatch'
      using errcode = 'check_violation';
  end if;

  select
    array_agg(requested.slug order by requested.slug),
    count(distinct requested.slug)
  into v_requested_slugs, v_distinct_count
  from unnest(p_product_slugs) as requested(slug);

  if v_distinct_count <> cardinality(p_product_slugs) then
    raise exception 'duplicate product slug'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from (
      select regexp_replace(requested.slug, '-pass-pack$', '') as family_slug
      from unnest(p_product_slugs) as requested(slug)
      group by regexp_replace(requested.slug, '-pass-pack$', '')
      having count(*) > 1
    ) conflicts
  ) then
    raise exception 'conflicting package selections'
      using errcode = 'check_violation';
  end if;

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
    select o.*
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

    select array_agg(p.slug order by p.slug)
    into v_existing_slugs
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = v_order.id;

    if v_existing_slugs is distinct from v_requested_slugs then
      raise exception 'idempotency key reused for different cart'
        using errcode = 'unique_violation';
    end if;

    select p.*
    into v_first_product
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = v_order.id
    order by oi.created_at, oi.id
    limit 1;

    select pv.*
    into v_first_version
    from public.order_items oi
    join public.product_versions pv on pv.id = oi.product_version_id
    where oi.order_id = v_order.id
    order by oi.created_at, oi.id
    limit 1;

    select
      count(*),
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'slug', p.slug,
            'code', p.code,
            'title', p.title,
            'version', pv.version,
            'amountKrw', oi.quantity * oi.unit_price_krw
          )
          order by oi.created_at, oi.id
        ),
        '[]'::jsonb
      )
    into v_item_count, v_items
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    join public.product_versions pv on pv.id = oi.product_version_id
    where oi.order_id = v_order.id;

    v_order_name :=
      case
        when v_item_count = 1 then v_first_product.title
        else v_first_product.title || ' 외 ' || (v_item_count - 1)::text || '건'
      end;

    return query
    select
      v_order.id,
      v_attempt.id,
      v_order.total_amount_krw,
      v_first_product.code,
      v_first_product.title,
      v_first_version.version,
      v_order_name,
      v_items;
    return;
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
    0,
    'KRW'
  )
  returning id into v_order_id;

  foreach v_slug in array p_product_slugs loop
    select p.*
    into v_product
    from public.products p
    where p.slug = v_slug
      and p.is_active = true
    for share;

    if not found then
      raise exception 'active product not found'
        using errcode = 'no_data_found';
    end if;

    if v_product.currency <> 'KRW' then
      raise exception 'cart currency must be KRW'
        using errcode = 'check_violation';
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

    if v_item_count = 0 then
      v_first_product := v_product;
      v_first_version := v_version;
    end if;

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

    v_total := v_total + v_product.price_krw;
    v_item_count := v_item_count + 1;
    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'slug', v_product.slug,
        'code', v_product.code,
        'title', v_product.title,
        'version', v_version.version,
        'amountKrw', v_product.price_krw
      )
    );
  end loop;

  update public.orders
  set total_amount_krw = v_total
  where id = v_order_id;

  select public.start_payment_attempt(
    v_order_id,
    p_provider,
    p_merchant_order_id,
    p_idempotency_key
  )
  into v_attempt_id;

  v_order_name :=
    case
      when v_item_count = 1 then v_first_product.title
      else v_first_product.title || ' 외 ' || (v_item_count - 1)::text || '건'
    end;

  return query
  select
    v_order_id,
    v_attempt_id,
    v_total,
    v_first_product.code,
    v_first_product.title,
    v_first_version.version,
    v_order_name,
    v_items;
end;
$$;

revoke all on function public.create_direct_checkout(
  uuid,
  text,
  text[],
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.create_direct_checkout(
  uuid,
  text,
  text[],
  text,
  text,
  text
) to service_role;
