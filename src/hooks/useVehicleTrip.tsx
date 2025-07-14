import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { useTrips } from './useTrips';
import { useVehicleConnections } from './useVehicleConnections';
import { supabase } from '@/integrations/supabase/client';

interface VehicleTrip {
  isMonitoring: boolean;
  activeTrips: any[];
  vehicleStatus: string;
}

export function useVehicleTrip() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { fetchTrips } = useTrips();
  const { connections } = useVehicleConnections();
  
  const [vehicleTrip, setVehicleTrip] = useState<VehicleTrip>({
    isMonitoring: false,
    activeTrips: [],
    vehicleStatus: 'Väntar på fordonsdata...',
  });

  useEffect(() => {
    if (!user) return;

    // Check if user has vehicle tracking mode enabled
    checkTrackingMode();
  }, [user, connections]);

  const checkTrackingMode = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('sense_profiles')
        .select('tracking_mode')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data?.tracking_mode === 'vehicle') {
        // Check if there are active vehicle connections
        const activeConnections = connections.filter(conn => conn.is_active);
        const hasActiveVehicles = activeConnections.length > 0;

        setVehicleTrip(prev => ({
          ...prev,
          isMonitoring: hasActiveVehicles,
          vehicleStatus: hasActiveVehicles 
            ? 'Automatisk spårning aktiverad' 
            : 'Inga aktiva fordon anslutna',
        }));

        // Only subscribe to updates if we have active vehicles
        if (hasActiveVehicles) {
          subscribeToTripUpdates();
        }
      }
    } catch (error) {
      console.error('Error checking tracking mode:', error);
    }
  };

  const subscribeToTripUpdates = () => {
    if (!user) return;

    const channel = supabase
      .channel('trip-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sense_trips',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Trip update received:', payload);
          
          // Refresh trips when new data comes in
          fetchTrips();
          
          if (payload.eventType === 'INSERT') {
            toast({
              title: 'Ny resa detekterad!',
              description: 'En automatisk resa har startats baserat på ditt fordon.',
            });
          } else if (payload.eventType === 'UPDATE' && payload.new.trip_status === 'completed') {
            toast({
              title: 'Resa avslutad',
              description: 'Din automatiska resa har avslutats och sparats.',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const enableVehicleTracking = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('sense_profiles')
        .update({ tracking_mode: 'vehicle' })
        .eq('id', user.id);

      if (error) throw error;

      setVehicleTrip(prev => ({
        ...prev,
        isMonitoring: true,
        vehicleStatus: 'Automatisk spårning aktiverad',
      }));

      subscribeToTripUpdates();

      toast({
        title: 'Fordons-spårning aktiverad',
        description: 'Automatiska resor kommer nu att detekteras från ditt fordon.',
      });
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte aktivera fordons-spårning.',
        variant: 'destructive',
      });
    }
  };

  return {
    vehicleTrip,
    enableVehicleTracking,
  };
}