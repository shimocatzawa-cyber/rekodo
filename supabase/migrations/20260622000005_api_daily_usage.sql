-- Generic per-user daily usage counter for Anthropic-calling routes, same
-- pattern as dig_daily_count (api/dig/route.ts) but keyed by route name so
-- any endpoint can opt in without a dedicated table. Without this, a single
-- scripted account could call playlist/generate, deep-dive, archetypes/essay,
-- etc. in a tight loop with no ceiling on Anthropic spend.

create table if not exists public.api_daily_usage (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  date       date        not null default current_date,
  route      text        not null,
  count      integer     not null default 0,
  primary key (user_id, date, route)
);

alter table public.api_daily_usage enable row level security;

drop policy if exists "Users can read own api usage" on public.api_daily_usage;
create policy "Users can read own api usage"
  on public.api_daily_usage for select
  using (auth.uid() = user_id);

-- Atomic upsert-and-increment, called by API routes (runs as service role via
-- security definer so it works regardless of which client the route uses).
create or replace function increment_api_usage(p_user_id uuid, p_date date, p_route text)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.api_daily_usage (user_id, date, route, count)
  values (p_user_id, p_date, p_route, 1)
  on conflict (user_id, date, route)
  do update set count = api_daily_usage.count + 1
  returning count;
$$;
