-- Track which artists each user has deep-dived into

create table if not exists public.deep_dive_sessions (
  user_id        uuid        not null references auth.users(id) on delete cascade,
  artist         text        not null,
  last_viewed_at timestamptz not null default now(),
  primary key (user_id, artist)
);

alter table public.deep_dive_sessions enable row level security;

create policy "Users can read own deep dive sessions"
  on public.deep_dive_sessions for select
  using (auth.uid() = user_id);

-- Service role upserts from the API route
