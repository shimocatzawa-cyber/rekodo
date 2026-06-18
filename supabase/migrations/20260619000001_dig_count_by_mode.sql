-- Add mode column to dig_daily_count and update PK + RPC

alter table public.dig_daily_count
  add column if not exists mode text not null default 'discover';

-- Swap primary key from (user_id, date) → (user_id, date, mode)
alter table public.dig_daily_count
  drop constraint if exists dig_daily_count_pkey;

alter table public.dig_daily_count
  add primary key (user_id, date, mode);

-- Recreate RPC with p_mode parameter (default keeps existing callers working)
create or replace function increment_dig_count(
  p_user_id uuid,
  p_date    date,
  p_mode    text default 'discover'
)
returns void
language sql
security definer
as $$
  insert into public.dig_daily_count (user_id, date, mode, count)
  values (p_user_id, p_date, p_mode, 1)
  on conflict (user_id, date, mode)
  do update set count = dig_daily_count.count + 1;
$$;
