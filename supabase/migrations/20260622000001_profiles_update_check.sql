-- Security fix: profiles UPDATE policy had no WITH CHECK clause, so it only
-- restricted WHICH row a user could touch (their own), not what values they
-- could set on it. Any authenticated user could PATCH their own row directly
-- via the REST API with role/subscription_tier/is_supporter/is_donor/
-- stripe_customer_id set to anything — e.g. role: "admin" walks straight into
-- /admin, which uses the service-role key.
--
-- These five columns are confirmed to only ever be legitimately written via
-- service-role paths (src/app/admin/actions.ts, src/app/api/stripe/webhook/
-- route.ts) — never through the user's own session-scoped client — so pinning
-- them to their existing value here is safe and doesn't break any current
-- flow. Spotify token columns are deliberately NOT included: those ARE
-- legitimately self-updated through the user's own session during normal
-- connect/refresh/disconnect flows.

drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role             is not distinct from (select p.role             from public.profiles p where p.id = auth.uid())
    and subscription_tier is not distinct from (select p.subscription_tier from public.profiles p where p.id = auth.uid())
    and is_supporter      is not distinct from (select p.is_supporter      from public.profiles p where p.id = auth.uid())
    and is_donor          is not distinct from (select p.is_donor          from public.profiles p where p.id = auth.uid())
    and stripe_customer_id is not distinct from (select p.stripe_customer_id from public.profiles p where p.id = auth.uid())
  );
