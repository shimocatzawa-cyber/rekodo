alter table public.user_records
  add column if not exists last_cleaned_at timestamptz default null;
