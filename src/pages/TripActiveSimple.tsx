import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useVehicleConnections } from '@/hooks/useVehicleConnections';
import { useActiveTrip } from '@/hooks/useActiveTrip';
import { MapComponent } from '@/components/map/MapComponent';
import { supabase } from '@/integrations/supabase/client';
import { Car, MapPin, Gauge, Clock, RefreshCw, Route, Timer, Play, Bug, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface VehicleState {
  id: string;
  last_odometer: number | null;
  last_location: { latitude: number; longitude: number } | null;
  last_poll_time: string | null;
  polling_frequency: number;
}

export default function TripActiveSimple(): JSX.Element {
  const { user } = useAuth();
  const { connections } = useVehicleConnections();
  const { activeTrip, loading: tripLoading } = useActiveTrip(connections[0]?.id);
  const [vehicleState, setVehicleState] = useState<VehicleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);
  const [isEndingTrip, setIsEndingTrip] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchVehicleState();
    triggerPolling(); // Re-enabled automatic initial polling
    
    const dataInterval = setInterval(fetchVehicleState, 5000); // Uppdatera UI var 5:e sekund
    const pollingInterval = setInterval(triggerPolling, 30000); // Re-enabled automatic polling every 30s
    
    return () => {
      clearInterval(dataInterval);
      clearInterval(pollingInterval);
    };
  }, [connections]);

  // Memoize location props to prevent unnecessary re-renders
  const currentLocation = useMemo(() => vehicleState?.last_location ? {
    lat: vehicleState.last_location.latitude,
    lng: vehicleState.last_location.longitude
  } : undefined, [vehicleState?.last_location?.latitude, vehicleState?.last_location?.longitude]);

  const startLocation = useMemo(() => activeTrip?.start_location ? {
    lat: activeTrip.start_location.latitude,
    lng: activeTrip.start_location.longitude
  } : undefined, [activeTrip?.start_location?.latitude, activeTrip?.start_location?.longitude]);

  const route = useMemo(() => activeTrip?.route_data ? {
    type: 'LineString',
    coordinates: activeTrip.route_data
  } : undefined, [activeTrip?.route_data]);

  const fetchVehicleState = async () => {
    if (connections.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('vehicle_states')
        .select('*')
        .eq('connection_id', connections[0].id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        // Parse the location data correctly
        const location = data.last_location as any;
        const newState = {
          id: data.id,
          last_odometer: data.last_odometer,
          last_location: location ? {
            latitude: location.latitude,
            longitude: location.longitude
          } : null,
          last_poll_time: data.last_poll_time,
          polling_frequency: data.polling_frequency
        };

        // Only update state if data has actually changed
        setVehicleState(prevState => {
          if (!prevState) return newState;
          
          const hasChanged = 
            prevState.last_odometer !== newState.last_odometer ||
            prevState.last_poll_time !== newState.last_poll_time ||
            JSON.stringify(prevState.last_location) !== JSON.stringify(newState.last_location);
          
          return hasChanged ? newState : prevState;
        });
      }
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching vehicle state:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerPolling = async () => {
    if (connections.length === 0) return;

    try {
      console.log('🔄 Auto-triggering vehicle polling...', new Date().toLocaleTimeString());
      const { data, error } = await supabase.functions.invoke('vehicle-trip-polling-v2', {
        body: { 
          connectionId: connections[0].id,
          action: 'poll_single',
          debug: true,
          timestamp: new Date().toISOString()
        }
      });
      
      console.log('📡 Full polling response:', { data, error, status: 'complete' });
      
      if (error) {
        console.error('❌ Polling error details:', error);
      } else {
        console.log('✅ Auto-polling completed successfully:', data);
      }
    } catch (error) {
      console.error('❌ Auto-polling exception:', error);
    }
  };

  const refreshData = async () => {
    console.log('🔄 Manual refresh initiated...');
    setLoading(true);
    
    try {
      // Force fetch latest data immediately
      await fetchVehicleState();
      
      // Then trigger polling for future updates
      await triggerPolling();
      
      setLastUpdate(new Date());
      console.log('✅ Manual refresh completed');
      
    } catch (error) {
      console.error('❌ Manual refresh error:', error);
    } finally {
      setLoading(false);
    }
  };

  const manualCreateTrip = async () => {
    if (!vehicleState?.last_location || !vehicleState?.last_odometer) {
      toast({
        title: 'Kan inte skapa resa',
        description: 'Saknar position eller odometer data',
        variant: 'destructive'
      });
      return;
    }

    setIsCreatingTrip(true);
    try {
      console.log('🚗 Manually creating trip...');
      
      const { data, error } = await supabase
        .from('sense_trips')
        .insert([{
          user_id: user?.id,
          vehicle_connection_id: connections[0]?.id,
          start_location: vehicleState.last_location,
          odometer_km: vehicleState.last_odometer,
          trip_type: 'unknown',
          trip_status: 'active',
          is_automatic: false,
          notes: 'Manuellt skapad resa'
        }])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Manual trip created:', data);
      
      toast({
        title: 'Resa skapad',
        description: 'Manuell resa har startats framgångsrikt'
      });

      // Refresh data to show the new trip
      await fetchVehicleState();
      
    } catch (error: any) {
      console.error('❌ Manual trip creation error:', error);
      toast({
        title: 'Fel vid skapande av resa',
        description: error.message || 'Kunde inte skapa resa manuellt',
        variant: 'destructive'
      });
    } finally {
      setIsCreatingTrip(false);
    }
  };

  const manualEndTrip = async () => {
    if (!activeTrip) {
      toast({
        title: 'Ingen aktiv resa',
        description: 'Det finns ingen resa att avsluta',
        variant: 'destructive'
      });
      return;
    }

    setIsEndingTrip(true);
    try {
      console.log('🛑 Manually ending trip:', activeTrip.id);
      
      const { data, error } = await supabase
        .from('sense_trips')
        .update({
          trip_status: 'completed',
          end_time: new Date().toISOString(),
          end_location: vehicleState?.last_location || activeTrip.start_location,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeTrip.id)
        .eq('user_id', user?.id)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Trip ended manually:', data);
      
      toast({
        title: 'Resa avslutad',
        description: 'Resan har avslutats manuellt'
      });

      // Refresh data to update UI
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error: any) {
      console.error('❌ Manual trip end error:', error);
      toast({
        title: 'Fel vid avslutning av resa',
        description: error.message || 'Kunde inte avsluta resa manuellt',
        variant: 'destructive'
      });
    } finally {
      setIsEndingTrip(false);
    }
  };

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

  if (connections.length === 0) {
    return (
      <div className="p-4 lg:p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <Car className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Inga fordon anslutna</h3>
            <p className="text-muted-foreground mb-4">
              Du behöver ansluta ett fordon för att se live data.
            </p>
            <Button onClick={() => window.location.href = '/settings?tab=vehicles'}>
              Anslut fordon
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const vehicle = connections[0];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Live fordondata</h1>
          <p className="text-muted-foreground">
            {vehicle.make} {vehicle.model} {vehicle.year && `(${vehicle.year})`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Uppdatera
          </Button>
          {!activeTrip && (
            <Button
              variant="default"
              size="sm"
              onClick={manualCreateTrip}
              disabled={isCreatingTrip}
            >
              {isCreatingTrip ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {isCreatingTrip ? 'Skapar...' : 'Starta resa'}
            </Button>
          )}
          {activeTrip && (
            <Button
              variant="destructive"
              size="sm"
              onClick={manualEndTrip}
              disabled={isEndingTrip}
            >
              {isEndingTrip ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              {isEndingTrip ? 'Avslutar...' : 'Avsluta resa'}
            </Button>
          )}
        </div>
      </div>

      {/* Live Map with Trip Data */}
      {vehicleState?.last_location && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MapPin className="mr-2 h-5 w-5" />
              {activeTrip ? 'Pågående resa' : 'Aktuell position'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MapComponent
              currentLocation={currentLocation}
              startLocation={startLocation}
              route={route}
              height="h-96"
              showNavigation={true}
            />
          </CardContent>
        </Card>
      )}

      {/* Active Trip Info */}
      {activeTrip && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Route className="mr-2 h-5 w-5" />
              Resa pågår
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {activeTrip.distance_km ? activeTrip.distance_km.toFixed(1) : '0.0'} km
                </div>
                <p className="text-sm text-muted-foreground">Distans</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {activeTrip.duration_minutes ? Math.floor(activeTrip.duration_minutes / 60) : 0}h {activeTrip.duration_minutes ? activeTrip.duration_minutes % 60 : 0}m
                </div>
                <p className="text-sm text-muted-foreground">Tid</p>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">
                  {new Date(activeTrip.start_time).toLocaleTimeString('sv-SE')}
                </div>
                <p className="text-sm text-muted-foreground">Starttid</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Typ: <span className="font-medium capitalize">{activeTrip.trip_type}</span>
                {activeTrip.route_data && (
                  <span className="ml-4">
                    Ruttpunkter: <span className="font-medium">{activeTrip.route_data.length}</span>
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Vehicle Data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Gauge className="mr-2 h-4 w-4" />
              Odometer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vehicleState?.last_odometer?.toFixed(1) || 'N/A'} km
            </div>
            <p className="text-xs text-muted-foreground">Total körsträcka</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <MapPin className="mr-2 h-4 w-4" />
              Position
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {vehicleState?.last_location ? (
                <>
                  <div>{vehicleState.last_location.latitude.toFixed(6)}</div>
                  <div>{vehicleState.last_location.longitude.toFixed(6)}</div>
                </>
              ) : (
                'N/A'
              )}
            </div>
            <p className="text-xs text-muted-foreground">Lat/Lng koordinater</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Clock className="mr-2 h-4 w-4" />
              Senast uppdaterad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {vehicleState?.last_poll_time ? (
                new Date(vehicleState.last_poll_time).toLocaleTimeString('sv-SE')
              ) : (
                'N/A'
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Polling: var {vehicleState?.polling_frequency || 120}s
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Car className="mr-2 h-5 w-5" />
            Fordonsstatus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Anslutning:</span>
              <span className="font-medium text-green-600">Aktiv</span>
            </div>
            <div className="flex items-center justify-between">
              <span>VIN:</span>
              <span className="font-mono text-sm">{vehicle.vin || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Smartcar ID:</span>
              <span className="font-mono text-xs">{vehicle.smartcar_vehicle_id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Ansluten:</span>
              <span className="text-sm">
                {new Date(vehicle.connected_at).toLocaleDateString('sv-SE')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debug Panel - Only in development */}
      {process.env.NODE_ENV !== 'production' && (
        <Card className="border-dashed border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="flex items-center text-yellow-800 dark:text-yellow-200">
              <Bug className="mr-2 h-5 w-5" />
              Trip Detection Debug
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium mb-2">Trip Status:</p>
                <Badge variant={activeTrip ? "default" : "secondary"}>
                  {activeTrip ? 'Aktiv resa' : 'Ingen resa'}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Movement Detection:</p>
                <Badge variant="outline">
                  Treshold: 10m (testläge)
                </Badge>
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Auto-polling: var 30s</p>
              <p>• Movement threshold: 10m (sänkt från 100m för testning)</p>
              <p>• Trip timeout: 30s (sänkt från 2min för testning)</p>
              <p>• Check browser console för detaljerad logging</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Update Info */}
      <div className="text-center text-xs text-muted-foreground">
        Sida uppdaterad: {lastUpdate.toLocaleTimeString('sv-SE')} • 
        Data uppdateras automatiskt var 5:e sekund
      </div>
    </div>
  );
}