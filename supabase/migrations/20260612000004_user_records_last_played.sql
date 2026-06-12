alter table user_records
  add column if not exists last_played_at timestamptz;
