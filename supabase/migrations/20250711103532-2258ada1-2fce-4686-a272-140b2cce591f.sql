-- Add vehicle connection table for Smartcar integration
CREATE TABLE public.vehicle_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vehicle_id TEXT NOT NULL,
  smartcar_vehicle_id TEXT NOT NULL UNIQUE,
  make TEXT,
  model TEXT,
  year INTEGER,
  vin TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicle_connections ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own vehicle connections" 
ON public.vehicle_connections 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own vehicle connections" 
ON public.vehicle_connections 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vehicle connections" 
ON public.vehicle_connections 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vehicle connections" 
ON public.vehicle_connections 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_vehicle_connections_updated_at
BEFORE UPDATE ON public.vehicle_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Extend sense_trips table to support Smartcar data
ALTER TABLE public.sense_trips 
ADD COLUMN vehicle_connection_id UUID REFERENCES public.vehicle_connections(id),
ADD COLUMN smartcar_trip_id TEXT,
ADD COLUMN fuel_consumed_liters NUMERIC,
ADD COLUMN odometer_km NUMERIC,
ADD COLUMN is_automatic BOOLEAN DEFAULT false;

-- Create index for better performance
CREATE INDEX idx_sense_trips_vehicle_connection ON public.sense_trips(vehicle_connection_id);
CREATE INDEX idx_sense_trips_smartcar_trip ON public.sense_trips(smartcar_trip_id);