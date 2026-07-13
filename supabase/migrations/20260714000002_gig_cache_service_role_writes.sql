-- gig_cache INSERT/UPDATE restricted to service_role
--
-- Any authenticated user could directly POST to the Supabase REST API
-- and poison any cache_key, injecting false event data for all users.
-- The app's /api/gigs route already checks auth; the write is switched
-- to use the service role client so the RLS policy enforces the same.

drop policy if exists "Authenticated users can insert gig cache" on public.gig_cache;
drop policy if exists "Authenticated users can update gig cache" on public.gig_cache;

-- Reads stay as authenticated (users fetch their own city's events)
-- Writes are service_role only (the /api/gigs route uses the service client)
create policy "Service role can insert gig cache"
  on public.gig_cache for insert
  to service_role
  with check (true);

create policy "Service role can update gig cache"
  on public.gig_cache for update
  to service_role
  using (true)
  with check (true);
