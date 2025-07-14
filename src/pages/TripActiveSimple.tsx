import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useGPSTrip } from '@/hooks/useGPSTrip';
import { useVehicleTrip } from '@/hooks/useVehicleTrip';
import { useVehiclePolling } from '@/hooks/useVehiclePolling';
import { useVehicleConnections } from '@/hooks/useVehicleConnections';
import { useTrips } from '@/hooks/useTrips';
import { TrackingModeSetup } from '@/components/onboarding/TrackingModeSetup';
import { supabase } from '@/integrations/supabase/client';
import { Car, MapPin, Activity, Clock, Play, Square, Route, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TripActiveSimple(): JSX.Element {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { trip: gpsTrip, startTrip: startGPSTrip, stopTrip: stopGPSTrip } = useGPSTrip();
  const { vehicleTrip, enableVehicleTracking } = useVehicleTrip();
  const { hasActiveTrips, startAllVehiclePolling } = useVehiclePolling();
  const { connections } = useVehicleConnections();
  const { trips } = useTrips();
  const [trackingMode, setTrackingMode] = useState<'gps' | 'vehicle' | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    fetchTrackingMode();
  }, [user]);

  const fetchTrackingMode = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('sense_profiles')
        .select('tracking_mode')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      const mode = data?.tracking_mode as 'gps' | 'vehicle' | null;
      
      // Om ingen tracking mode är satt, visa onboarding
      if (!mode) {
        setShowOnboarding(true);
        setLoading(false);
        return;
      }
      
      setTrackingMode(mode);
    } catch (error) {
      console.error('Error fetching tracking mode:', error);
      setShowOnboarding(true); // Visa onboarding vid fel också
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingComplete = (mode: 'gps' | 'vehicle') => {
    setTrackingMode(mode);
    setShowOnboarding(false);
  };

  const handleConnectVehicle = () => {
    navigate('/settings?tab=vehicles');
  };

  const switchToGPS = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('sense_profiles')
        .update({ tracking_mode: 'gps' })
        .eq('id', user.id);

      if (error) throw error;
      
      setTrackingMode('gps');
    } catch (error) {
      console.error('Error switching to GPS mode:', error);
    }
  };

  // Get active trips
  const activeTrips = trips.filter(trip => trip.trip_status === 'active');
  const isAnyTripActive = gpsTrip.isActive || hasActiveTrips() || activeTrips.length > 0;

  if (loading) {
    return (
      <div className="p-4 lg:p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Visa onboarding om tracking mode inte är satt
  if (showOnboarding) {
    return (
      <div className="p-4 lg:p-6">
        <Card>
          <CardContent className="p-6">
            <TrackingModeSetup 
              onComplete={handleOnboardingComplete}
              onConnectVehicle={handleConnectVehicle}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Aktiv resa</h1>
          <p className="text-muted-foreground">
            {trackingMode === 'gps' ? 'Manuell GPS-spårning' : 'Automatisk fordonsspårning'}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {isAnyTripActive && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-green-600">Resa pågår</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/settings?tab=tracking')}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Active Trips Overview */}
      {activeTrips.length > 0 && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="flex items-center text-green-700 dark:text-green-300">
              <Play className="mr-2 h-5 w-5" />
              Aktiva resor ({activeTrips.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeTrips.map((trip) => (
              <div key={trip.id} className="flex items-center justify-between p-3 rounded-lg border bg-white dark:bg-gray-900">
                <div>
                  <p className="font-medium">
                    {trip.start_location?.address || 'Startpunkt'} → {trip.end_location?.address || 'Målet'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Startad: {new Date(trip.start_time).toLocaleTimeString('sv-SE')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{trip.distance_km?.toFixed(1) || '0'} km</p>
                  <Badge variant={trip.trip_type === 'work' ? 'default' : 'secondary'}>
                    {trip.trip_type === 'work' ? 'Arbete' : 'Privat'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* GPS Mode */}
      {trackingMode === 'gps' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5" />
                <span>GPS-spårning</span>
              </CardTitle>
              <Badge variant={gpsTrip.isActive ? "default" : "secondary"}>
                {gpsTrip.isActive ? 'Aktiv' : 'Inaktiv'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {gpsTrip.isActive ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <Route className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold">{gpsTrip.distance.toFixed(1)} km</p>
                    <p className="text-sm text-muted-foreground">Avstånd</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <Clock className="h-6 w-6 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold">
                      {gpsTrip.startTime ? Math.round((Date.now() - gpsTrip.startTime.getTime()) / 1000 / 60) : 0} min
                    </p>
                    <p className="text-sm text-muted-foreground">Tid</p>
                  </div>
                </div>
                
                <Button onClick={stopGPSTrip} variant="destructive" className="w-full" size="lg">
                  <Square className="h-4 w-4 mr-2" />
                  Stoppa resa
                </Button>
              </>
            ) : (
              <>
                <p className="text-center text-muted-foreground py-8">
                  Ingen aktiv resa. Tryck på knappen nedan för att starta GPS-spårning.
                </p>
                
                <Button onClick={startGPSTrip} className="w-full" size="lg">
                  <Play className="h-4 w-4 mr-2" />
                  Starta GPS-resa
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vehicle Mode */}
      {trackingMode === 'vehicle' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Car className="h-5 w-5" />
                <span>Automatisk fordons-spårning</span>
              </CardTitle>
              <Badge variant={vehicleTrip.isMonitoring ? "default" : "secondary"}>
                {vehicleTrip.isMonitoring ? 'Aktiverad' : 'Inaktiv'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {vehicleTrip.isMonitoring ? (
              <>
                <div className="text-center p-8 bg-muted rounded-lg">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-primary" />
                  <p className="text-lg font-medium mb-2">Automatisk spårning är aktiverad</p>
                  <p className="text-muted-foreground">
                    Resor detekteras och spåras automatiskt när du kör med ditt anslutna fordon.
                    Du behöver inte göra något - resor startar och stoppar automatiskt.
                  </p>
                </div>
                
                {vehicleTrip.vehicleStatus && (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      Status: {vehicleTrip.vehicleStatus}
                    </p>
                  </div>
                )}
                
              </>
            ) : (
              <>
                {connections.filter(conn => conn.is_active).length === 0 ? (
                  // No active vehicles - show fallback options
                  <div className="space-y-4">
                    <div className="text-center p-8 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <Car className="h-12 w-12 mx-auto mb-4 text-yellow-600 dark:text-yellow-400" />
                      <p className="text-lg font-medium mb-2 text-yellow-800 dark:text-yellow-200">
                        Inga fordon anslutna
                      </p>
                      <p className="text-yellow-700 dark:text-yellow-300 mb-4">
                        Du har valt automatisk fordonsspårning men inga fordon är anslutna. 
                        Välj ett alternativ nedan:
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button 
                        onClick={handleConnectVehicle}
                        variant="outline"
                        className="w-full"
                        size="lg"
                      >
                        <Car className="h-4 w-4 mr-2" />
                        Anslut fordon
                      </Button>
                      
                      <Button 
                        onClick={switchToGPS}
                        variant="outline"
                        className="w-full"
                        size="lg"
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        Byt till GPS
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Has vehicles but not monitoring
                  <>
                    <div className="text-center p-8 bg-muted rounded-lg">
                      <Car className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-lg font-medium mb-2">Automatisk spårning är inte aktiverad</p>
                      <p className="text-muted-foreground mb-4">
                        Aktivera automatisk spårning för att få resor detekterade automatiskt från ditt fordon.
                      </p>
                    </div>
                    
                    <Button 
                      onClick={() => {
                        enableVehicleTracking();
                        startAllVehiclePolling();
                      }}
                      className="w-full" 
                      size="lg"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Aktivera automatisk spårning
                    </Button>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}