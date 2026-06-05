-- ─── 1. list_type column ──────────────────────────────────────────────────────
-- Distinguishes "Top 5" public-shareable lists from private personal lists.

alter table public.lists
  add column if not exists list_type text not null default 'top5'
  check (list_type in ('top5', 'personal'));

-- Back-fill: all existing lists are top5.
update public.lists set list_type = 'top5' where list_type is null;

-- ─── 2. Relax position constraint ─────────────────────────────────────────────
-- Personal lists allow up to 20 items; enforce the stricter ≤5 in app code.

alter table public.list_items
  drop constraint if exists list_items_position_check;

alter table public.list_items
  add constraint list_items_position_check
  check (position >= 1 and position <= 20);

-- ─── 3. Song support in list_items ────────────────────────────────────────────
-- record_id becomes nullable; songs carry their metadata directly on the row.

alter table public.list_items
  alter column record_id drop not null;

alter table public.list_items
  add column if not exists item_type text not null default 'record'
  check (item_type in ('record', 'song'));

alter table public.list_items
  add column if not exists song_title     text,
  add column if not exists song_artist    text,
  add column if not exists song_album     text,
  add column if not exists song_cover_url text,
  add column if not exists song_year      int;

-- Ensure every row has its content: record rows need record_id, song rows need song_title.
alter table public.list_items
  drop constraint if exists list_items_content_check;

alter table public.list_items
  add constraint list_items_content_check
  check (
    (item_type = 'record' and record_id is not null) or
    (item_type = 'song'   and song_title is not null)
  );

-- ─── 4. RLS: personal lists are owner-only ────────────────────────────────────
-- The existing select policy already gates on is_public OR uid()=user_id, which
-- means personal lists (always is_public=false) are only visible to their owner.
-- No additional policy changes needed.
