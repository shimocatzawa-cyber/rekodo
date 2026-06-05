-- ─── Wantlist: note + priority fields on list_items ─────────────────────────

alter table public.list_items
  add column if not exists note     text,
  add column if not exists priority text
    check (priority in ('must_have', 'would_love', 'someday'));

-- Update any existing "Want to Buy" lists to slug "wantlist"
update public.lists
  set slug = 'wantlist', title = 'Wantlist'
  where slug = 'want-to-buy' and title = 'Want to Buy';
