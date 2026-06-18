create table if not exists list_likes (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists list_comments (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

do $$
declare r record;
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'list_likes_uniq'
    and conrelid = 'list_likes'::regclass
  ) then
    alter table list_likes
      add constraint list_likes_uniq unique (list_id, user_id);
  end if;

  alter table list_likes enable row level security;
  alter table list_comments enable row level security;

  for r in
    select policyname, tablename from pg_policies
    where tablename in ('list_likes', 'list_comments')
    and schemaname = 'public'
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      r.policyname, r.tablename
    );
  end loop;

  execute 'create policy likes_read on list_likes for select using (true)';
  execute 'create policy likes_insert on list_likes for insert with check (auth.uid() = user_id)';
  execute 'create policy likes_delete on list_likes for delete using (auth.uid() = user_id)';
  execute 'create policy comments_read on list_comments for select using (true)';
  execute 'create policy comments_insert on list_comments for insert with check (auth.uid() = user_id)';
  execute 'create policy comments_delete on list_comments for delete using (auth.uid() = user_id or auth.uid() = (select user_id from lists where id = list_id))';

  create index if not exists list_likes_list_id_idx on list_likes (list_id);
  create index if not exists list_comments_list_id_idx on list_comments (list_id);
end $$;
