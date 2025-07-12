-- Add tracking_mode column to sense_profiles table
ALTER TABLE public.sense_profiles 
ADD COLUMN tracking_mode TEXT DEFAULT 'gps' CHECK (tracking_mode IN ('gps', 'vehicle'));