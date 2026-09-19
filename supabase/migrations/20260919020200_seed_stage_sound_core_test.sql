-- PASSMATE Stage Sound Level 3 CORE test catalog seed
-- Safe default: hidden from public catalog until manually activated.

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
  'PM-SS3-CORE',
  'stage-sound-level-3-core',
  '무대음향 3급 핵심요약 패키지',
  '핵심요약 + 공식·숫자 치트시트 + 시험직전 체크리스트',
  '무대예술전문인 자격시험 무대음향 3급 대비용 PASSMATE 핵심요약 패키지입니다. 기출 기반 핵심 개념, 공식, 숫자, 출제이력, 기출 함정과 시험직전 점검 자료를 제공합니다.',
  2026,
  '2026 EDITION',
  '["CORE 핵심요약","SHEET 공식·숫자 치트시트","CHECK 시험직전 체크리스트","기출 출제이력 표시","D-1 시험직전 암기"]'::jsonb,
  5900,
  'KRW',
  false
)
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
  is_active = false,
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
  '2026-v0.1-test',
  2026,
  'draft',
  null
from public.products p
where p.code = 'PM-SS3-CORE'
on conflict (product_id, version) do update set
  edition_year = excluded.edition_year,
  status = 'draft',
  published_at = null;
