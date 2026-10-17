create table public.turntable_posts (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  published_at date not null default current_date,
  artist       text not null,
  album        text not null,
  cover_url    text,
  body         text not null default '',
  status       text not null default 'draft' check (status in ('draft', 'published'))
);

alter table public.turntable_posts enable row level security;

create policy "authenticated users can read published turntable posts"
  on public.turntable_posts for select
  to authenticated
  using (status = 'published');

grant select on public.turntable_posts to authenticated;
