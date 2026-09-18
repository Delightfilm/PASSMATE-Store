-- PASSMATE V4 production Worker runtime heartbeat.

create table if not exists public.worker_nodes (
  worker_id text primary key,
  instance_id uuid not null,
  mode text not null
    check (mode in ('reference','production')),
  version text not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  current_job_id uuid references public.issuance_jobs(id) on delete set null
);

create index if not exists idx_worker_nodes_last_seen
  on public.worker_nodes(last_seen_at desc);

create index if not exists idx_worker_nodes_current_job
  on public.worker_nodes(current_job_id)
  where current_job_id is not null;

alter table public.worker_nodes enable row level security;

revoke all on public.worker_nodes from anon, authenticated;

drop policy if exists "worker_nodes_client_deny"
  on public.worker_nodes;

create policy "worker_nodes_client_deny"
on public.worker_nodes
for all
to anon, authenticated
using (false)
with check (false);

create or replace function public.report_worker_node(
  p_worker_id text,
  p_instance_id uuid,
  p_mode text,
  p_version text,
  p_current_job_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_worker_id is null
     or length(p_worker_id) not between 3 and 128
     or p_worker_id !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'invalid worker id'
      using errcode = 'check_violation';
  end if;

  if p_mode not in ('reference','production') then
    raise exception 'invalid worker mode'
      using errcode = 'check_violation';
  end if;

  if p_version is null or length(p_version) not between 1 and 64 then
    raise exception 'invalid worker version'
      using errcode = 'check_violation';
  end if;

  if p_current_job_id is not null and not exists (
    select 1
    from public.issuance_jobs j
    where j.id = p_current_job_id
      and j.status = 'leased'
      and j.lease_owner = p_worker_id
  ) then
    raise exception 'current job is not leased by worker'
      using errcode = 'check_violation';
  end if;

  insert into public.worker_nodes (
    worker_id,
    instance_id,
    mode,
    version,
    started_at,
    last_seen_at,
    current_job_id
  )
  values (
    p_worker_id,
    p_instance_id,
    p_mode,
    p_version,
    now(),
    now(),
    p_current_job_id
  )
  on conflict (worker_id) do update set
    instance_id = excluded.instance_id,
    mode = excluded.mode,
    version = excluded.version,
    started_at = case
      when public.worker_nodes.instance_id is distinct from excluded.instance_id
      then now()
      else public.worker_nodes.started_at
    end,
    last_seen_at = now(),
    current_job_id = excluded.current_job_id;

  return true;
end;
$$;

revoke all on function public.report_worker_node(text,uuid,text,text,uuid)
  from public, anon, authenticated;

grant execute on function public.report_worker_node(text,uuid,text,text,uuid)
  to service_role;
