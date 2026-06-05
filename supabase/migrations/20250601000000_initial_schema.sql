-- rekōdo initial schema
-- Baseline migration representing the schema already applied to the remote DB.
-- After linking, mark this as applied without re-running it:
--   supabase migration repair --status applied 20250601000000

-- ─── extensions ───────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- ─── profiles ─────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are publicly readable"  on public.profiles;
drop policy if exists "Users can update own profile"    on public.profiles;
drop policy if exists "Users can insert own profile"    on public.profiles;

create policy "Profiles are publicly readable"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── records ──────────────────────────────────────────────────────────────────

create table if not exists public.records (
  id          uuid primary key default uuid_generate_v4(),
  discogs_id  text unique,
  artist      text not null,
  album       text not null,
  year        int,
  genre       text,
  cover_url   text,
  label       text,
  created_at  timestamptz not null default now()
);

alter table public.records enable row level security;

drop policy if exists "Records are publicly readable"          on public.records;
drop policy if exists "Authenticated users can insert records" on public.records;

create policy "Records are publicly readable"
  on public.records for select using (true);

create policy "Authenticated users can insert records"
  on public.records for insert with check (auth.role() = 'authenticated');

-- ─── user_records ─────────────────────────────────────────────────────────────

create table if not exists public.user_records (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  record_id   uuid not null references public.records(id) on delete cascade,
  value       numeric(10, 2),
  plays       int not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, record_id)
);

alter table public.user_records enable row level security;

drop policy if exists "Users can read own collection"         on public.user_records;
drop policy if exists "Users can insert into own collection"  on public.user_records;
drop policy if exists "Users can update own collection"       on public.user_records;
drop policy if exists "Users can delete from own collection"  on public.user_records;

create policy "Users can read own collection"
  on public.user_records for select using (auth.uid() = user_id);

create policy "Users can insert into own collection"
  on public.user_records for insert with check (auth.uid() = user_id);

create policy "Users can update own collection"
  on public.user_records for update using (auth.uid() = user_id);

create policy "Users can delete from own collection"
  on public.user_records for delete using (auth.uid() = user_id);

-- ─── lists ────────────────────────────────────────────────────────────────────

create table if not exists public.lists (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  slug        text not null,
  is_public   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (user_id, slug)
);

alter table public.lists enable row level security;

drop policy if exists "Public lists are readable by anyone" on public.lists;
drop policy if exists "Users can insert own lists"          on public.lists;
drop policy if exists "Users can update own lists"          on public.lists;
drop policy if exists "Users can delete own lists"          on public.lists;

create policy "Public lists are readable by anyone"
  on public.lists for select using (is_public = true or auth.uid() = user_id);

create policy "Users can insert own lists"
  on public.lists for insert with check (auth.uid() = user_id);

create policy "Users can update own lists"
  on public.lists for update using (auth.uid() = user_id);

create policy "Users can delete own lists"
  on public.lists for delete using (auth.uid() = user_id);

-- ─── list_items ───────────────────────────────────────────────────────────────

create table if not exists public.list_items (
  id          uuid primary key default uuid_generate_v4(),
  list_id     uuid not null references public.lists(id) on delete cascade,
  record_id   uuid not null references public.records(id) on delete cascade,
  position    int not null check (position between 1 and 5),
  created_at  timestamptz not null default now(),
  unique (list_id, position)
);

alter table public.list_items enable row level security;

drop policy if exists "List items follow list visibility"    on public.list_items;
drop policy if exists "Users can manage items in own lists"  on public.list_items;
drop policy if exists "Users can update items in own lists"  on public.list_items;
drop policy if exists "Users can delete items in own lists"  on public.list_items;

create policy "List items follow list visibility"
  on public.list_items for select using (
    exists (
      select 1 from public.lists l
      where l.id = list_id
        and (l.is_public = true or auth.uid() = l.user_id)
    )
  );

create policy "Users can manage items in own lists"
  on public.list_items for insert with check (
    exists (
      select 1 from public.lists l
      where l.id = list_id and l.user_id = auth.uid()
    )
  );

create policy "Users can update items in own lists"
  on public.list_items for update using (
    exists (
      select 1 from public.lists l
      where l.id = list_id and l.user_id = auth.uid()
    )
  );

create policy "Users can delete items in own lists"
  on public.list_items for delete using (
    exists (
      select 1 from public.lists l
      where l.id = list_id and l.user_id = auth.uid()
    )
  );

-- ─── waitlist_emails ──────────────────────────────────────────────────────────

create table if not exists public.waitlist_emails (
  id          uuid primary key default uuid_generate_v4(),
  email       text not null unique,
  created_at  timestamptz not null default now()
);

alter table public.waitlist_emails enable row level security;

drop policy if exists "Anyone can join waitlist" on public.waitlist_emails;

create policy "Anyone can join waitlist"
  on public.waitlist_emails for insert with check (true);
