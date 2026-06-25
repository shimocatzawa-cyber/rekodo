-- Supports three Dig quality improvements:
--   1. sub_style — for Style Dig, Claude tags each pick with the specific
--      scene/niche within the chosen style (e.g. "ragga jungle" within
--      "Jungle") so repeated Style Digs can be steered away from the same
--      narrow corner instead of just avoiding the genre itself (which IS
--      the brief for Style Dig, so genre-level avoidance doesn't apply there).
--   2. angle — the exploration-angle text used for this pick, so the next
--      dig can avoid immediately repeating the same flavour-text angle.
--   3. dismissed_at — explicit "not for me" feedback, a faster-converging
--      negative signal than waiting for 3 ignored impressions.
alter table public.dig_history
  add column if not exists sub_style    text,
  add column if not exists angle        text,
  add column if not exists dismissed_at timestamptz;

create policy "Users can update own dig history"
  on public.dig_history for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
