begin;
create table public.admin_analytics_report_cache (
  cache_key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null,
  expires_at timestamptz not null,
  constraint admin_analytics_cache_key_bound check (length(cache_key) <= 1200),
  constraint admin_analytics_cache_expiry check (expires_at >= fetched_at)
);
create index admin_analytics_report_cache_expiry_idx on public.admin_analytics_report_cache (expires_at);
alter table public.admin_analytics_report_cache enable row level security;
revoke all on table public.admin_analytics_report_cache from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_analytics_report_cache to service_role;
comment on table public.admin_analytics_report_cache is 'Server-only GA4 aggregate report cache. No visitor-level events or credentials.';
commit;
