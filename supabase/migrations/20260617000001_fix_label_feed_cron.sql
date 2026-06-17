-- Reschedule label-feed-ingest cron with correct project ref and anon key.
-- Safe to re-run: unschedule is a no-op if the job doesn't exist.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('label-feed-ingest-daily');

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
