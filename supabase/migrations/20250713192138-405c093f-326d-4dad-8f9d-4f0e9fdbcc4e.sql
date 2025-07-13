-- Add comprehensive profile settings to sense_profiles table
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS privacy_level text DEFAULT 'private' CHECK (privacy_level IN ('public', 'company', 'private'));

-- Vehicle settings
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS default_vehicle_id uuid REFERENCES vehicle_connections(id);
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS fuel_consumption_l_per_100km numeric DEFAULT 7.5;
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS distance_unit text DEFAULT 'km' CHECK (distance_unit IN ('km', 'miles'));
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS default_polling_frequency integer DEFAULT 120; -- seconds

-- Notification settings
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS notifications_trip_start boolean DEFAULT true;
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS notifications_trip_end boolean DEFAULT true;
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS notifications_sync_status boolean DEFAULT true;
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS notifications_weekly_report boolean DEFAULT true;
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS notifications_email boolean DEFAULT true;

-- Export and report settings
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS export_format text DEFAULT 'csv' CHECK (export_format IN ('csv', 'excel', 'pdf'));
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS date_format text DEFAULT 'swedish' CHECK (date_format IN ('swedish', 'international'));
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Stockholm';
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS language text DEFAULT 'sv' CHECK (language IN ('sv', 'en'));

-- Data security settings
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS data_retention_months integer DEFAULT 24;
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS data_sharing_level text DEFAULT 'none' CHECK (data_sharing_level IN ('none', 'company', 'authorized'));
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS auto_backup boolean DEFAULT true;

-- Display preferences
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS theme text DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system'));
ALTER TABLE public.sense_profiles ADD COLUMN IF NOT EXISTS currency text DEFAULT 'SEK' CHECK (currency IN ('SEK', 'EUR', 'USD'));