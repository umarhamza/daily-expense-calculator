-- Drop currency column from profiles; keep currency_symbol intact
alter table if exists public.profiles
  drop column if exists currency;

