create table if not exists public.payments (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        references auth.users(id) on delete cascade,
  stripe_session_id text       unique not null,
  type             text        not null check (type in ('subscription', 'donation')),
  amount_cents     integer     not null,
  currency         text        not null default 'usd',
  created_at       timestamptz not null default now()
);

create index if not exists payments_user_id_idx on public.payments(user_id);

alter table public.payments enable row level security;

-- Service role bypasses RLS; no need for a user-facing policy here
