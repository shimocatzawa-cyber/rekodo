-- Security fix: records UPDATE policy was `auth.role() = 'authenticated'` —
-- any logged-in user could edit ANY shared catalog row (artist, album,
-- cover_url, community stats, Spotify match data), not just releases they
-- actually own, since there's no per-row ownership model on this shared
-- table. Scope UPDATE to users who actually have the record linked in their
-- own collection via user_records.
--
-- Verified every UPDATE call site in the app (csv-enrich, discogs/median-batch,
-- discogs/price-batch, playlist/generate, playlist/match-spotify-worker) only
-- ever updates records already resolved from the calling user's own
-- user_records rows, so this doesn't change any legitimate behavior. INSERT
-- stays as-is (creating new shared catalog rows during sync/import has no
-- natural owner yet).

drop policy if exists "Authenticated users can update records" on public.records;

create policy "Users can update records they own"
  on public.records for update
  using (
    exists (
      select 1 from public.user_records ur
      where ur.record_id = records.id and ur.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.user_records ur
      where ur.record_id = records.id and ur.user_id = auth.uid()
    )
  );
