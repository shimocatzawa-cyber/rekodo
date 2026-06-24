-- Lets admins flag an account as a test account so it can be excluded from
-- Community discovery surfaces (All Collectors, Top Matches candidates)
-- without affecting anything else about the account.

alter table public.profiles
  add column if not exists is_test boolean not null default false;

-- Readable by anon/authenticated so client-side discovery queries (e.g. the
-- Community tab's "All Collectors" list) can filter on it directly. Writes
-- go through the admin-only service-role action, same as role/subscription_tier,
-- so no insert/update grant is needed here.
grant select (is_test) on public.profiles to anon, authenticated;
