-- Add configurable trip thresholds to sense_profiles table
ALTER TABLE public.sense_profiles 
ADD COLUMN trip_movement_threshold_meters INTEGER DEFAULT 100,
ADD COLUMN trip_stationary_timeout_minutes INTEGER DEFAULT 2,
ADD COLUMN trip_minimum_distance_meters INTEGER DEFAULT 500,
ADD COLUMN trip_max_duration_hours INTEGER DEFAULT 12,
ADD COLUMN trip_sensitivity_level TEXT DEFAULT 'normal' CHECK (trip_sensitivity_level IN ('low', 'normal', 'high'));

-- Add trip configuration comments for documentation
COMMENT ON COLUMN public.sense_profiles.trip_movement_threshold_meters IS 'Minimum movement in meters to start a trip';
COMMENT ON COLUMN public.sense_profiles.trip_stationary_timeout_minutes IS 'Minutes of no movement to end a trip';
COMMENT ON COLUMN public.sense_profiles.trip_minimum_distance_meters IS 'Minimum trip distance to keep the trip';
COMMENT ON COLUMN public.sense_profiles.trip_max_duration_hours IS 'Maximum allowed trip duration in hours';
COMMENT ON COLUMN public.sense_profiles.trip_sensitivity_level IS 'Trip detection sensitivity: low, normal, or high';