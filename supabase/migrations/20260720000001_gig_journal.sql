-- ── Gig Journal ───────────────────────────────────────────────────────────────

create table if not exists public.gigs (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  date             date        not null,
  venue            text,
  city             text,
  country          text,
  journal_entry    text,
  rating           smallint    check (rating between 1 and 5),
  setlist_fm_id    text,
  setlist_source   text        not null default 'none'
                               check (setlist_source in ('setlist_fm', 'manual', 'none')),
  photo_1_url      text,
  photo_2_url      text,
  poster_url       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.gigs enable row level security;

create policy "Users manage own gigs" on public.gigs
  for all to authenticated
  using     (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── gig_artists (junction — supports festivals / support acts) ────────────────

create table if not exists public.gig_artists (
  id           uuid    primary key default gen_random_uuid(),
  gig_id       uuid    not null references public.gigs(id) on delete cascade,
  artist_name  text    not null,
  is_headliner boolean not null default true
);

alter table public.gig_artists enable row level security;

create policy "Users manage own gig artists" on public.gig_artists
  for all to authenticated
  using (
    exists (select 1 from public.gigs where id = gig_id and user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.gigs where id = gig_id and user_id = auth.uid())
  );

-- ── gig_setlist_songs ─────────────────────────────────────────────────────────

create table if not exists public.gig_setlist_songs (
  id         uuid primary key default gen_random_uuid(),
  gig_id     uuid not null references public.gigs(id) on delete cascade,
  position   int  not null,
  song_title text not null,
  set_label  text not null default 'Main Set'
);

alter table public.gig_setlist_songs enable row level security;

create policy "Users manage own setlist songs" on public.gig_setlist_songs
  for all to authenticated
  using (
    exists (select 1 from public.gigs where id = gig_id and user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.gigs where id = gig_id and user_id = auth.uid())
  );

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists gigs_user_date_idx      on public.gigs              (user_id, date desc);
create index if not exists gig_artists_gig_idx     on public.gig_artists       (gig_id);
create index if not exists gig_songs_gig_pos_idx   on public.gig_setlist_songs (gig_id, position);

-- ── Storage bucket (public so cover images render without signed URLs) ────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gig-photos', 'gig-photos', true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Users can only read/write inside their own user_id folder
create policy "Users upload own gig photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gig-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users read own gig photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'gig-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own gig photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'gig-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Service role manages gig photos" on storage.objects
  for all to service_role
  using (bucket_id = 'gig-photos');
