-- Enable the required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job to poll all vehicles every 2 minutes
SELECT cron.schedule(
  'vehicle-polling-cron',
  '*/2 * * * *', -- Every 2 minutes
  $$
  SELECT
    net.http_post(
        url:='https://umjqoizuhfrxzjgrdvei.supabase.co/functions/v1/vehicle-trip-polling',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtanFvaXp1aGZyeHpqZ3JkdmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4ODc0MzYsImV4cCI6MjA1OTQ2MzQzNn0.V3An4DVIMjFAZKJFCBh8A2IkaHWiC_btMN_8MTx9m2Q"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);