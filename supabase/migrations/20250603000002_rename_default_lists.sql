-- Rename the two default lists that didn't follow the "Top 5" convention.
-- Only updates rows that still have the old slug — safe to re-run.

update public.lists
set title = 'Top 5 Desert Island', slug = 'top-5-desert-island'
where slug = 'desert-island';

update public.lists
set title = 'Top 5 Gateway Records', slug = 'top-5-gateway-records'
where slug = 'gateway-records';
