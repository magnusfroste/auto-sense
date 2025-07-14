import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useVehicleConnections } from '@/hooks/useVehicleConnections';
import { MapComponent } from '@/components/map/MapComponent';
import { supabase } from '@/integrations/supabase/client';
import { Car, MapPin, Gauge, Clock, RefreshCw } from 'lucide-react';

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
  const [vehicleState, setVehicleState] = useState<VehicleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    fetchVehicleState();
    const interval = setInterval(fetchVehicleState, 5000); // Uppdatera var 5:e sekund
    return () => clearInterval(interval);
  }, [connections]);

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
        setVehicleState({
          id: data.id,
          last_odometer: data.last_odometer,
          last_location: location ? {
            latitude: location.latitude,
            longitude: location.longitude
          } : null,
          last_poll_time: data.last_poll_time,
          polling_frequency: data.polling_frequency
        });
      }
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching vehicle state:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    fetchVehicleState();
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
        <Button
          variant="outline"
          size="sm"
          onClick={refreshData}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Uppdatera
        </Button>
      </div>

      {/* Live Map */}
      {vehicleState?.last_location && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MapPin className="mr-2 h-5 w-5" />
              Aktuell position
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MapComponent
              currentLocation={{
                lat: vehicleState.last_location.latitude,
                lng: vehicleState.last_location.longitude
              }}
              height="400px"
              showNavigation={true}
            />
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
              {vehicleState?.last_odometer?.toLocaleString() || 'N/A'} km
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

      {/* Last Update Info */}
      <div className="text-center text-xs text-muted-foreground">
        Sida uppdaterad: {lastUpdate.toLocaleTimeString('sv-SE')} • 
        Data uppdateras automatiskt var 5:e sekund
      </div>
    </div>
  );
}