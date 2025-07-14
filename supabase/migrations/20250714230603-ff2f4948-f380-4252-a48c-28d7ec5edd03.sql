-- Update cron job to run every 30 seconds for more responsive trip detection
SELECT cron.unschedule('vehicle-polling-cron-updated');

-- Create a new cron job to poll all vehicles every 30 seconds
SELECT cron.schedule(
  'vehicle-polling-cron-30s',
  '*/30 * * * * *', -- Every 30 seconds  
  $$
  SELECT
    net.http_post(
        url:='https://umjqoizuhfrxzjgrdvei.supabase.co/functions/v1/vehicle-trip-polling',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtanFvaXp1aGZyeHpqZ3JkdmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4ODc0MzYsImV4cCI6MjA1OTQ2MzQzNn0.V3An4DVIMjFAZKJFCBh8A2IkaHWiC_btMN_8MTx9m2Q"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);