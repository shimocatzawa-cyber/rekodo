alter table public.turntable_posts
  add column if not exists year   text,
  add column if not exists label  text,
  add column if not exists genre  text;
