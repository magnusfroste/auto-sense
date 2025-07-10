-- Insert demo trips that can be used by any user with email demo@sense.se
-- We'll use a function to insert trips only if the user exists
DO $$
DECLARE
    demo_user_id uuid;
BEGIN
    -- Try to find user with email demo@sense.se from profiles
    SELECT id INTO demo_user_id 
    FROM public.sense_profiles 
    WHERE email = 'demo@sense.se' 
    LIMIT 1;
    
    -- If user exists, insert demo trips
    IF demo_user_id IS NOT NULL THEN
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
            notes,
            created_at
        ) VALUES 
        (
            demo_user_id,
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
            demo_user_id,
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
            demo_user_id,
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
            demo_user_id,
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
            demo_user_id,
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
        
        RAISE NOTICE 'Demo trips inserted for user %', demo_user_id;
    ELSE
        RAISE NOTICE 'No user found with email demo@sense.se. Please create this user first by signing up.';
    END IF;
END $$;