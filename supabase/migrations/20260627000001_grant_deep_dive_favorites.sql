-- RLS policies alone don't grant access — Postgres still requires the base
-- table-level GRANT before RLS gets a chance to filter rows. This table's
-- migration (20260626000001) added the RLS policies but never granted the
-- underlying SELECT/INSERT/DELETE to `authenticated`, so every client-side
-- write was silently rejected with "permission denied for table" and the
-- favourite never persisted past a page reload.
grant select, insert, delete on public.deep_dive_favorites to authenticated;
