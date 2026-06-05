-- Allow authenticated users to update records (required for upsert ON CONFLICT DO UPDATE)
drop policy if exists "Authenticated users can update records" on public.records;

create policy "Authenticated users can update records"
  on public.records for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
