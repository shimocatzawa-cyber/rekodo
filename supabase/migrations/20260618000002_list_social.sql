-- List likes
create table if not exists list_likes (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references lists(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (list_id, user_id)
);

alter table list_likes enable row level security;

create policy "anyone can read likes"  on list_likes for select using (true);
create policy "owner can insert like"  on list_likes for insert with check (auth.uid() = user_id);
create policy "owner can delete like"  on list_likes for delete using (auth.uid() = user_id);

-- List comments
create table if not exists list_comments (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references lists(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table list_comments enable row level security;

create policy "anyone can read comments"    on list_comments for select using (true);
create policy "auth users can comment"      on list_comments for insert with check (auth.uid() = user_id);
create policy "owner can delete comment"    on list_comments for delete using (
  auth.uid() = user_id or
  auth.uid() = (select user_id from lists where id = list_id)
);

-- Indexes
create index if not exists list_likes_list_id_idx    on list_likes(list_id);
create index if not exists list_comments_list_id_idx on list_comments(list_id);
