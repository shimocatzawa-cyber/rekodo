-- ─── Wantlist: price_cap, pressing_tip, found fields ─────────────────────────

alter table public.list_items
  add column if not exists price_cap    numeric(10,2),
  add column if not exists pressing_tip text,
  add column if not exists found        boolean not null default false;
