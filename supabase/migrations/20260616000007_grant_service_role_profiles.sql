-- service_role lost its table-level grant on public.profiles at some point
-- (RLS bypass alone doesn't substitute for the base GRANT), which is why the
-- admin page reads back empty profiles (silently, since the page doesn't
-- check the select error) and the tier/role update action surfaces an
-- explicit "permission denied for table profiles" error.

grant select, insert, update, delete on table public.profiles to service_role;
