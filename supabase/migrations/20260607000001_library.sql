-- collection_intelligence
create table collection_intelligence (
  user_id uuid primary key references auth.users(id),
  top_artists jsonb,
  top_labels jsonb,
  top_genres jsonb,
  top_decades jsonb,
  top_countries jsonb,
  taste_summary text,
  last_computed_at timestamptz default now()
);

alter table collection_intelligence enable row level security;

create policy "Users can read own intelligence" on collection_intelligence
  for select using (auth.uid() = user_id);
create policy "Users can insert own intelligence" on collection_intelligence
  for insert with check (auth.uid() = user_id);
create policy "Users can update own intelligence" on collection_intelligence
  for update using (auth.uid() = user_id);

-- library_recommendations
create table library_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  format text check (format in ('podcast', 'book', 'audible')),
  title text not null,
  creator text,
  description text,
  match_reason text,
  match_artists text[],
  match_labels text[],
  external_url text,
  affiliate_url text,
  thumbnail_url text,
  source_api text,
  source_id text,
  artist_coverage_depth text check (artist_coverage_depth in ('dedicated', 'primary', 'passing')),
  relevance_score int,
  created_at timestamptz default now()
);

alter table library_recommendations enable row level security;

create policy "Users can read own recommendations" on library_recommendations
  for select using (auth.uid() = user_id);
create policy "Users can insert own recommendations" on library_recommendations
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own recommendations" on library_recommendations
  for delete using (auth.uid() = user_id);

-- library_wantlist
create table library_wantlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  recommendation_id uuid references library_recommendations(id),
  format text check (format in ('podcast', 'book', 'audible')),
  title text,
  creator text,
  external_url text,
  affiliate_url text,
  thumbnail_url text,
  match_reason text,
  status text default 'saved' check (status in ('saved', 'in_progress', 'done')),
  added_at timestamptz default now(),
  actioned_at timestamptz
);

alter table library_wantlist enable row level security;

create policy "Users can read own wantlist" on library_wantlist
  for select using (auth.uid() = user_id);
create policy "Users can insert own wantlist" on library_wantlist
  for insert with check (auth.uid() = user_id);
create policy "Users can update own wantlist" on library_wantlist
  for update using (auth.uid() = user_id);
create policy "Users can delete own wantlist" on library_wantlist
  for delete using (auth.uid() = user_id);
