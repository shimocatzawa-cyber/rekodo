create table if not exists public.waitlist (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null unique,
  name       text,
  created_at timestamptz not null default now()
);

-- No RLS — inserts go through a server action using service role only.
-- anon/authenticated should not touch this table directly.
alter table public.waitlist enable row level security;

grant all on public.waitlist to service_role;
