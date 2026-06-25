-- named_pairing has been read/written by /api/archetypes and
-- backfill-archetypes.ts since the named-pairing feature shipped, but the
-- column was never actually added to this ad-hoc-created table — every
-- write has been failing with "column ... does not exist" (masked until now
-- by the separate missing service_role grant in 20260630000001).
alter table public.archetype_cache add column if not exists named_pairing text;
