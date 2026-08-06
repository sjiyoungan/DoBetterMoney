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
  preferred_role text not null default 'liz'
    check (preferred_role in ('liz', 'ji')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

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

create policy "workspace_select_authenticated"
  on public.budget_workspace for select
  to authenticated
  using (true);

create policy "workspace_insert_authenticated"
  on public.budget_workspace for insert
  to authenticated
  with check (true);

create policy "workspace_update_authenticated"
  on public.budget_workspace for update
  to authenticated
  using (true)
  with check (true);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, preferred_role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'preferred_role', 'liz')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
