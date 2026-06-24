-- Per-user favourited artists in Deep Dive, separate from deep_dive_sessions
-- (which just tracks last-viewed for caching/recency, not an explicit signal).

create table if not exists public.deep_dive_favorites (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  artist     text        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, artist)
);

alter table public.deep_dive_favorites enable row level security;

create policy "Users can read own deep dive favorites"
  on public.deep_dive_favorites for select
  using (auth.uid() = user_id);

create policy "Users can insert own deep dive favorites"
  on public.deep_dive_favorites for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own deep dive favorites"
  on public.deep_dive_favorites for delete
  using (auth.uid() = user_id);
