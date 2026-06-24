-- Activity feed: append-only event log for plays, wantlist adds, and collection adds.
-- Unlike user_records/list_items, plays have no history today (last_played_at just
-- gets overwritten), so the "Collectors I Follow" feed needs its own log.

create table public.activity_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  event_type  text not null check (event_type in ('play', 'wantlist_add', 'collection_add')),
  record_id   uuid not null references public.records(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index activity_events_user_created_idx on public.activity_events (user_id, created_at desc);

alter table public.activity_events enable row level security;

create policy "Users can log their own activity"
  on public.activity_events for insert
  with check (auth.uid() = user_id);

create policy "Followers can read followed users' activity"
  on public.activity_events for select
  using (
    exists (
      select 1 from public.follows
      where follows.follower_id = auth.uid()
        and follows.following_id = activity_events.user_id
    )
  );
