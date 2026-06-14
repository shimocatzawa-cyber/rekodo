-- Create digital_imports table if it doesn't exist, and ensure the unique
-- constraint the bandcamp-import route depends on is in place.

create table if not exists digital_imports (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  source            text not null,
  artist            text not null,
  album             text not null,
  is_duplicate      boolean not null default false,
  matched_record_id uuid references records(id) on delete set null,
  imported_at       timestamptz not null default now()
);

-- Unique constraint required for the upsert onConflict clause
alter table digital_imports
  drop constraint if exists digital_imports_user_source_artist_album_key;

alter table digital_imports
  add constraint digital_imports_user_source_artist_album_key
  unique (user_id, source, artist, album);

-- RLS
alter table digital_imports enable row level security;

drop policy if exists "Users can read own imports"  on digital_imports;
drop policy if exists "Users can write own imports" on digital_imports;
drop policy if exists "Users can delete own imports" on digital_imports;

create policy "Users can read own imports"
  on digital_imports for select
  using (auth.uid() = user_id);

create policy "Users can write own imports"
  on digital_imports for insert
  with check (auth.uid() = user_id);

create policy "Users can update own imports"
  on digital_imports for update
  using (auth.uid() = user_id);

create policy "Users can delete own imports"
  on digital_imports for delete
  using (auth.uid() = user_id);

-- Index for fast user lookups
create index if not exists digital_imports_user_source_idx
  on digital_imports (user_id, source);
