-- Create a table to store historical vehicle data points
CREATE TABLE public.vehicle_data_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL,
  odometer_km NUMERIC,
  location JSONB,
  poll_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.vehicle_data_history ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own vehicle data history
CREATE POLICY "Users can view their own vehicle data history" 
ON public.vehicle_data_history 
FOR SELECT 
USING (connection_id IN (
  SELECT id FROM vehicle_connections WHERE user_id = auth.uid()
));

-- Create policy for service to insert data
CREATE POLICY "Service can manage vehicle data history" 
ON public.vehicle_data_history 
FOR ALL 
USING (true);

-- Add foreign key constraint
ALTER TABLE public.vehicle_data_history 
ADD CONSTRAINT vehicle_data_history_connection_id_fkey 
FOREIGN KEY (connection_id) REFERENCES vehicle_connections(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_vehicle_data_history_connection_time 
ON public.vehicle_data_history(connection_id, poll_time DESC);