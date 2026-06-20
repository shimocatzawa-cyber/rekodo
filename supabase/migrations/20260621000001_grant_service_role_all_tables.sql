-- service_role's table-level grant has gone missing on individual tables more
-- than once now (first profiles — see 20260616000007 — now list_items, found
-- via "permission denied for table list_items" on a service-role admin
-- route). RLS bypass alone doesn't substitute for the base GRANT. Rather than
-- patch tables one at a time as this resurfaces, grant service_role access on
-- every table up front and make it the default for tables created from here on.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
