-- SECURITY DEFINER function so favourite_tracks updates bypass PostgREST
-- schema-cache issues with the text[] column.  Mirrors the increment_play_count
-- pattern: caller passes p_user_id and the function verifies it matches auth.uid().

create or replace function public.set_favourite_tracks(
  p_user_id   uuid,
  p_record_id uuid,
  p_tracks    text[]
)
returns void
language sql
security definer
as $$
  update public.user_records
  set    favourite_tracks = p_tracks
  where  user_id   = p_user_id
    and  record_id = p_record_id
    and  p_user_id = auth.uid();
$$;

grant execute on function public.set_favourite_tracks(uuid, uuid, text[]) to authenticated;
