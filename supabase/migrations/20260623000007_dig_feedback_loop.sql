-- Feedback loop for Dig: track which outside-collection picks a collector
-- actually acted on (wantlisted, or later added to their real collection)
-- vs. ones shown repeatedly and ignored, so future digs can lean into what
-- works and ease off what doesn't.

alter table public.dig_history
  add column if not exists genre text,
  add column if not exists region text,
  add column if not exists wantlisted_at timestamptz,
  add column if not exists collected_at timestamptz;

-- Wantlist-adds sourced from Dig flow through list_items with source = 'dig',
-- whether inserted via the API route or directly from the client. A trigger
-- catches both paths instead of having to thread tracking into each one.
create or replace function public.mark_dig_wantlisted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if NEW.source = 'dig' and NEW.song_artist is not null and NEW.song_album is not null then
    select user_id into v_user_id from public.lists where id = NEW.list_id;
    if v_user_id is not null then
      update public.dig_history
      set wantlisted_at = now()
      where user_id = v_user_id
        and wantlisted_at is null
        and lower(artist) = lower(NEW.song_artist)
        and lower(album) = lower(NEW.song_album);
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_mark_dig_wantlisted on public.list_items;
create trigger trg_mark_dig_wantlisted
  after insert on public.list_items
  for each row
  execute function public.mark_dig_wantlisted();

-- A Dig pick later showing up in the collector's real collection (manual add,
-- Discogs sync, CSV import — anything that lands a row in user_records) is the
-- strongest possible positive signal: they actually bought the record.
create or replace function public.mark_dig_collected()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_artist text;
  v_album  text;
begin
  select artist, album into v_artist, v_album from public.records where id = NEW.record_id;
  if v_artist is not null and v_album is not null then
    update public.dig_history
    set collected_at = now()
    where user_id = NEW.user_id
      and collected_at is null
      and lower(artist) = lower(v_artist)
      and lower(album) = lower(v_album);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_mark_dig_collected on public.user_records;
create trigger trg_mark_dig_collected
  after insert on public.user_records
  for each row
  execute function public.mark_dig_collected();
