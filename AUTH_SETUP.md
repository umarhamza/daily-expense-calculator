## Auth Setup (Supabase + Netlify)

This app uses Supabase Auth (email/password) and stores expenses per user. Follow these steps to configure Supabase and Netlify.

### Supabase

- **Create project**
  - In Supabase, create a new project. Copy your Project URL and anon public key.

- **Auth URL configuration**
  - In Supabase Dashboard → Auth → URL Configuration:
    - **Site URL**: set to your production URL (e.g., `https://<your-site>.netlify.app`).
    - **Additional Redirect URLs**: add local dev `http://localhost:5173` (Vite default).
  - These are used for email confirmation and OAuth redirects.

- **Database: expenses table + RLS**
  - Run the SQL below in Supabase SQL Editor. It creates the `expenses` table and row-level security policies so users only see their own data.

```sql
-- Ensure pgcrypto is available for gen_random_uuid (usually enabled by default in Supabase)
-- create extension if not exists pgcrypto;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item text not null,
  cost numeric(12,2) not null check (cost >= 0),
  date date not null,
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;

-- Read own
create policy if not exists "read_own_expenses"
  on public.expenses for select
  using (auth.uid() = user_id);

-- Insert own
create policy if not exists "insert_own_expenses"
  on public.expenses for insert
  with check (auth.uid() = user_id);

-- (Optional) Update/Delete own if you later add those features
-- create policy if not exists "update_own_expenses"
--   on public.expenses for update
--   using (auth.uid() = user_id);
-- create policy if not exists "delete_own_expenses"
--   on public.expenses for delete
--   using (auth.uid() = user_id);
```

- **(Optional) Google OAuth**
  - Auth → Providers → Google → enable and add client credentials.
  - Allowed callback/redirects must include your Site URL and `http://localhost:5173`.
  - UI wiring can be added later; backend redirects must be correct now.

### Netlify

- **Environment variables** (Site settings → Build & deploy → Environment)
  - `VITE_SUPABASE_URL` = your Supabase Project URL
  - `VITE_SUPABASE_ANON_KEY` = your Supabase anon public key
  - Save and redeploy when these change.

- **Build settings**
  - Build command and publish dir are already set in `netlify.toml`.
  - SPA routing redirect is included:

```toml
[[redirects]]
from = "/*"
to = "/index.html"
status = 200
```

### Local development

- Create a `.env` in project root (not committed):

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- Start dev server: `npm run dev` (defaults to `http://localhost:5173`).

### Verify

- **Sign up** with an email/password in the app.
- Confirm the email (if email confirmations are enabled) and return to the app; you should be logged in.
- Add an expense; it should appear only for the current user, and in Supabase `public.expenses` with the correct `user_id`.
- Log out; you should be redirected back to the login form.

### Notes

- Use only the anon public key in the client. Never expose the service role key.
- If you see 401/permission errors: verify RLS policies, the `user_id` column values, and Auth redirect URLs.
- Vite requires the `VITE_` prefix for env vars to be exposed to the client.