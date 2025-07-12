import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface LocationData {
  lat: number;
  lng: number;
  address?: string;
}

interface Trip {
  id?: string;
  user_id?: string;
  start_time: string;
  end_time?: string;
  start_location: any; // JSON data from database
  end_location?: any; // JSON data from database
  distance_km: number;
  duration_minutes: number;
  trip_type: 'work' | 'personal' | 'unknown';
  trip_status: 'active' | 'completed' | 'paused';
  route_data?: any; // JSON data from database
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const useTrips = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTrips = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sense_trips')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrips(data || []);
    } catch (error) {
      console.error('Error fetching trips:', error);
      toast({
        title: 'Fel vid hämtning av resor',
        description: 'Kunde inte ladda dina resor',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveTrip = async (tripData: {
    start_time: string;
    end_time?: string;
    start_location: LocationData;
    end_location?: LocationData;
    distance_km?: number;
    duration_minutes?: number;
    trip_type?: 'work' | 'personal' | 'unknown';
    trip_status?: 'active' | 'completed' | 'paused';
    route_data?: LocationData[];
    notes?: string;
    vehicle_connection_id?: string;
  }) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('sense_trips')
        .insert({
          user_id: user.id,
          start_time: tripData.start_time,
          end_time: tripData.end_time,
          start_location: tripData.start_location as any,
          end_location: tripData.end_location as any,
          distance_km: tripData.distance_km || 0,
          duration_minutes: tripData.duration_minutes || 0,
          trip_type: tripData.trip_type || 'unknown',
          trip_status: tripData.trip_status || 'completed',
          route_data: tripData.route_data as any,
          notes: tripData.notes,
          vehicle_connection_id: tripData.vehicle_connection_id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Resa sparad!',
        description: 'Din resa har sparats framgångsrikt.',
      });

      // Refresh trips list
      fetchTrips();
      
      return data;
    } catch (error) {
      console.error('Error saving trip:', error);
      toast({
        title: 'Fel vid sparning',
        description: 'Kunde inte spara resan',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateTrip = async (tripId: string, updates: any) => {
    try {
      const { data, error } = await supabase
        .from('sense_trips')
        .update(updates)
        .eq('id', tripId)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Resa uppdaterad',
        description: 'Ändringarna har sparats.',
      });

      // Refresh trips list
      fetchTrips();
      
      return data;
    } catch (error) {
      console.error('Error updating trip:', error);
      toast({
        title: 'Fel vid uppdatering',
        description: 'Kunde inte uppdatera resan',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteTrip = async (tripId: string) => {
    try {
      const { error } = await supabase
        .from('sense_trips')
        .delete()
        .eq('id', tripId);

      if (error) throw error;

      toast({
        title: 'Resa borttagen',
        description: 'Resan har tagits bort framgångsrikt.',
      });

      // Refresh trips list
      fetchTrips();
    } catch (error) {
      console.error('Error deleting trip:', error);
      toast({
        title: 'Fel vid borttagning',
        description: 'Kunde inte ta bort resan',
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [user]);

  return {
    trips,
    loading,
    saveTrip,
    updateTrip,
    deleteTrip,
    fetchTrips
  };
};