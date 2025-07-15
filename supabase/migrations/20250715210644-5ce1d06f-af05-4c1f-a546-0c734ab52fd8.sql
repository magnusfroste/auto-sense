-- Insert test trip data
INSERT INTO public.sense_trips (
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
  notes
) VALUES (
  (SELECT auth.uid()),
  '2025-01-15 08:00:00+01',
  '2025-01-15 09:30:00+01',
  '{"lat": 59.3293, "lng": 18.0686, "address": "Stockholm Centralstation"}',
  '{"lat": 59.2741, "lng": 18.0150, "address": "Södertälje Centrum"}',
  42.5,
  90,
  'work',
  'completed',
  '[{"lat": 59.3293, "lng": 18.0686}, {"lat": 59.3100, "lng": 18.0500}, {"lat": 59.2900, "lng": 18.0300}, {"lat": 59.2741, "lng": 18.0150}]',
  'Test trip Stockholm to Södertälje'
);