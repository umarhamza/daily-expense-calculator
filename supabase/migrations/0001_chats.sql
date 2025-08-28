create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chats_user_created_idx on public.chats (user_id, created_at desc);

alter table public.chats enable row level security;

drop policy if exists "chats_select_own" on public.chats;
create policy "chats_select_own" on public.chats for select using (auth.uid() = user_id);

drop policy if exists "chats_insert_own" on public.chats;
create policy "chats_insert_own" on public.chats for insert with check (auth.uid() = user_id);

drop policy if exists "chats_delete_own" on public.chats;
create policy "chats_delete_own" on public.chats for delete using (auth.uid() = user_id);

-- optional: keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists chats_touch_updated_at on public.chats;
create trigger chats_touch_updated_at
before update on public.chats
for each row execute function public.touch_updated_at();

