create table public.dig_recommendation_cache (
  id                     uuid        default gen_random_uuid() primary key,
  user_id                uuid        references auth.users(id) on delete cascade not null,
  mode                   text        not null check (mode in ('discover', 'style')),
  style                  text,
  artist                 text        not null,
  album                  text        not null,
  year                   integer,
  genre                  text,
  region                 text,
  sub_style              text,
  reason                 text,
  bandcamp_search_url    text,
  spotify_search_url     text,
  apple_music_search_url text,
  shown_at               timestamptz,
  created_at             timestamptz default now() not null
);

alter table public.dig_recommendation_cache enable row level security;

create policy "Users manage own dig cache"
  on public.dig_recommendation_cache for all
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index dig_recommendation_cache_lookup
  on public.dig_recommendation_cache (user_id, mode, style, shown_at, created_at);

grant all on public.dig_recommendation_cache to authenticated;
grant all on public.dig_recommendation_cache to service_role;
