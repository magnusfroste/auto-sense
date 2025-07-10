-- Insert demo trips for demo@sense.se user
-- First, create the demo user profile if it doesn't exist
INSERT INTO public.sense_profiles (id, email, full_name, company, department)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'demo@sense.se',
  'Demo Användare',
  'Sense Demo AB',
  'Transport'
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  company = EXCLUDED.company,
  department = EXCLUDED.department;

-- Insert demo trips with simple routes between Swedish cities
INSERT INTO public.sense_trips (
  id,
  user_id,
  start_time,
  end_time,
  start_location,
  end_location,
  distance_km,
  duration_minutes,
  trip_type,
  trip_status,
  route_data,
  notes,
  created_at
) VALUES 
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001'::uuid,
  '2024-01-15 08:30:00+01'::timestamptz,
  '2024-01-15 12:45:00+01'::timestamptz,
  '{"lat": 59.3293, "lng": 18.0686, "address": "Stockholm, Sverige"}'::jsonb,
  '{"lat": 57.7089, "lng": 11.9746, "address": "Göteborg, Sverige"}'::jsonb,
  470.5,
  255,
  'work'::trip_type,
  'completed'::trip_status,
  '{"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}, "geometry": {"type": "LineString", "coordinates": [[18.0686, 59.3293], [17.5, 58.5], [16.8, 57.9], [13.2, 57.8], [11.9746, 57.7089]]}}]}'::jsonb,
  'Affärsresa till Göteborg',
  '2024-01-15 12:45:00+01'::timestamptz
),
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001'::uuid,
  '2024-01-18 14:15:00+01'::timestamptz,
  '2024-01-18 18:30:00+01'::timestamptz,
  '{"lat": 57.7089, "lng": 11.9746, "address": "Göteborg, Sverige"}'::jsonb,
  '{"lat": 55.6050, "lng": 13.0038, "address": "Malmö, Sverige"}'::jsonb,
  290.8,
  255,
  'work'::trip_type,
  'completed'::trip_status,
  '{"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}, "geometry": {"type": "LineString", "coordinates": [[11.9746, 57.7089], [12.5, 56.8], [12.8, 56.2], [13.0038, 55.6050]]}}]}'::jsonb,
  'Fortsatt affärsresa till Malmö',
  '2024-01-18 18:30:00+01'::timestamptz
),
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001'::uuid,
  '2024-01-20 16:00:00+01'::timestamptz,
  '2024-01-20 21:15:00+01'::timestamptz,
  '{"lat": 55.6050, "lng": 13.0038, "address": "Malmö, Sverige"}'::jsonb,
  '{"lat": 59.3293, "lng": 18.0686, "address": "Stockholm, Sverige"}'::jsonb,
  615.2,
  315,
  'work'::trip_type,
  'completed'::trip_status,
  '{"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}, "geometry": {"type": "LineString", "coordinates": [[13.0038, 55.6050], [13.5, 56.0], [14.2, 56.8], [15.5, 57.5], [16.8, 58.2], [18.0686, 59.3293]]}}]}'::jsonb,
  'Hemresa till Stockholm',
  '2024-01-20 21:15:00+01'::timestamptz
),
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001'::uuid,
  '2024-01-25 07:45:00+01'::timestamptz,
  '2024-01-25 09:30:00+01'::timestamptz,
  '{"lat": 59.3293, "lng": 18.0686, "address": "Stockholm, Sverige"}'::jsonb,
  '{"lat": 60.1282, "lng": 18.6435, "address": "Uppsala, Sverige"}'::jsonb,
  71.3,
  105,
  'personal'::trip_type,
  'completed'::trip_status,
  '{"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}, "geometry": {"type": "LineString", "coordinates": [[18.0686, 59.3293], [18.2, 59.5], [18.4, 59.8], [18.6435, 60.1282]]}}]}'::jsonb,
  'Personlig resa till Uppsala',
  '2024-01-25 09:30:00+01'::timestamptz
),
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001'::uuid,
  '2024-01-25 15:20:00+01'::timestamptz,
  '2024-01-25 17:05:00+01'::timestamptz,
  '{"lat": 60.1282, "lng": 18.6435, "address": "Uppsala, Sverige"}'::jsonb,
  '{"lat": 59.3293, "lng": 18.0686, "address": "Stockholm, Sverige"}'::jsonb,
  71.3,
  105,
  'personal'::trip_type,
  'completed'::trip_status,
  '{"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}, "geometry": {"type": "LineString", "coordinates": [[18.6435, 60.1282], [18.4, 59.8], [18.2, 59.5], [18.0686, 59.3293]]}}]}'::jsonb,
  'Hemresa från Uppsala',
  '2024-01-25 17:05:00+01'::timestamptz
);