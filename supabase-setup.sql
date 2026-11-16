-- ============================================================
-- Mind · Supabase setup
-- Run this whole file once: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1) TABLES ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text unique not null,
  role        text not null default 'user',            -- 'user' | 'developer'
  license_key text,
  hwid        text,
  expires_at  timestamptz,                             -- null + license_key = Lifetime
  created_at  timestamptz not null default now()
);

create table if not exists public.keys (
  id            bigint generated always as identity primary key,
  key_code      text unique not null,
  duration_days int,                                   -- null = Lifetime
  is_used       boolean not null default false,
  used_by       uuid references auth.users (id),
  created_at    timestamptz not null default now()
);

-- 2) PERMISSIONS -------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
revoke all on public.keys     from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (hwid) on public.profiles to authenticated;   -- users may touch ONLY hwid
grant select on public.keys to authenticated;
grant insert (key_code, duration_days) on public.keys to authenticated;
grant delete on public.keys to authenticated;

-- 3) ADMIN CHECK (security definer avoids RLS recursion) ---------------
create or replace function public.is_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce(
    (select role = 'developer' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- 4) ROW LEVEL SECURITY -------------------------------------------------
alter table public.profiles enable row level security;
alter table public.keys     enable row level security;

create policy profiles_read_own   on public.profiles for select using (auth.uid() = id);
create policy profiles_hwid_own   on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_admin_all  on public.profiles for all using (public.is_admin()) with check (public.is_admin());

create policy keys_read_own       on public.keys for select using (used_by = auth.uid());
create policy keys_admin_all      on public.keys for all using (public.is_admin()) with check (public.is_admin());

-- 5) AUTO-PROFILE ON SIGNUP (developer role for the owner e-mail) ------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when lower(new.email) = 'kalikgarik@mail.ru' then 'developer' else 'user' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6) CLAIM KEY — atomic "purchase": takes one free key, assigns it -----
create or replace function public.claim_key()
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  k public.keys%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into k
  from public.keys
  where is_used = false
  order by created_at
  limit 1
  for update skip locked;

  if not found then
    return null; -- out of stock: developer must generate keys in the admin panel
  end if;

  update public.keys set is_used = true, used_by = auth.uid() where id = k.id;

  update public.profiles
  set license_key = k.key_code,
      expires_at  = case
        when k.duration_days is null then null
        else now() + make_interval(days => k.duration_days)
      end
  where id = auth.uid();

  return k.key_code;
end;
$$;

grant execute on function public.claim_key() to authenticated;
grant execute on function public.is_admin()  to authenticated;

-- 7) OPTIONAL: promote the owner manually if the account already exists
-- update public.profiles set role = 'developer' where email = 'kalikgarik@mail.ru';
