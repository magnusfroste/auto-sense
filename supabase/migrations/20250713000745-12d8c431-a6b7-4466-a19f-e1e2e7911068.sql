-- Create vehicle_states table to track polling state
CREATE TABLE public.vehicle_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL UNIQUE,
  last_odometer NUMERIC,
  last_location JSONB,
  last_poll_time TIMESTAMP WITH TIME ZONE,
  current_trip_id UUID,
  polling_frequency INTEGER DEFAULT 120,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.vehicle_states ENABLE ROW LEVEL SECURITY;

-- Create policies for vehicle_states
CREATE POLICY "Users can view their own vehicle states" 
ON public.vehicle_states 
FOR SELECT 
USING (connection_id IN (
  SELECT id FROM public.vehicle_connections 
  WHERE user_id = auth.uid()
));

CREATE POLICY "Service can manage vehicle states" 
ON public.vehicle_states 
FOR ALL 
USING (true);

-- Add foreign key constraint
ALTER TABLE public.vehicle_states 
ADD CONSTRAINT vehicle_states_connection_id_fkey 
FOREIGN KEY (connection_id) 
REFERENCES public.vehicle_connections(id) 
ON DELETE CASCADE;

-- Add foreign key for current_trip_id
ALTER TABLE public.vehicle_states 
ADD CONSTRAINT vehicle_states_current_trip_id_fkey 
FOREIGN KEY (current_trip_id) 
REFERENCES public.sense_trips(id) 
ON DELETE SET NULL;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_vehicle_states_updated_at
BEFORE UPDATE ON public.vehicle_states
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();