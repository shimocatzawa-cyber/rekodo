create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'label-feed-ingest-daily',
  '0 9 * * *',
  $$
    select net.http_post(
      url        := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/label-feed-ingest',
      headers    := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
      body       := '{}'::jsonb
    );
  $$
);
