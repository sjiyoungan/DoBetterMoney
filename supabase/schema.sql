-- DoBetterMoney schema
-- Paste into Supabase → SQL Editor → Run
--
-- Also turn OFF email confirmation:
-- Authentication → Providers → Email → "Confirm email" = OFF

create extension if not exists "pgcrypto";

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  username text,
  preferred_role text not null default 'liz'
    check (preferred_role in ('liz', 'ji')),
  created_at timestamptz not null default now()
);

-- Safe if table already existed without username
alter table public.profiles
  add column if not exists username text;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Shared budget workspace (Liz + Ji both read/write)
create table if not exists public.budget_workspace (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'DoBetterMoney',
  data jsonb not null default '{}'::jsonb,
  done_keys text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.budget_workspace enable row level security;

drop policy if exists "workspace_select_authenticated" on public.budget_workspace;
create policy "workspace_select_authenticated"
  on public.budget_workspace for select
  to authenticated
  using (true);

drop policy if exists "workspace_insert_authenticated" on public.budget_workspace;
create policy "workspace_insert_authenticated"
  on public.budget_workspace for insert
  to authenticated
  with check (true);

drop policy if exists "workspace_update_authenticated" on public.budget_workspace;
create policy "workspace_update_authenticated"
  on public.budget_workspace for update
  to authenticated
  using (true)
  with check (true);

-- Resolve username → email for password login (anon-safe)
create or replace function public.get_email_for_username(p_username text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select email
  from public.profiles
  where username is not null
    and lower(username) = lower(trim(p_username))
  limit 1;
$$;

revoke all on function public.get_email_for_username(text) from public;
grant execute on function public.get_email_for_username(text) to anon, authenticated;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, preferred_role)
  values (
    new.id,
    new.email,
    nullif(lower(trim(coalesce(new.raw_user_meta_data->>'username', ''))), ''),
    coalesce(new.raw_user_meta_data->>'preferred_role', 'liz')
  )
  on conflict (id) do update
    set email = excluded.email,
        username = coalesce(excluded.username, public.profiles.username),
        preferred_role = excluded.preferred_role;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
