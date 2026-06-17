alter table user_records
  add column if not exists play_count integer not null default 0;

-- RPC called by the /api/collection/played route to atomically
-- increment play_count and set last_played_at in one statement.
create or replace function increment_play_count(
  p_user_id   uuid,
  p_record_id uuid
)
returns void
language sql
security definer
as $$
  update user_records
  set
    play_count    = play_count + 1,
    last_played_at = now()
  where user_id   = p_user_id
    and record_id = p_record_id;
$$;
