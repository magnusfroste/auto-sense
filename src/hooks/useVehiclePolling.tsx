import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import type { Json } from '@/integrations/supabase/types';

interface VehicleState {
  id: string;
  connection_id: string;
  last_odometer?: number;
  last_location?: Json;
  last_poll_time?: string;
  current_trip_id?: string;
  polling_frequency: number;
  created_at: string;
  updated_at: string;
}

export const useVehiclePolling = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isPolling, setIsPolling] = useState(false);
  const [vehicleStates, setVehicleStates] = useState<VehicleState[]>([]);

  // Fetch current vehicle states
  const fetchVehicleStates = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('vehicle_states')
        .select(`
          *,
          vehicle_connections!inner(user_id)
        `)
        .eq('vehicle_connections.user_id', user.id);

      if (error) throw error;
      
      // Transform the data to properly handle the nested structure
      const transformedData = (data || []).map(item => ({
        id: item.id,
        connection_id: item.connection_id,
        last_odometer: item.last_odometer,
        last_location: item.last_location,
        last_poll_time: item.last_poll_time,
        current_trip_id: item.current_trip_id,
        polling_frequency: item.polling_frequency,
        created_at: item.created_at,
        updated_at: item.updated_at
      }));
      
      setVehicleStates(transformedData);
    } catch (error) {
      console.error('Error fetching vehicle states:', error);
    }
  }, [user]);

  // Start polling for a specific vehicle
  const startVehiclePolling = useCallback(async (connectionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('vehicle-trip-polling', {
        body: { connectionId }
      });

      if (error) throw error;

      console.log('Vehicle polling started:', data);
      
      // Update local state
      await fetchVehicleStates();
      
      toast({
        title: 'Polling startat',
        description: 'Automatisk tripdetection är nu aktiverad för detta fordon'
      });
    } catch (error: any) {
      console.error('Error starting vehicle polling:', error);
      toast({
        title: 'Fel',
        description: 'Kunde inte starta polling för fordonet',
        variant: 'destructive'
      });
    }
  }, [fetchVehicleStates, toast]);

  // Start polling for all vehicles
  const startAllVehiclePolling = useCallback(async () => {
    setIsPolling(true);
    try {
      const { data, error } = await supabase.functions.invoke('vehicle-trip-polling', {
        body: {} // Empty body means poll all vehicles
      });

      if (error) throw error;

      console.log('All vehicle polling started:', data);
      
      // Update local state
      await fetchVehicleStates();
      
      toast({
        title: 'Polling aktiverat',
        description: 'Automatisk tripdetection körs nu för alla fordon'
      });
    } catch (error: any) {
      console.error('Error starting all vehicle polling:', error);
      toast({
        title: 'Fel',
        description: 'Kunde inte starta polling för fordon',
        variant: 'destructive'
      });
      setIsPolling(false);
    }
  }, [fetchVehicleStates, toast]);

  // Get vehicle state for a specific connection
  const getVehicleState = useCallback((connectionId: string) => {
    return vehicleStates.find(state => state.connection_id === connectionId);
  }, [vehicleStates]);

  // Check if any vehicle has an active trip
  const hasActiveTrips = useCallback(() => {
    return vehicleStates.some(state => state.current_trip_id);
  }, [vehicleStates]);

  // Subscribe to real-time vehicle state updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('vehicle-states-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vehicle_states'
        },
        () => {
          console.log('Vehicle state changed, refreshing...');
          fetchVehicleStates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchVehicleStates]);

  // Initial fetch
  useEffect(() => {
    fetchVehicleStates();
  }, [fetchVehicleStates]);

  return {
    vehicleStates,
    isPolling,
    startVehiclePolling,
    startAllVehiclePolling,
    getVehicleState,
    hasActiveTrips,
    fetchVehicleStates
  };
};