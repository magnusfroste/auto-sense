import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { useTrips } from './useTrips';

interface LocationData {
  lat: number;
  lng: number;
  address?: string;
}

interface GPSTrip {
  id?: string;
  startLocation: LocationData | null;
  endLocation: LocationData | null;
  distance: number;
  duration: number;
  isActive: boolean;
  startTime: Date | null;
  endTime: Date | null;
  route: LocationData[];
}

export function useGPSTrip() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { saveTrip } = useTrips();
  
  const [trip, setTrip] = useState<GPSTrip>({
    startLocation: null,
    endLocation: null,
    distance: 0,
    duration: 0,
    isActive: false,
    startTime: null,
    endTime: null,
    route: [],
  });

  const watchIdRef = useRef<number | null>(null);
  const routeRef = useRef<LocationData[]>([]);
  const lastLocationRef = useRef<LocationData | null>(null);

  const startTrip = useCallback(async () => {
    if (!user || !navigator.geolocation) {
      toast({
        title: 'Fel',
        description: 'GPS är inte tillgängligt på denna enhet.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Get initial position
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 1000,
        });
      });

      const startLocation: LocationData = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      setTrip(prev => ({
        ...prev,
        isActive: true,
        startLocation,
        startTime: new Date(),
        route: [startLocation],
      }));

      routeRef.current = [startLocation];
      lastLocationRef.current = startLocation;

      // Start watching position
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation: LocationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          routeRef.current.push(newLocation);
          
          // Calculate distance if we have a previous location
          if (lastLocationRef.current) {
            const distance = calculateDistance(lastLocationRef.current, newLocation);
            setTrip(prev => ({
              ...prev,
              distance: prev.distance + distance,
              route: [...routeRef.current],
            }));
          }

          lastLocationRef.current = newLocation;
        },
        (error) => {
          console.error('GPS tracking error:', error);
          toast({
            title: 'GPS-fel',
            description: 'Problem med GPS-spårning.',
            variant: 'destructive',
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 1000,
        }
      );

      toast({
        title: 'Resa startad!',
        description: 'GPS-spårning är nu aktivt.',
      });
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte starta GPS-spårning.',
        variant: 'destructive',
      });
    }
  }, [user, toast]);

  const stopTrip = useCallback(async () => {
    if (!trip.isActive || !trip.startTime || !trip.startLocation) {
      return;
    }

    // Stop GPS tracking
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const endTime = new Date();
    const endLocation = routeRef.current[routeRef.current.length - 1] || trip.startLocation;
    const duration = Math.round((endTime.getTime() - trip.startTime.getTime()) / 1000 / 60);

    try {
      await saveTrip({
        start_time: trip.startTime.toISOString(),
        end_time: endTime.toISOString(),
        start_location: trip.startLocation,
        end_location: endLocation,
        distance_km: trip.distance,
        duration_minutes: duration,
        trip_type: 'unknown',
        trip_status: 'completed',
        route_data: routeRef.current,
      });

      setTrip({
        startLocation: null,
        endLocation: endLocation,
        distance: 0,
        duration: 0,
        isActive: false,
        startTime: null,
        endTime: endTime,
        route: [],
      });

      routeRef.current = [];
      lastLocationRef.current = null;

      toast({
        title: 'Resa sparad!',
        description: `Resa på ${trip.distance.toFixed(1)} km sparad.`,
      });
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte spara resan.',
        variant: 'destructive',
      });
    }
  }, [trip, saveTrip, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    trip,
    startTrip,
    stopTrip,
  };
}

// Helper function to calculate distance between two coordinates
function calculateDistance(coord1: LocationData, coord2: LocationData): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}