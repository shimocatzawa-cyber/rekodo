-- user_quiz_profile, archetype_cache, and taste_profile_cache were created
-- directly against the database outside any tracked migration (same pattern
-- documented in 20260616000007/20260621000001 for other tables), so their RLS
-- status couldn't be verified from the repo. This brings all three under
-- migration control with owner-scoped policies, regardless of whatever state
-- they're currently in — safe/idempotent either way. Guarded with existence
-- checks since these tables may not exist in every environment.

do $$
begin
  if to_regclass('public.user_quiz_profile') is not null then
    execute 'alter table public.user_quiz_profile enable row level security';
    execute 'drop policy if exists "Users can view own quiz profile" on public.user_quiz_profile';
    execute 'drop policy if exists "Users can insert own quiz profile" on public.user_quiz_profile';
    execute 'drop policy if exists "Users can update own quiz profile" on public.user_quiz_profile';
    execute 'drop policy if exists "Users can delete own quiz profile" on public.user_quiz_profile';
    execute 'create policy "Users can view own quiz profile" on public.user_quiz_profile for select using (auth.uid() = user_id)';
    execute 'create policy "Users can insert own quiz profile" on public.user_quiz_profile for insert with check (auth.uid() = user_id)';
    execute 'create policy "Users can update own quiz profile" on public.user_quiz_profile for update using (auth.uid() = user_id) with check (auth.uid() = user_id)';
    execute 'create policy "Users can delete own quiz profile" on public.user_quiz_profile for delete using (auth.uid() = user_id)';
  end if;
end $$;

do $$
begin
  if to_regclass('public.archetype_cache') is not null then
    execute 'alter table public.archetype_cache enable row level security';
    execute 'drop policy if exists "Users can view own archetype cache" on public.archetype_cache';
    execute 'drop policy if exists "Users can insert own archetype cache" on public.archetype_cache';
    execute 'drop policy if exists "Users can update own archetype cache" on public.archetype_cache';
    execute 'create policy "Users can view own archetype cache" on public.archetype_cache for select using (auth.uid() = user_id)';
    execute 'create policy "Users can insert own archetype cache" on public.archetype_cache for insert with check (auth.uid() = user_id)';
    execute 'create policy "Users can update own archetype cache" on public.archetype_cache for update using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end $$;

do $$
begin
  if to_regclass('public.taste_profile_cache') is not null then
    execute 'alter table public.taste_profile_cache enable row level security';
    execute 'drop policy if exists "Users can view own taste profile cache" on public.taste_profile_cache';
    execute 'drop policy if exists "Users can insert own taste profile cache" on public.taste_profile_cache';
    execute 'drop policy if exists "Users can update own taste profile cache" on public.taste_profile_cache';
    execute 'create policy "Users can view own taste profile cache" on public.taste_profile_cache for select using (auth.uid() = user_id)';
    execute 'create policy "Users can insert own taste profile cache" on public.taste_profile_cache for insert with check (auth.uid() = user_id)';
    execute 'create policy "Users can update own taste profile cache" on public.taste_profile_cache for update using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end $$;
