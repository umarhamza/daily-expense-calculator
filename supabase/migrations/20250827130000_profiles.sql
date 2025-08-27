-- Create profiles table with RLS, policies, and triggers

begin;

-- Profiles table stores per-user preferences and profile info
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text null check (char_length(display_name) between 1 and 64),
  currency text not null default 'USD' check (char_length(currency) = 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at in sync
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- RLS: only owners can read/update their row
alter table public.profiles enable row level security;

drop policy if exists "Allow select own profile" on public.profiles;
create policy "Allow select own profile"
  on public.profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "Allow update own profile" on public.profiles;
create policy "Allow update own profile"
  on public.profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

commit;

