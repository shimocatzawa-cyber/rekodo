-- Reschedule label-feed-ingest cron with correct project ref and anon key.
-- Direct DELETE on cron.job avoids the cron.unschedule function which triggers
-- a 2BP01 dependent-privileges error in Supabase's managed pg_cron environment.

delete from cron.job where jobname = 'label-feed-ingest-daily';

select cron.schedule(
  'label-feed-ingest-daily',
  '0 9 * * *',
  $$
    select net.http_post(
      url        := 'https://opcatpkzwtftfktwidrb.supabase.co/functions/v1/label-feed-ingest',
      headers    := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wY2F0cGt6d3RmdGZrdHdpZHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNzcyMzMsImV4cCI6MjA5NTk1MzIzM30.7dSJ8om3GRnyONAtvTzWx1wspK10xcJFd6wtrhbO2UY"}'::jsonb,
      body       := '{}'::jsonb
    );
  $$
);
