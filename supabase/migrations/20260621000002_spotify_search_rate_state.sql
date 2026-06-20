-- Global (cross-user, cross-invocation) circuit breaker + pacing for Spotify
-- /v1/search calls. The matcher worker previously had no shared awareness of
-- a 429 across concurrent invocations (one per active user) and kept calling
-- Spotify for the rest of its batch even after hitting one — almost
-- certainly why one bad pass earned the whole app a ~13.5 hour ban instead
-- of a few seconds. This table lets every caller (the worker, and the
-- Collection page's live search) check/extend one shared cooldown, and lets
-- every concurrent caller claim a globally-paced slot instead of only pacing
-- itself against its own calls.

create table if not exists public.spotify_search_rate_state (
  id              text primary key default 'singleton',
  cooldown_until  timestamptz not null default now(),
  next_call_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint spotify_search_rate_state_singleton check (id = 'singleton')
);

insert into public.spotify_search_rate_state (id)
values ('singleton')
on conflict (id) do nothing;

-- Locked down by default (RLS enabled, no policies) — only service_role
-- (which bypasses RLS, and already has table grants via the default
-- privileges set up in 20260621000001) reads/writes this, via the worker and
-- one narrow status-check route. No direct client/PostgREST access.
alter table public.spotify_search_rate_state enable row level security;

create or replace function public.claim_spotify_search_slot(step_ms int default 200)
returns timestamptz
language plpgsql
as $$
declare
  assigned timestamptz;
begin
  update public.spotify_search_rate_state
  set next_call_at = greatest(next_call_at, now()) + (step_ms || ' milliseconds')::interval,
      updated_at    = now()
  where id = 'singleton'
  returning next_call_at - (step_ms || ' milliseconds')::interval into assigned;
  return assigned;
end;
$$;

create or replace function public.set_spotify_search_cooldown(retry_after_sec int)
returns void
language plpgsql
as $$
begin
  update public.spotify_search_rate_state
  set cooldown_until = greatest(cooldown_until, now() + (retry_after_sec || ' seconds')::interval),
      updated_at      = now()
  where id = 'singleton';
end;
$$;

grant execute on function public.claim_spotify_search_slot(int) to service_role;
grant execute on function public.set_spotify_search_cooldown(int) to service_role;
