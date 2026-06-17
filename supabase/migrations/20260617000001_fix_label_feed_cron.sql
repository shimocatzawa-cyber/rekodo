-- Reschedule label-feed-ingest cron with correct project ref and anon key.
-- pg_cron and pg_net are already enabled by Supabase — no CREATE EXTENSION needed.
-- The DO block swallows errors if the job name doesn't exist yet.

do $$
begin
  perform cron.unschedule('label-feed-ingest-daily');
exception when others then
  null; -- job didn't exist, that's fine
end;
$$;

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
