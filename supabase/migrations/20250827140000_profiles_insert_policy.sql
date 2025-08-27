-- Add RLS insert policy for public.profiles to allow users to create their own row

begin;

drop policy if exists "Allow insert own profile" on public.profiles;
create policy "Allow insert own profile"
  on public.profiles
  for insert
  with check (auth.uid() = user_id);

commit;

