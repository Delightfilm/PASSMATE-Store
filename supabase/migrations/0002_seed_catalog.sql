-- PASSMATE initial catalog seed
-- Safe to re-run: product and draft version are upserted by stable business keys.

insert into public.products (
  code,
  slug,
  title,
  subtitle,
  description,
  price_krw,
  currency,
  is_active
)
values (
  'PM-C2',
  'computer-literacy-2',
  '컴퓨터활용능력 2급',
  '핵심요약 + 시험직전 벼락치기 + 치트시트',
  '방대한 시험 범위를 빠르게 회독할 수 있도록 핵심만 구조화한 PASSMATE 첫 번째 요약노트입니다.',
  6900,
  'KRW',
  true
)
on conflict (code) do update set
  slug = excluded.slug,
  title = excluded.title,
  subtitle = excluded.subtitle,
  description = excluded.description,
  price_krw = excluded.price_krw,
  currency = excluded.currency,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.product_versions (
  product_id,
  version,
  edition_year,
  status,
  published_at
)
select
  p.id,
  '2027-v1.0',
  2027,
  'draft',
  null
from public.products p
where p.code = 'PM-C2'
on conflict (product_id, version) do update set
  edition_year = excluded.edition_year,
  status = excluded.status,
  published_at = excluded.published_at;
