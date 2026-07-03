create table if not exists public.spotlights (
  id              uuid        primary key default uuid_generate_v4(),
  type            text        not null check (type in ('artist', 'label')),
  month           text        not null,
  status          text        not null default 'draft'
                              check (status in ('draft', 'active', 'archived')),
  name            text        not null,
  discogs_id      text        not null,
  subtitle        text        not null default '',
  meta            jsonb       not null default '{}',
  bio             jsonb       not null default '[]',
  releases        jsonb       not null default '[]',
  collector_notes jsonb       not null default '[]',
  neighbors       jsonb       not null default '[]',
  rekoodos_pick   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (type, month)
);

alter table public.spotlights enable row level security;

create policy "Authenticated users can read published spotlights"
  on public.spotlights for select to authenticated
  using (status in ('active', 'archived'));

grant all on public.spotlights to service_role;
