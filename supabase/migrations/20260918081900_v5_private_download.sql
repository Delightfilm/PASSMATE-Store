-- PASSMATE V5 private artifact storage and signed-download contract.
-- Customer browsers never receive a permanent object URL.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'passmate-artifacts',
  'passmate-artifacts',
  false,
  52428800,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

create table if not exists public.download_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  entitlement_id uuid references public.entitlements(id) on delete set null,
  issuance_job_id uuid references public.issuance_jobs(id) on delete set null,
  event_type text not null default 'signed_url_created'
    check (event_type in ('signed_url_created')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_download_events_user_created
  on public.download_events(user_id, created_at desc);

create index if not exists idx_download_events_entitlement
  on public.download_events(entitlement_id, created_at desc);

alter table public.download_events enable row level security;

revoke all on public.download_events from anon, authenticated;

drop policy if exists "download_events_client_deny"
  on public.download_events;

create policy "download_events_client_deny"
on public.download_events
for all
to anon, authenticated
using (false)
with check (false);

create or replace function public.resolve_download_artifact(
  p_user_id uuid,
  p_entitlement_id uuid
)
returns table (
  issuance_job_id uuid,
  order_id uuid,
  storage_key text,
  sha256 text,
  size_bytes bigint,
  product_code text,
  product_version text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    j.id,
    o.id,
    j.result_storage_key,
    j.result_sha256,
    j.result_size_bytes,
    p.code,
    pv.version
  from public.entitlements e
  join public.orders o
    on o.id = e.source_order_id
  join public.products p
    on p.id = e.product_id
  join public.product_versions pv
    on pv.id = e.product_version_id
   and pv.product_id = e.product_id
  join public.issuance_jobs j
    on j.order_id = o.id
   and j.product_id = e.product_id
   and j.product_version_id = e.product_version_id
  where e.id = p_entitlement_id
    and e.user_id = p_user_id
    and e.status = 'active'
    and o.user_id = p_user_id
    and o.status = 'paid'
    and o.fulfillment_status = 'ready'
    and j.status = 'succeeded'
    and j.result_storage_key is not null
    and j.result_sha256 is not null
    and j.result_size_bytes is not null
  order by j.generation desc, j.completed_at desc
  limit 1;
$$;

revoke all on function public.resolve_download_artifact(uuid,uuid)
  from public, anon, authenticated;

grant execute on function public.resolve_download_artifact(uuid,uuid)
  to service_role;
