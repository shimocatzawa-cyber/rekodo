create table if not exists public.dig_daily_count (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  date       date        not null default current_date,
  count      integer     not null default 0,
  primary key (user_id, date)
);

alter table public.dig_daily_count enable row level security;

create policy "Users can read own dig counts"
  on public.dig_daily_count for select
  using (auth.uid() = user_id);

-- Atomic upsert-and-increment called by the API route (runs as service role)
create or replace function increment_dig_count(p_user_id uuid, p_date date)
returns void
language sql
security definer
as $$
  insert into public.dig_daily_count (user_id, date, count)
  values (p_user_id, p_date, 1)
  on conflict (user_id, date)
  do update set count = dig_daily_count.count + 1;
$$;
