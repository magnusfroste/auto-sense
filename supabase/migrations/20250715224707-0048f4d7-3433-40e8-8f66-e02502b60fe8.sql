-- Fix manual trip linking by setting current_trip_id for existing active trips
UPDATE vehicle_states 
SET current_trip_id = (
  SELECT sense_trips.id 
  FROM sense_trips 
  WHERE sense_trips.vehicle_connection_id = vehicle_states.connection_id 
    AND sense_trips.trip_status = 'active' 
  LIMIT 1
)
WHERE current_trip_id IS NULL
  AND EXISTS (
    SELECT 1 
    FROM sense_trips 
    WHERE sense_trips.vehicle_connection_id = vehicle_states.connection_id 
      AND sense_trips.trip_status = 'active'
  );