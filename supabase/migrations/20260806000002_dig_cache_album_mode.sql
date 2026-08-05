-- Extend the mode check constraint to include album dig
alter table public.dig_recommendation_cache
  drop constraint dig_recommendation_cache_mode_check;

alter table public.dig_recommendation_cache
  add constraint dig_recommendation_cache_mode_check
  check (mode in ('discover', 'style', 'album'));
