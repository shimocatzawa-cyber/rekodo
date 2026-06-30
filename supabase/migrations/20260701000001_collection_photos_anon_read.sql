-- collection_photos has a SELECT policy USING (true) — intended to be publicly
-- readable (e.g. profile pages at /p/[username] visited by logged-out users).
-- The original migration only granted to authenticated + service_role, so
-- unauthenticated visitors got "permission denied" before RLS could even run.
grant select on public.collection_photos to anon;
