import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ActiveTrip {
  id: string;
  start_time: string;
  start_location: {
    latitude: number;
    longitude: number;
  };
  end_location?: {
    latitude: number;
    longitude: number;
  } | null;
  distance_km: number | null;
  duration_minutes: number | null;
  route_data: [number, number][] | null; // GeoJSON LineString coordinates
  trip_type: 'work' | 'personal' | 'unknown';
  trip_status: 'active' | 'completed' | 'paused';
  vehicle_connection_id: string | null;
  odometer_km: number | null;
  created_at: string;
  updated_at: string;
}

export const useActiveTrip = (vehicleConnectionId?: string) => {
  const { user } = useAuth();
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveTrip = async () => {
    if (!user || !vehicleConnectionId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('sense_trips')
        .select('*')
        .eq('user_id', user.id)
        .eq('vehicle_connection_id', vehicleConnectionId)
        .eq('trip_status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching active trip:', error);
        setError(error.message);
        return;
      }

      if (data) {
        setActiveTrip({
          id: data.id,
          start_time: data.start_time,
          start_location: data.start_location as { latitude: number; longitude: number },
          end_location: data.end_location as { latitude: number; longitude: number } | null,
          distance_km: data.distance_km,
          duration_minutes: data.duration_minutes,
          route_data: data.route_data as [number, number][] | null,
          trip_type: data.trip_type,
          trip_status: data.trip_status,
          vehicle_connection_id: data.vehicle_connection_id,
          odometer_km: data.odometer_km,
          created_at: data.created_at,
          updated_at: data.updated_at
        });
      } else {
        setActiveTrip(null);
      }
    } catch (err) {
      console.error('Error in fetchActiveTrip:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveTrip();

    // Set up real-time subscription for trip updates
    const channel = supabase
      .channel('active-trip-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sense_trips',
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          console.log('🔄 Trip update received:', payload);
          fetchActiveTrip(); // Refetch to get latest data
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, vehicleConnectionId]);

  return {
    activeTrip,
    loading,
    error,
    refetch: fetchActiveTrip
  };
};