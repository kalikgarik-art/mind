-- =====================================================================
-- Mind · production Supabase schema
-- Run the WHOLE file in: Supabase Dashboard -> SQL Editor -> New query
-- =====================================================================

-- This script is safe to run more than once. It never exposes service_role
-- credentials and never trusts a role sent by the browser.

-- 1. TABLES ------------------------------------------------------------
create table if not exists public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                text unique not null,
  display_name         text,
  username             text unique,                       -- stored lowercase, without '@'
  username_updated_at  timestamptz,                       -- last @username change (14-day cooldown)
  discord_id           text,
  discord_username     text,
  discord_avatar       text,
  role                 text not null default 'user' check (role in ('user', 'developer')),
  license_key          text unique,
  hwid                 text,
  expires_at           timestamptz,
  license_activated_at timestamptz,                       -- when the current key was bought/activated
  created_at           timestamptz not null default now()
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

-- @username system + discord binding + license purchase date (safe migration)
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists username_updated_at timestamptz;
alter table public.profiles add column if not exists discord_id text;
alter table public.profiles add column if not exists discord_username text;
alter table public.profiles add column if not exists discord_avatar text;
alter table public.profiles add column if not exists license_activated_at timestamptz;

-- username format: latin letters, digits, underscore, 3-20 chars, always lowercase
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');
create unique index if not exists profiles_username_key on public.profiles (username);

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
declare
  v_meta_username text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  v_username text := case when v_meta_username ~ '^[a-z0-9_]{3,20}$' then v_meta_username else null end;
begin
  insert into public.profiles (id, email, display_name, role, username, username_updated_at)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    case
      when lower(new.email) = 'kalikgarik@mail.ru' then 'developer'
      else 'user'
    end,
    v_username,
    case when v_username is not null then now() else null end
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        role = case
          when excluded.email = 'kalikgarik@mail.ru' then 'developer'
          else public.profiles.role
        end,
        username = coalesce(public.profiles.username, excluded.username),
        username_updated_at = coalesce(public.profiles.username_updated_at, excluded.username_updated_at);
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
      expires_at = v_expires_at,
      license_activated_at = now()
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
      expires_at = v_expires,
      license_activated_at = now()
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

-- 8. @USERNAME SYSTEM (unique + 14-day cooldown) -----------------------
-- Any signed-in user may check whether an @username is free (registration
-- and gift flows). Read-only.
create or replace function public.check_username(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uname text := lower(coalesce(p_username, ''));
  v_row public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_uname !~ '^[a-z0-9_]{3,20}$' then
    return jsonb_build_object(
      'valid', false, 'exists', false,
      'is_own', false, 'has_active_license', false
    );
  end if;

  select * into v_row
  from public.profiles
  where username = v_uname
  limit 1;

  return jsonb_build_object(
    'valid', true,
    'exists', coalesce(v_row.id is not null, false),
    'is_own', coalesce(v_row.id = auth.uid(), false),
    'has_active_license', coalesce(
      v_row.license_key is not null
      and (v_row.expires_at is null or v_row.expires_at > now()),
      false
    )
  );
end;
$$;

revoke all on function public.check_username(text) from public, anon;
grant execute on function public.check_username(text) to authenticated;

-- Changing your own @username: once every 14 days, enforced by the DB.
create or replace function public.change_username(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_uname text := lower(coalesce(p_username, ''));
  v_old text;
  v_changed timestamptz;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if v_uname !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Username must be 3-20 characters: latin letters, numbers and underscore';
  end if;

  select username, username_updated_at
  into v_old, v_changed
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_old = v_uname then
    raise exception 'This is already your username';
  end if;

  if v_changed is not null and (now() - v_changed) < interval '14 days' then
    raise exception 'Смена юзернейма доступна раз в 14 дней';
  end if;

  if exists (select 1 from public.profiles where username = v_uname) then
    raise exception 'Этот юзернейм уже занят';
  end if;

  update public.profiles
  set username = v_uname,
      username_updated_at = now()
  where id = v_uid;

  return jsonb_build_object(
    'username', v_uname,
    'username_updated_at', now()
  );
end;
$$;

revoke all on function public.change_username(text) from public, anon;
grant execute on function public.change_username(text) to authenticated;

-- 9. DISCORD BINDING (read from auth.identities, write to profiles) ----
create or replace function public.sync_discord()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ident auth.identities%rowtype;
  v_name text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_ident
  from auth.identities
  where user_id = v_uid
    and provider = 'discord'
  limit 1;

  if not found then
    update public.profiles
    set discord_id = null,
        discord_username = null,
        discord_avatar = null
    where id = v_uid;
    return jsonb_build_object('linked', false);
  end if;

  v_name := coalesce(
    v_ident.identity_data ->> 'user_name',
    v_ident.identity_data ->> 'username',
    v_ident.identity_data ->> 'full_name',
    v_ident.identity_data ->> 'nickname'
  );

  update public.profiles
  set discord_id = v_ident.provider_id,
      discord_username = v_name,
      discord_avatar = v_ident.identity_data ->> 'avatar_url'
  where id = v_uid;

  return jsonb_build_object(
    'linked', true,
    'discord_id', v_ident.provider_id,
    'discord_username', v_name,
    'discord_avatar', v_ident.identity_data ->> 'avatar_url'
  );
end;
$$;

revoke all on function public.sync_discord() from public, anon;
grant execute on function public.sync_discord() to authenticated;

-- 10. DEVELOPER: REMOVE LICENSE (full revoke for any user) --------------
create or replace function public.remove_license(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

  if p_user_id is null then
    raise exception 'User not specified';
  end if;

  update public.profiles
  set license_key = null,
      expires_at = null,
      license_activated_at = null,
      hwid = null
  where id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

revoke all on function public.remove_license(uuid) from public, anon;
grant execute on function public.remove_license(uuid) to authenticated;

-- 11. DEVELOPER: GIFT A KEY TO AN @USERNAME -----------------------------
create or replace function public.gift_license_key(
  p_username text,
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
  v_email text;
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

  select id, email into v_uid, v_email
  from public.profiles
  where username = lower(coalesce(p_username, ''));

  if not found then
    raise exception 'Пользователь с таким юзернеймом не найден';
  end if;

  v_expires := case
    when p_duration_days is null then null
    else now() + make_interval(days => p_duration_days)
  end;

  insert into public.keys (key_code, duration_days, is_used, used_by, used_at, created_by)
  values (p_key_code, p_duration_days, true, v_uid, now(), auth.uid())
  on conflict (key_code) do nothing;

  if not found then
    raise exception 'Key already exists';
  end if;

  update public.profiles
  set license_key = p_key_code,
      expires_at = v_expires,
      license_activated_at = now()
  where id = v_uid;

  return jsonb_build_object(
    'key_code', p_key_code,
    'duration_days', p_duration_days,
    'expires_at', v_expires,
    'recipient_email', v_email,
    'recipient_username', lower(coalesce(p_username, ''))
  );
end;
$$;

revoke all on function public.gift_license_key(text, text, int) from public, anon;
grant execute on function public.gift_license_key(text, text, int) to authenticated;
