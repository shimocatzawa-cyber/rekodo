-- Persistent record of past Dig recommendations, used to stop repeats across
-- sessions/devices (previously only de-duped in-memory for the current tab).
create table if not exists public.dig_history (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  artist      text        not null,
  album       text        not null,
  mode        text        not null default 'discover',
  created_at  timestamptz not null default now()
);

create index if not exists dig_history_user_id_idx on public.dig_history (user_id, created_at desc);

alter table public.dig_history enable row level security;

create policy "Users can read own dig history"
  on public.dig_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own dig history"
  on public.dig_history for insert
  with check (auth.uid() = user_id);
