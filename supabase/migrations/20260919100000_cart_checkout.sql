-- Multi-item checkout. Existing five-argument direct checkout stays intact.
insert into public.products (code, slug, title, subtitle, description, display_year, badge, features, price_krw, currency, is_active)
select 'PM-C2-PACK', 'computer-literacy-2-pass-pack', title, '핵심요약 + 합격팩 구성', description, display_year, 'PASS PACK',
  features || '["시험직전 벼락치기", "실수방지 체크리스트"]'::jsonb, price_krw + 6000, currency, is_active
from public.products where slug = 'computer-literacy-2'
on conflict (slug) do nothing;
insert into public.product_versions (product_id, version, edition_year, status, published_at)
select p.id, pv.version, pv.edition_year, pv.status, pv.published_at
from public.products p join public.products base on base.slug = 'computer-literacy-2'
join public.product_versions pv on pv.product_id = base.id
where p.slug = 'computer-literacy-2-pass-pack'
on conflict (product_id, version) do nothing;

create or replace function public.create_direct_checkout(
  p_user_id uuid, p_product_slug text, p_product_slugs text[], p_provider text,
  p_merchant_order_id text, p_idempotency_key text
)
returns table (order_id uuid, payment_attempt_id uuid, amount_krw integer, product_code text, product_title text, product_version text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_order_id uuid; v_attempt_id uuid; v_total integer := 0; v_slug text;
  v_product public.products%rowtype; v_version public.product_versions%rowtype;
begin
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then raise exception 'authenticated user not found'; end if;
  select pa.order_id, pa.id into v_order_id, v_attempt_id from public.payment_attempts pa where pa.provider = p_provider and pa.idempotency_key = p_idempotency_key;
  if v_attempt_id is not null then
    select p.*, pv.* into v_product, v_version from public.order_items oi join public.products p on p.id = oi.product_id join public.product_versions pv on pv.id = oi.product_version_id where oi.order_id = v_order_id order by oi.created_at, oi.id limit 1;
    return query select v_order_id, v_attempt_id, (select total_amount_krw from public.orders where id = v_order_id), v_product.code, v_product.title, v_version.version;
    return;
  end if;
  if p_product_slugs is null or cardinality(p_product_slugs) = 0 then raise exception 'products required'; end if;
  foreach v_slug in array p_product_slugs loop
    select p.* into v_product from public.products p where p.slug = v_slug and p.is_active for share;
    if not found then raise exception 'active product not found'; end if;
    select pv.* into v_version from public.product_versions pv where pv.product_id = v_product.id and pv.status = 'published' order by pv.published_at desc nulls last, pv.created_at desc limit 1;
    if not found then raise exception 'published product version not found'; end if;
    if v_order_id is null then
      insert into public.orders(user_id,status,fulfillment_status,channel,total_amount_krw,currency) values(p_user_id,'pending','not_started','direct',0,v_product.currency) returning id into v_order_id;
    end if;
    insert into public.order_items(order_id,product_id,product_version_id,quantity,unit_price_krw) values(v_order_id,v_product.id,v_version.id,1,v_product.price_krw);
    v_total := v_total + v_product.price_krw;
  end loop;
  update public.orders set total_amount_krw = v_total where id = v_order_id;
  select public.start_payment_attempt(v_order_id,p_provider,p_merchant_order_id,p_idempotency_key) into v_attempt_id;
  return query select v_order_id,v_attempt_id,v_total,v_product.code,v_product.title,v_version.version;
end; $$;
revoke all on function public.create_direct_checkout(uuid,text,text[],text,text,text) from public, anon, authenticated;
grant execute on function public.create_direct_checkout(uuid,text,text[],text,text,text) to service_role;
