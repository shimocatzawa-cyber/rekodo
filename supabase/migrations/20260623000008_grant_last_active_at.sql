-- profiles.last_active_at (added in 20260623000004) was never added to the
-- explicit column-grant allow-list that 20260622000011 set up for
-- anon/authenticated — that migration revoked the table-level grant
-- entirely and re-granted column-by-column, listing only the columns that
-- existed at the time. Every middleware ping since has been silently
-- rejected with "permission denied for column last_active_at" (the update
-- call in middleware.ts didn't check the error), so the column has stayed
-- null for everyone despite the feature shipping successfully.
--
-- Mirrors last_synced_at's treatment (the closest existing analogue —
-- another non-sensitive, server-bumped timestamp) across select/insert/update.

grant select (last_active_at) on public.profiles to anon, authenticated;
grant insert (last_active_at) on public.profiles to authenticated;
grant update (last_active_at) on public.profiles to authenticated;

-- page_views is a new table, not subject to that lockdown — but this
-- project has twice now lost an *expected* default grant on a freshly
-- created table (profiles' service_role grant in 20260616000007, then
-- list_items' in 20260621000001). Grant explicitly rather than trust the
-- default applied. RLS (20260623000005) still restricts each user to
-- inserting only their own rows.
grant insert on public.page_views to authenticated;
