create table if not exists mixtapes (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  title         text        not null default '',
  cassette_type text        not null default 'C60',
  side_a        jsonb       not null default '[]',
  side_b        jsonb       not null default '[]',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table mixtapes enable row level security;

create policy "mixtapes_owner_all"
  on mixtapes for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_mixtapes_user_created on mixtapes (user_id, created_at desc);

grant select, insert, update, delete on mixtapes to authenticated;
