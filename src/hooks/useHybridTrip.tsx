import { useState, useEffect, useRef, useCallback } from 'react';
console.log('🔧 useHybridTrip loaded');
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { useTrips } from './useTrips';
import { useVehicleConnections } from './useVehicleConnections';
import { supabase } from '@/integrations/supabase/client';

export type TripSource = 'gps' | 'vehicle' | 'hybrid';
export type TripStatus = 'inactive' | 'active' | 'paused';
export type TripType = 'work' | 'personal' | 'unknown';

export interface LocationData {
  lat: number;
  lng: number;
  address?: string;
  timestamp?: string;
}

export interface VehicleData {
  location?: { latitude: number; longitude: number };
  odometer?: { distance: number };
  fuel?: { percent: number };
  info?: { make: string; model: string; year: number };
}

export interface HybridTripData {
  id?: string;
  startTime: Date | null;
  endTime: Date | null;
  startLocation: LocationData | null;
  currentLocation: LocationData | null;
  route: LocationData[];
  distance: number;
  duration: number;
  status: TripStatus;
  tripType: TripType;
  notes: string;
  source: TripSource;
  vehicleConnectionId?: string;
  vehicleData?: VehicleData;
  gpsAccuracy?: number;
}

export const useHybridTrip = () => {
  console.log('🚀 useHybridTrip hook initialized');
  const { user } = useAuth();
  const { toast } = useToast();
  const { saveTrip } = useTrips();
  const { connections } = useVehicleConnections();
  
  const watchIdRef = useRef<number | null>(null);
  const vehiclePollingRef = useRef<NodeJS.Timeout | null>(null);
  
  const [trip, setTrip] = useState<HybridTripData>({
    startTime: null,
    endTime: null,
    startLocation: null,
    currentLocation: null,
    route: [],
    distance: 0,
    duration: 0,
    status: 'inactive',
    tripType: 'unknown',
    notes: '',
    source: 'gps'
  });

  // Available trip sources based on user's vehicle connections
  console.log('🚗 Vehicle connections:', connections.length, connections);
  const availableSources: { value: TripSource; label: string; description: string }[] = [
    { value: 'gps', label: 'GPS Telefon', description: 'Använd telefonens GPS för spårning' },
    ...(connections.length > 0 ? [
      { value: 'vehicle' as TripSource, label: 'Fordon', description: 'Använd anslutna fordon för spårning' },
      { value: 'hybrid' as TripSource, label: 'Hybrid', description: 'Kombinera GPS och fordonsdata' }
    ] : [])
  ];

  // Timer for duration updates
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (trip.status === 'active' && trip.startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const duration = Math.floor((now.getTime() - trip.startTime!.getTime()) / 1000);
        setTrip(prev => ({ ...prev, duration }));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [trip.status, trip.startTime]);

  // Get GPS location
  const getCurrentGPSLocation = useCallback((): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation stöds inte av denna enhet'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: new Date().toISOString()
          });
        },
        (error) => {
          reject(new Error(`GPS-fel: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  }, []);

  // Get vehicle location
  const getVehicleLocation = useCallback(async (vehicleConnectionId: string): Promise<LocationData | null> => {
    try {
      const connection = connections.find(c => c.id === vehicleConnectionId);
      if (!connection) return null;

      const { data, error } = await supabase.functions.invoke('smartcar-vehicle-data', {
        body: {
          access_token: connection.access_token,
          vehicle_id: connection.smartcar_vehicle_id
        }
      });

      if (error) throw error;

      const vehicleData = data?.data;
      if (vehicleData?.location) {
        return {
          lat: vehicleData.location.latitude,
          lng: vehicleData.location.longitude,
          timestamp: new Date().toISOString()
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching vehicle location:', error);
      return null;
    }
  }, [connections]);

  // Get current location based on trip source
  const getCurrentLocation = useCallback(async (): Promise<LocationData> => {
    switch (trip.source) {
      case 'gps':
        return getCurrentGPSLocation();
      
      case 'vehicle':
        if (trip.vehicleConnectionId) {
          const vehicleLocation = await getVehicleLocation(trip.vehicleConnectionId);
          if (vehicleLocation) return vehicleLocation;
        }
        // Fallback to GPS if vehicle fails
        return getCurrentGPSLocation();
      
      case 'hybrid':
        // Try vehicle first, fallback to GPS
        if (trip.vehicleConnectionId) {
          const vehicleLocation = await getVehicleLocation(trip.vehicleConnectionId);
          if (vehicleLocation) return vehicleLocation;
        }
        return getCurrentGPSLocation();
      
      default:
        return getCurrentGPSLocation();
    }
  }, [trip.source, trip.vehicleConnectionId, getCurrentGPSLocation, getVehicleLocation]);

  // Calculate distance between two points
  const calculateDistance = useCallback((from: LocationData, to: LocationData): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (to.lat - from.lat) * Math.PI / 180;
    const dLon = (to.lng - from.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // Start trip tracking
  const startTrip = useCallback(async (source: TripSource, vehicleConnectionId?: string) => {
    console.log('🛣️ Starting trip with source:', source, 'vehicle:', vehicleConnectionId);
    try {
      const location = await getCurrentLocation();
      const now = new Date();
      
      setTrip(prev => ({
        ...prev,
        status: 'active',
        startTime: now,
        startLocation: location,
        currentLocation: location,
        route: [location],
        distance: 0,
        duration: 0,
        source,
        vehicleConnectionId
      }));

      // Start appropriate tracking based on source
      if (source === 'gps' || source === 'hybrid') {
        startGPSTracking();
      }
      
      if ((source === 'vehicle' || source === 'hybrid') && vehicleConnectionId) {
        startVehicleTracking(vehicleConnectionId);
      }

      toast({
        title: 'Resa startad!',
        description: `${source === 'gps' ? 'GPS' : source === 'vehicle' ? 'Fordon' : 'Hybrid'}-spårning är nu aktivt.`,
      });
    } catch (error) {
      toast({
        title: 'Kunde inte starta resa',
        description: error instanceof Error ? error.message : 'Okänt fel',
        variant: 'destructive',
      });
    }
  }, [getCurrentLocation, toast]);

  // Start GPS tracking
  const startGPSTracking = useCallback(() => {
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation: LocationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: new Date().toISOString()
          };
          
          setTrip(prev => {
            if (prev.currentLocation) {
              const distance = calculateDistance(prev.currentLocation, newLocation);
              
              return {
                ...prev,
                currentLocation: newLocation,
                route: [...prev.route, newLocation],
                distance: prev.distance + distance,
                gpsAccuracy: position.coords.accuracy
              };
            }
            return {
              ...prev,
              currentLocation: newLocation,
              route: [newLocation],
              gpsAccuracy: position.coords.accuracy
            };
          });
        },
        (error) => {
          console.error('GPS tracking error:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 30000,
          timeout: 27000
        }
      );
    }
  }, [calculateDistance]);

  // Start vehicle tracking
  const startVehicleTracking = useCallback((vehicleConnectionId: string) => {
    vehiclePollingRef.current = setInterval(async () => {
      try {
        const connection = connections.find(c => c.id === vehicleConnectionId);
        if (!connection) return;

        const { data, error } = await supabase.functions.invoke('smartcar-vehicle-data', {
          body: {
            access_token: connection.access_token,
            vehicle_id: connection.smartcar_vehicle_id
          }
        });

        if (error) throw error;

        const vehicleData = data?.data;
        if (vehicleData) {
          setTrip(prev => ({
            ...prev,
            vehicleData: vehicleData
          }));

          // Update location if vehicle provides it
          if (vehicleData.location) {
            const newLocation: LocationData = {
              lat: vehicleData.location.latitude,
              lng: vehicleData.location.longitude,
              timestamp: new Date().toISOString()
            };

            setTrip(prev => {
              if (prev.currentLocation) {
                const distance = calculateDistance(prev.currentLocation, newLocation);
                
                return {
                  ...prev,
                  currentLocation: newLocation,
                  route: [...prev.route, newLocation],
                  distance: prev.distance + distance
                };
              }
              return {
                ...prev,
                currentLocation: newLocation,
                route: [newLocation]
              };
            });
          }
        }
      } catch (error) {
        console.error('Vehicle tracking error:', error);
      }
    }, 30000); // Poll every 30 seconds
  }, [connections, calculateDistance]);

  // Stop all tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    if (vehiclePollingRef.current) {
      clearInterval(vehiclePollingRef.current);
      vehiclePollingRef.current = null;
    }
  }, []);

  // Pause trip
  const pauseTrip = useCallback(() => {
    stopTracking();
    setTrip(prev => ({ ...prev, status: 'paused' }));
    
    toast({
      title: 'Resa pausad',
      description: 'Spårning har pausats.',
    });
  }, [stopTracking, toast]);

  // Resume trip
  const resumeTrip = useCallback(() => {
    setTrip(prev => ({ ...prev, status: 'active' }));
    
    // Restart tracking based on source
    if (trip.source === 'gps' || trip.source === 'hybrid') {
      startGPSTracking();
    }
    
    if ((trip.source === 'vehicle' || trip.source === 'hybrid') && trip.vehicleConnectionId) {
      startVehicleTracking(trip.vehicleConnectionId);
    }
    
    toast({
      title: 'Resa återupptagen',
      description: 'Spårning är aktivt igen.',
    });
  }, [trip.source, trip.vehicleConnectionId, startGPSTracking, startVehicleTracking, toast]);

  // Stop and save trip
  const stopTrip = useCallback(async () => {
    stopTracking();

    try {
      const location = await getCurrentLocation();
      const now = new Date();
      
      setTrip(prev => ({
        ...prev,
        status: 'inactive',
        endTime: now,
        currentLocation: location
      }));

      // Save trip to database
      if (trip.startTime && trip.startLocation) {
        await saveTrip({
          start_time: trip.startTime.toISOString(),
          end_time: now.toISOString(),
          start_location: trip.startLocation,
          end_location: location,
          distance_km: trip.distance,
          duration_minutes: Math.floor(trip.duration / 60),
          trip_type: trip.tripType,
          trip_status: 'completed',
          route_data: trip.route,
          notes: trip.notes,
          vehicle_connection_id: trip.vehicleConnectionId
        });
      }

      toast({
        title: 'Resa avslutad!',
        description: 'Resan har sparats och kan nu kategoriseras.',
      });
    } catch (error) {
      toast({
        title: 'Resa avslutad',
        description: 'Kunde inte hämta slutposition, men resan har sparats.',
        variant: 'destructive',
      });
    }
  }, [stopTracking, getCurrentLocation, trip, saveTrip, toast]);

  // Update trip metadata
  const updateTripMetadata = useCallback((updates: Partial<Pick<HybridTripData, 'tripType' | 'notes'>>) => {
    setTrip(prev => ({ ...prev, ...updates }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    trip,
    availableSources,
    startTrip,
    pauseTrip,
    resumeTrip,
    stopTrip,
    updateTripMetadata
  };
};