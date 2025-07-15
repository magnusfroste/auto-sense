-- Enable real-time for sense_trips table
ALTER TABLE public.sense_trips REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.sense_trips;