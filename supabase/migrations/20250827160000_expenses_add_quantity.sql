-- Add quantity column to public.expenses
alter table if exists public.expenses
  add column if not exists quantity integer not null default 1 check (quantity >= 1);

-- Backfill: if item ends with a quantity suffix like " xN" or "xN" or "×N", set quantity
update public.expenses
set quantity = greatest(1, coalesce((regexp_match(item, '\\s*[xX×]\\s*(\\d+)\\s*$'))[1]::int, 1))
where item ~ '\\s*[xX×]\\s*\\d+\\s*$';

-- Normalize item names by removing trailing quantity suffixes
update public.expenses
set item = trim(regexp_replace(item, '\\s*[xX×]\\s*\\d+\\s*$', '', ''))
where item ~ '\\s*[xX×]\\s*\\d+\\s*$';

