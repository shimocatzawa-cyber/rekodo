-- The style chosen for a Style Dig pick (e.g. "Jungle") — needed to scope
-- sub_style fatigue correctly. Without it, a sub_style tag like "Lo-fi"
-- from a Hip Hop style dig could wrongly suppress an unrelated "Lo-fi"
-- corner of a later Bedroom Pop style dig.
alter table public.dig_history
  add column if not exists style text;
