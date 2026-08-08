-- Archive the July label spotlight now that August is live
update public.spotlights
set status = 'archived'
where name = 'Light in the Attic'
  and type = 'label';

-- Ensure Guruguru Brain is pinned to August
update public.spotlights
set month = '2026-08'
where name = 'Guruguru Brain';
