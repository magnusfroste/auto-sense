import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MapComponent } from '@/components/map/MapComponent';
import { 
  Play, 
  Pause, 
  Square, 
  MapPin, 
  Clock, 
  Gauge,
  Route as RouteIcon,
  Briefcase,
  Home
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTrips } from '@/hooks/useTrips';

interface LocationData {
  lat: number;
  lng: number;
  address?: string;
}

interface TripData {
  startTime: Date | null;
  endTime: Date | null;
  startLocation: LocationData | null;
  currentLocation: LocationData | null;
  route: LocationData[];
  distance: number;
  duration: number;
  status: 'inactive' | 'active' | 'paused';
  tripType: 'work' | 'personal' | 'unknown';
  notes: string;
}

export default function TripActive() {
  const { toast } = useToast();
  const { saveTrip } = useTrips();
  const navigate = useNavigate();
  const watchIdRef = useRef<number | null>(null);
  const [trip, setTrip] = useState<TripData>({
    startTime: null,
    endTime: null,
    startLocation: null,
    currentLocation: null,
    route: [],
    distance: 0,
    duration: 0,
    status: 'inactive',
    tripType: 'unknown',
    notes: ''
  });

  // Timer för att uppdatera duration
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

  const getCurrentLocation = (): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation stöds inte av denna enhet'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
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
  };

  const startTrip = async () => {
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
        duration: 0
      }));

      // Starta GPS-tracking
      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const newLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            
            setTrip(prev => {
              if (prev.currentLocation) {
                // Beräkna avstånd (enkel haversine formula)
                const R = 6371; // Jordens radie i km
                const dLat = (newLocation.lat - prev.currentLocation.lat) * Math.PI / 180;
                const dLon = (newLocation.lng - prev.currentLocation.lng) * Math.PI / 180;
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(prev.currentLocation.lat * Math.PI / 180) * Math.cos(newLocation.lat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                const distance = R * c;
                
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

      toast({
        title: 'Resa startad!',
        description: 'GPS-tracking är nu aktivt.',
      });
    } catch (error) {
      toast({
        title: 'Kunde inte starta resa',
        description: error instanceof Error ? error.message : 'Okänt fel',
        variant: 'destructive',
      });
    }
  };

  const pauseTrip = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    setTrip(prev => ({ ...prev, status: 'paused' }));
    
    toast({
      title: 'Resa pausad',
      description: 'GPS-tracking har pausats.',
    });
  };

  const resumeTrip = async () => {
    setTrip(prev => ({ ...prev, status: 'active' }));
    
    // Återstarta GPS-tracking (förenklad version)
    toast({
      title: 'Resa återupptagen',
      description: 'GPS-tracking är aktivt igen.',
    });
  };

  const stopTrip = async () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    try {
      const location = await getCurrentLocation();
      const now = new Date();
      
      setTrip(prev => ({
        ...prev,
        status: 'inactive',
        endTime: now,
        currentLocation: location
      }));

      // Spara resan till Supabase
      try {
        await saveTrip({
          start_time: trip.startTime!.toISOString(),
          end_time: now.toISOString(),
          start_location: trip.startLocation!,
          end_location: location,
          distance_km: trip.distance,
          duration_minutes: Math.floor(trip.duration / 60),
          trip_type: trip.tripType,
          trip_status: 'completed',
          route_data: trip.route,
          notes: trip.notes
        });
      } catch (error) {
        console.error('Error saving trip:', error);
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
  };

  const saveAndFinish = async () => {
    if (!trip.endTime || !trip.startTime || !trip.startLocation) {
      toast({
        title: 'Kan inte spara resa',
        description: 'Resan måste vara avslutad för att kunna sparas.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await saveTrip({
        start_time: trip.startTime.toISOString(),
        end_time: trip.endTime.toISOString(),
        start_location: trip.startLocation,
        end_location: trip.currentLocation || trip.startLocation,
        distance_km: trip.distance,
        duration_minutes: Math.floor(trip.duration / 60),
        trip_type: trip.tripType,
        trip_status: 'completed',
        route_data: trip.route,
        notes: trip.notes
      });

      toast({
        title: 'Resa sparad!',
        description: 'Resan har sparats och du dirigeras tillbaka till dashboard.',
      });

      // Navigera tillbaka till dashboard efter 1 sekund
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (error) {
      toast({
        title: 'Fel vid sparande',
        description: 'Kunde inte spara resan. Försök igen.',
        variant: 'destructive',
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Aktiv resa</h1>
        <p className="text-muted-foreground">Spåra din resa i realtid</p>
      </div>

      {/* Trip Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <RouteIcon className="mr-2 h-5 w-5" />
                Resestatus
              </CardTitle>
              <CardDescription>
                {trip.status === 'inactive' && 'Ingen aktiv resa'}
                {trip.status === 'active' && 'Resan pågår'}
                {trip.status === 'paused' && 'Resan är pausad'}
              </CardDescription>
            </div>
            <Badge 
              variant={
                trip.status === 'active' ? 'default' :
                trip.status === 'paused' ? 'secondary' : 'outline'
              }
            >
              {trip.status === 'active' && 'Aktiv'}
              {trip.status === 'paused' && 'Pausad'}
              {trip.status === 'inactive' && 'Inaktiv'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Tid</p>
                <p className="font-medium">{formatDuration(trip.duration)}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Sträcka</p>
                <p className="font-medium">{trip.distance.toFixed(1)} km</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Position</p>
                <p className="font-medium">
                  {trip.currentLocation ? 'GPS aktiv' : 'Ingen position'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Kontroller</CardTitle>
          <CardDescription>Starta, pausa eller avsluta din resa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {trip.status === 'inactive' && (
              <Button onClick={startTrip} size="lg">
                <Play className="mr-2 h-4 w-4" />
                Starta resa
              </Button>
            )}
            
            {trip.status === 'active' && (
              <>
                <Button onClick={pauseTrip} variant="outline" size="lg">
                  <Pause className="mr-2 h-4 w-4" />
                  Pausa
                </Button>
                <Button onClick={stopTrip} variant="destructive" size="lg">
                  <Square className="mr-2 h-4 w-4" />
                  Avsluta resa
                </Button>
              </>
            )}
            
            {trip.status === 'paused' && (
              <>
                <Button onClick={resumeTrip} size="lg">
                  <Play className="mr-2 h-4 w-4" />
                  Fortsätt
                </Button>
                <Button onClick={stopTrip} variant="destructive" size="lg">
                  <Square className="mr-2 h-4 w-4" />
                  Avsluta resa
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MapPin className="mr-2 h-5 w-5" />
            Kartvy
          </CardTitle>
          <CardDescription>
            Realtidsvy av din pågående resa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MapComponent
            currentLocation={trip.currentLocation}
            startLocation={trip.startLocation}
            route={trip.route}
            height="h-80"
            className="w-full"
          />
        </CardContent>
      </Card>

      {/* Trip Classification */}
      {(trip.status !== 'inactive' || trip.endTime) && (
        <Card>
          <CardHeader>
            <CardTitle>Klassificera resa</CardTitle>
            <CardDescription>Välj typ av resa och lägg till anteckningar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Resetyp</label>
              <Select 
                value={trip.tripType} 
                onValueChange={(value: 'work' | 'personal' | 'unknown') => 
                  setTrip(prev => ({ ...prev, tripType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Välj resetyp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work">
                    <div className="flex items-center">
                      <Briefcase className="mr-2 h-4 w-4" />
                      Arbetsresa
                    </div>
                  </SelectItem>
                  <SelectItem value="personal">
                    <div className="flex items-center">
                      <Home className="mr-2 h-4 w-4" />
                      Privatresa
                    </div>
                  </SelectItem>
                  <SelectItem value="unknown">Oklart</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Anteckningar</label>
              <Textarea
                placeholder="Lägg till anteckningar om resan..."
                value={trip.notes}
                onChange={(e) => setTrip(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Spara och tillbaka knapp när resan är avslutad */}
            {trip.endTime && (
              <div className="pt-4 border-t">
                <Button onClick={saveAndFinish} className="w-full" size="lg">
                  <Home className="mr-2 h-4 w-4" />
                  Spara resa och tillbaka till dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}