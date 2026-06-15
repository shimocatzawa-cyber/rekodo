-- !! ACTION REQUIRED BEFORE APPLYING !!
-- Replace <PROJECT_REF> with your Supabase project reference (Settings → General → Reference ID)
-- Replace <ANON_KEY>    with your project's anon/public key  (Settings → API → Project API Keys)
-- Then run this in the SQL Editor, OR use cron.unschedule + cron.schedule if already applied.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'label-feed-ingest-daily',
  '0 9 * * *',
  $$
    select net.http_post(
      url        := 'https://<PROJECT_REF>.supabase.co/functions/v1/label-feed-ingest',
      headers    := '{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
      body       := '{}'::jsonb
    );
  $$
);
