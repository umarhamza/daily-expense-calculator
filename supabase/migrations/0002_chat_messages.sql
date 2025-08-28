create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  token_count int null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_chat_created_idx on public.chat_messages (chat_id, created_at asc);
create index if not exists chat_messages_user_created_idx on public.chat_messages (user_id, created_at desc);

alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own" on public.chat_messages for select using (auth.uid() = user_id);

drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own" on public.chat_messages for insert with check (auth.uid() = user_id);

drop policy if exists "chat_messages_delete_own" on public.chat_messages;
create policy "chat_messages_delete_own" on public.chat_messages for delete using (auth.uid() = user_id);

