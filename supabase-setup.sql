-- =====================================================================
-- Mind · production Supabase schema
-- Run the WHOLE file in: Supabase Dashboard -> SQL Editor -> New query
-- =====================================================================

-- This script is safe to run more than once. It never exposes service_role
-- credentials and never trusts a role sent by the browser.

-- 1. TABLES ------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text unique not null,
  display_name  text,
  role          text not null default 'user' check (role in ('user', 'developer')),
  license_key   text unique,
  hwid          text,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists public.keys (
  id             bigint generated always as identity primary key,
  key_code       text unique not null check (key_code ~ '^MIND-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  duration_days  int check (duration_days is null or duration_days > 0), -- null = Lifetime
  is_used        boolean not null default false,
  used_by        uuid references public.profiles (id) on delete set null,
  used_at        timestamptz,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

-- Compatibility for a project where an older Mind SQL was already run.
alter table public.profiles add column if not exists display_name text;
alter table public.keys add column if not exists used_at timestamptz;
alter table public.keys add column if not exists created_by uuid references public.profiles (id) on delete set null;

create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists keys_used_by_idx on public.keys (used_by);
create index if not exists keys_is_used_idx on public.keys (is_used);

-- 2. SERVER-SIDE ADMIN CHECK ------------------------------------------
-- The helper lives outside the exposed `public` schema. It reads the email
-- from the signed Supabase JWT, not from user-editable metadata or the UI.
create schema if not exists private;
revoke all on schema private from public;

create or replace function private.is_mind_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'kalikgarik@mail.ru';
$$;

grant usage on schema private to authenticated;
revoke all on function private.is_mind_admin() from public, anon;
grant execute on function private.is_mind_admin() to authenticated;

-- 3. AUTO-CREATE PROFILE AFTER AUTH SIGN-UP ---------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    case
      when lower(new.email) = 'kalikgarik@mail.ru' then 'developer'
      else 'user'
    end
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        role = case
          when excluded.email = 'kalikgarik@mail.ru' then 'developer'
          else public.profiles.role
        end;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for Auth users created before this SQL was installed.
insert into public.profiles (id, email, display_name, role)
select
  u.id,
  lower(u.email),
  coalesce(u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)),
  case when lower(u.email) = 'kalikgarik@mail.ru' then 'developer' else 'user' end
from auth.users u
where u.email is not null
on conflict (id) do update
set email = excluded.email,
    role = case
      when excluded.email = 'kalikgarik@mail.ru' then 'developer'
      else public.profiles.role
    end;

-- 4. PRIVILEGES + ROW LEVEL SECURITY ----------------------------------
alter table public.profiles enable row level security;
alter table public.keys enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.keys from anon, authenticated;

-- A signed-in user can read their own profile. The developer can read all.
grant select on public.profiles to authenticated;

-- Browser clients may update ONLY the hwid column. They cannot set role,
-- license_key or expires_at, even if they manually call the REST API.
grant update (hwid) on public.profiles to authenticated;

-- Keys are directly visible/writable only to the developer. Normal users
-- activate a key through the protected RPC below and never query keys.
grant select, insert, delete on public.keys to authenticated;
grant usage, select on sequence public.keys_id_seq to authenticated;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_update_hwid_own on public.profiles;
drop policy if exists profiles_update_hwid_admin on public.profiles;
drop policy if exists profiles_read_own on public.profiles;
drop policy if exists profiles_hwid_own on public.profiles;
drop policy if exists profiles_admin_all on public.profiles;

create policy profiles_select_own
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy profiles_select_admin
on public.profiles for select to authenticated
using ((select private.is_mind_admin()));

create policy profiles_update_hwid_own
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy profiles_update_hwid_admin
on public.profiles for update to authenticated
using ((select private.is_mind_admin()))
with check ((select private.is_mind_admin()));

drop policy if exists keys_select_admin on public.keys;
drop policy if exists keys_insert_admin on public.keys;
drop policy if exists keys_delete_admin on public.keys;
drop policy if exists keys_read_own on public.keys;
drop policy if exists keys_admin_all on public.keys;

create policy keys_select_admin
on public.keys for select to authenticated
using ((select private.is_mind_admin()));

create policy keys_insert_admin
on public.keys for insert to authenticated
with check (
  (select private.is_mind_admin())
  and created_by = (select auth.uid())
  and is_used = false
  and used_by is null
);

create policy keys_delete_admin
on public.keys for delete to authenticated
using ((select private.is_mind_admin()));

-- 5. ATOMIC LICENSE ACTIVATION ----------------------------------------
-- This is the ONLY path for a normal user to receive license_key/expires_at.
-- FOR UPDATE prevents two users from claiming the same key simultaneously.
drop function if exists public.claim_key();
drop function if exists public.activate_license_key(text);

create function public.activate_license_key(p_key_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_key public.keys%rowtype;
  v_expires_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_key_code is null or trim(p_key_code) = '' then
    raise exception 'Enter a license key';
  end if;

  select * into v_key
  from public.keys
  where upper(key_code) = upper(trim(p_key_code))
  for update;

  if not found then
    raise exception 'Invalid license key';
  end if;

  if v_key.is_used then
    raise exception 'This license key has already been activated';
  end if;

  v_expires_at := case
    when v_key.duration_days is null then null
    else now() + make_interval(days => v_key.duration_days)
  end;

  update public.keys
  set is_used = true,
      used_by = v_uid,
      used_at = now()
  where id = v_key.id;

  update public.profiles
  set license_key = v_key.key_code,
      expires_at = v_expires_at
  where id = v_uid;

  if not found then
    raise exception 'Profile not found';
  end if;

  return jsonb_build_object(
    'key_code', v_key.key_code,
    'duration_days', v_key.duration_days,
    'expires_at', v_expires_at
  );
end;
$$;

revoke all on function public.activate_license_key(text) from public, anon;
grant execute on function public.activate_license_key(text) to authenticated;

-- 6. FINAL OWNER REPAIR -----------------------------------------------
update public.profiles
set role = 'developer'
where lower(email) = 'kalikgarik@mail.ru';

-- Optional checks after running:
-- select id, email, role, hwid, license_key, expires_at from public.profiles;
-- select id, key_code, duration_days, is_used, used_by from public.keys order by id desc;
-- 7. MANUAL / BACKEND KEY ISSUING (developer only) --------------------
-- Used by Developer-mode checkout and by future payment automation.
create or replace function public.issue_license_key(
  p_email text,
  p_key_code text,
  p_duration_days int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_expires timestamptz;
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(email) = 'kalikgarik@mail.ru'
      and role = 'developer'
  ) then
    raise exception 'Developer access required';
  end if;

  if p_key_code !~ '^MIND-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$' then
    raise exception 'Invalid key format';
  end if;

  if p_duration_days is not null and p_duration_days < 1 then
    raise exception 'Invalid duration';
  end if;

  select id into strict v_uid
  from public.profiles
  where lower(email) = lower(trim(p_email));

  if not found then
    raise exception 'No user with this email. Ask them to register first.';
  end if;

  v_expires := case
    when p_duration_days is null then null
    else now() + make_interval(days => p_duration_days)
  end;

  insert into public.keys (
    key_code,
    duration_days,
    is_used,
    used_by,
    used_at,
    created_by
  )
  values (
    p_key_code,
    p_duration_days,
    true,
    v_uid,
    now(),
    auth.uid()
  )
  on conflict (key_code) do nothing;

  if not found then
    raise exception 'Key already exists';
  end if;

  update public.profiles
  set license_key = p_key_code,
      expires_at = v_expires
  where id = v_uid;

  return jsonb_build_object(
    'key_code', p_key_code,
    'duration_days', p_duration_days,
    'expires_at', v_expires
  );
end;
$$;

revoke all
  on function public.issue_license_key(text, text, int)
  from public, anon;

grant execute
  on function public.issue_license_key(text, text, int)
  to authenticated;
