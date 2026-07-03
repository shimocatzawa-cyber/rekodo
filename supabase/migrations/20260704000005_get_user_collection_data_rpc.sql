-- RPC backing the Top Matches computation in /api/collectors/matches.
-- Replaces 350+ per-user HTTP round-trips with a single server-side JOIN:
-- returns artist/genre/year/country for every user in the supplied id array.
create or replace function public.get_user_collection_data(user_ids uuid[])
returns table (
  user_id uuid,
  artist  text,
  genre   text,
  year    integer,
  country text
)
language sql
security definer
set search_path = public
as $$
  select
    ur.user_id,
    r.artist,
    r.genre,
    r.year,
    r.country
  from public.user_records ur
  join public.records r on r.id = ur.record_id
  where ur.user_id = any(user_ids);
$$;

grant execute on function public.get_user_collection_data(uuid[]) to service_role;
