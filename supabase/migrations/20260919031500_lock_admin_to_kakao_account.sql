-- PASSMATE admin access lock.
-- Only the designated Kakao account may hold or exercise the admin role.

create or replace function private.is_designated_admin_user(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = p_user_id
      and lower(coalesce(u.email, '')) = 'jhpodong@naver.com'
      and coalesce(u.raw_app_meta_data ->> 'provider', '') = 'kakao'
      and coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'kakao'
  );
$$;

revoke all on function private.is_designated_admin_user(uuid)
  from public, anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and private.is_designated_admin_user(p.id)
  );
$$;

revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

create or replace function private.assert_admin_actor(
  p_user_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or not exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.role = 'admin'
      and private.is_designated_admin_user(p.id)
  ) then
    raise exception 'admin access required'
      using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all on function private.assert_admin_actor(uuid)
  from public, anon, authenticated;

create or replace function private.enforce_admin_allowlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'admin'
     and not private.is_designated_admin_user(new.id) then
    raise exception 'admin role is restricted to the designated Kakao account'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_admin_allowlist()
  from public, anon, authenticated;

drop trigger if exists trg_profiles_enforce_admin_allowlist on public.profiles;
create trigger trg_profiles_enforce_admin_allowlist
before insert or update of role on public.profiles
for each row execute function private.enforce_admin_allowlist();

-- Enforce a single-admin state immediately.
update public.profiles
set role = 'customer'
where role = 'admin'
  and not private.is_designated_admin_user(id);

update public.profiles
set role = 'admin'
where id = '332e3358-2b61-4956-83b6-0a25a7568294'::uuid
  and private.is_designated_admin_user(id);
