alter table label_feed enable row level security;

create policy "public read"
  on label_feed for select
  using (true);
