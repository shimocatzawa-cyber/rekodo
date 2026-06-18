alter table public.label_feed
  add column if not exists price text,
  add column if not exists release_date date;
