-- Add optional currency_symbol to profiles for custom display symbol (e.g., 'D')
alter table if exists public.profiles
  add column if not exists currency_symbol text null check (char_length(currency_symbol) between 1 and 4);

comment on column public.profiles.currency_symbol is 'Optional display symbol override (1-4 chars), e.g., D';
