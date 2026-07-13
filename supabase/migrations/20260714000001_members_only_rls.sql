-- ─────────────────────────────────────────────────────────────────────────────
-- Members-only RLS hardening
--
-- rekōdo is now a members-only platform. This migration closes all gaps where
-- unauthenticated visitors (anon role) or any authenticated user could read
-- data they shouldn't have access to.
--
-- Findings from the 2026-07-14 audit:
--   Critical : profiles (stripe_customer_id + all fields) readable by anon
--   Critical : public_collection_summary, public_essentials, public_sell_list
--              views grant SELECT to anon
--   Critical : get_user_collection_data() granted to authenticated — any
--              logged-in user could dump any other user's full collection
--   Critical : get_follower_affinity / get_suggested_collectors are SECURITY
--              DEFINER and grantable to public by default
--   Medium   : lists, list_items, follows, compatibility_scores, label_feed,
--              all likes tables — SELECT policies use USING (true) with no
--              role restriction, so anon can read via PostgREST
--   Medium   : payments table has no owner SELECT policy (safe by accident)
--   Low      : increment_play_count has no auth.uid() ownership check
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Profiles ───────────────────────────────────────────────────────────────

-- Change SELECT policy to require authentication.
-- The existing column-level grant (from 20260622000011) still gives anon
-- the column permissions, but with this policy anon gets zero rows.
-- Belt-and-suspenders: also revoke the column-level SELECT from anon so
-- PostgREST denies the request before RLS even runs.

drop policy if exists "Profiles are publicly readable" on public.profiles;

create policy "Profiles are readable by members"
  on public.profiles for select
  to authenticated
  using (true);

revoke select on public.profiles from anon;


-- ── 2. Views — revoke anon SELECT ─────────────────────────────────────────────

revoke select on public.public_collection_summary from anon;
revoke select on public.public_essentials         from anon;

-- public_sell_list may not exist yet in all environments; guard with DO block
do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relname = 'public_sell_list' and n.nspname = 'public'
  ) then
    revoke select on public.public_sell_list from anon;
  end if;
end $$;

-- collection_photos was explicitly opened to anon in 20260701000001 for
-- profile page browsing by logged-out users. Now that the app is members-only,
-- revoke that grant.
revoke select on public.collection_photos from anon;


-- ── 3. RPCs — tighten caller permissions ──────────────────────────────────────

-- get_user_collection_data: only the service role (batch-scores route) should
-- call this. Authenticated users calling it could read any other user's full
-- collection metadata via SECURITY DEFINER bypass.
revoke execute on function public.get_user_collection_data(uuid[]) from authenticated;

-- get_follower_affinity / get_suggested_collectors: SECURITY DEFINER functions
-- that read any user's collection. Not currently used in the app; revoke from
-- public and restrict to service_role only.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'get_follower_affinity' and pronamespace = 'public'::regnamespace) then
    revoke execute on function public.get_follower_affinity(uuid) from public;
    grant  execute on function public.get_follower_affinity(uuid) to service_role;
  end if;
  if exists (select 1 from pg_proc where proname = 'get_suggested_collectors' and pronamespace = 'public'::regnamespace) then
    revoke execute on function public.get_suggested_collectors(uuid, int) from public;
    grant  execute on function public.get_suggested_collectors(uuid, int) to service_role;
  end if;
end $$;

-- increment_play_count: add caller-ownership guard so no authenticated user
-- can inflate another user's play counts.
create or replace function public.increment_play_count(
  p_user_id   uuid,
  p_record_id uuid
)
returns void
language sql
security definer
as $$
  update public.user_records
  set play_count     = play_count + 1,
      last_played_at = now()
  where user_id   = p_user_id
    and record_id = p_record_id
    and p_user_id = auth.uid();
$$;


-- ── 4. Social tables — scope SELECT to authenticated ──────────────────────────

-- follows
drop policy if exists "Public follows are viewable by everyone" on public.follows;
drop policy if exists "Follows are publicly readable"           on public.follows;

create policy "Follows are readable by members"
  on public.follows for select
  to authenticated
  using (true);

-- compatibility_scores
drop policy if exists "Scores are publicly readable"       on public.compatibility_scores;
drop policy if exists "Compatibility scores are readable"  on public.compatibility_scores;

create policy "Scores are readable by members"
  on public.compatibility_scores for select
  to authenticated
  using (true);

-- label_feed
drop policy if exists "public read" on public.label_feed;

create policy "Label feed readable by members"
  on public.label_feed for select
  to authenticated
  using (true);

-- list_likes
drop policy if exists "likes_read" on public.list_likes;

create policy "likes_read"
  on public.list_likes for select
  to authenticated
  using (true);

-- list_comments
drop policy if exists "comments_read" on public.list_comments;

create policy "comments_read"
  on public.list_comments for select
  to authenticated
  using (true);

-- collection_photo_likes
drop policy if exists "Anyone can read photo likes" on public.collection_photo_likes;

create policy "Photo likes readable by members"
  on public.collection_photo_likes for select
  to authenticated
  using (true);

-- essentials_wall_likes
drop policy if exists "Anyone can read essentials wall likes" on public.essentials_wall_likes;

create policy "Essentials wall likes readable by members"
  on public.essentials_wall_likes for select
  to authenticated
  using (true);

-- shelf_post_likes
drop policy if exists "Anyone can read shelf post likes" on public.shelf_post_likes;

create policy "Shelf post likes readable by members"
  on public.shelf_post_likes for select
  to authenticated
  using (true);


-- ── 5. Lists and list items — scope to authenticated ──────────────────────────

drop policy if exists "Public lists are readable by anyone" on public.lists;

create policy "Lists are readable by members"
  on public.lists for select
  to authenticated
  using (is_public = true or auth.uid() = user_id);

drop policy if exists "List items follow list visibility" on public.list_items;

create policy "List items follow list visibility"
  on public.list_items for select
  to authenticated
  using (
    exists (
      select 1 from public.lists l
      where l.id = list_id
        and (l.is_public = true or l.user_id = auth.uid())
    )
  );


-- ── 6. Payments — add explicit owner-only SELECT policy ───────────────────────
-- Currently safe by accident (no GRANT to anon/authenticated), but needs an
-- explicit policy so it stays safe if grants are ever broadened.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'payments' and schemaname = 'public' and policyname = 'Users can view own payments'
  ) then
    execute 'create policy "Users can view own payments" on public.payments for select to authenticated using (auth.uid() = user_id)';
  end if;
end $$;
