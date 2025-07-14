-- Remove is_active column and add cascade delete for vehicle connections cleanup
-- First, add cascade delete constraint for sense_trips
ALTER TABLE sense_trips 
DROP CONSTRAINT IF EXISTS sense_trips_vehicle_connection_id_fkey;

ALTER TABLE sense_trips 
ADD CONSTRAINT sense_trips_vehicle_connection_id_fkey 
FOREIGN KEY (vehicle_connection_id) 
REFERENCES vehicle_connections(id) 
ON DELETE CASCADE;

-- Add cascade delete constraint for vehicle_states
ALTER TABLE vehicle_states 
DROP CONSTRAINT IF EXISTS vehicle_states_connection_id_fkey;

ALTER TABLE vehicle_states 
ADD CONSTRAINT vehicle_states_connection_id_fkey 
FOREIGN KEY (connection_id) 
REFERENCES vehicle_connections(id) 
ON DELETE CASCADE;

-- Remove is_active column since we'll just delete inactive connections
ALTER TABLE vehicle_connections 
DROP COLUMN IF EXISTS is_active;