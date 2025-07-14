import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Car, Unplug, Calendar, Activity, MapPin, Gauge, Fuel, Info, Target } from 'lucide-react';
import { useVehicleConnections } from '@/hooks/useVehicleConnections';
import { useVehiclePolling } from '@/hooks/useVehiclePolling';
import { supabase } from '@/integrations/supabase/client';

interface VehicleConnection {
  id: string;
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  connected_at: string;
  last_sync_at?: string;
  is_active: boolean;
  access_token: string;
  smartcar_vehicle_id: string;
}

interface VehicleData {
  location?: {
    latitude: number;
    longitude: number;
  };
  odometer?: {
    distance: number;
  };
  fuel?: {
    percent: number;
  };
  info?: {
    make: string;
    model: string;
    year: number;
  };
}

interface VehicleConnectionCardProps {
  connection: VehicleConnection;
}

export const VehicleConnectionCard = ({ connection }: VehicleConnectionCardProps) => {
  const { disconnectVehicle } = useVehicleConnections();
  const { getVehicleState } = useVehiclePolling();
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Get current vehicle state from polling system
  const vehicleState = getVehicleState(connection.id);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const fetchVehicleData = useCallback(async () => {
    if (!connection.access_token || !connection.smartcar_vehicle_id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('smartcar-vehicle-data', {
        body: {
          vehicleId: connection.smartcar_vehicle_id,
          accessToken: connection.access_token
        }
      });

      if (error) throw error;
      
      console.log('Received vehicle data:', data);
      setVehicleData(data?.data || data);
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Error fetching vehicle data:', error);
    } finally {
      setLoading(false);
    }
  }, [connection.access_token, connection.smartcar_vehicle_id]);



  const getVehicleName = () => {
    if (vehicleData?.info) {
      return `${vehicleData.info.make} ${vehicleData.info.model} (${vehicleData.info.year})`;
    }
    if (connection.make && connection.model && connection.year) {
      return `${connection.make} ${connection.model} (${connection.year})`;
    }
    return 'Okänt fordon';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-2">
          <Car className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-lg">{getVehicleName()}</CardTitle>
            <CardDescription>
              {connection.vin ? `VIN: ${connection.vin.slice(-6)}` : 'VIN ej tillgängligt'}
            </CardDescription>
          </div>
        </div>
        <Badge variant={connection.is_active ? 'default' : 'secondary'}>
          {connection.is_active ? 'Aktiv' : 'Inaktiv'}
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Ansluten:</span>
          </div>
          <span className="text-muted-foreground">
            {formatDate(connection.connected_at)}
          </span>
        </div>

        {connection.last_sync_at && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span>Senast sync:</span>
            </div>
            <span className="text-muted-foreground">
              {formatDate(connection.last_sync_at)}
            </span>
          </div>
        )}

        {/* Trip Detection Status */}
        {vehicleState && (
          <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Trip Detection
              </h4>
              <Badge variant={vehicleState.current_trip_id ? 'default' : 'secondary'}>
                {vehicleState.current_trip_id ? 'Pågående resa' : 'Väntar'}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              {vehicleState.last_odometer && (
                <div className="flex items-center gap-1">
                  <Gauge className="h-3 w-3 text-muted-foreground" />
                  <span>{(vehicleState.last_odometer / 1000).toFixed(0)} km</span>
                </div>
              )}
              
              {vehicleState.last_poll_time && (
                <div className="text-muted-foreground">
                  Senast: {new Date(vehicleState.last_poll_time).toLocaleTimeString('sv-SE')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Vehicle Data */}
        {vehicleData && (
          <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Live Data
              </h4>
              {lastUpdated && (
                <span className="text-xs text-muted-foreground">
                  {lastUpdated.toLocaleTimeString('sv-SE')}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              {vehicleData.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs">
                    {vehicleData.location.latitude.toFixed(4)}, {vehicleData.location.longitude.toFixed(4)}
                  </span>
                </div>
              )}
              
              {vehicleData.odometer && (
                <div className="flex items-center gap-2">
                  <Gauge className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs">
                    {(vehicleData.odometer.distance / 1000).toFixed(0)} km
                  </span>
                </div>
              )}
              
              {vehicleData.fuel && (
                <div className="flex items-center gap-2">
                  <Fuel className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs">
                    {(vehicleData.fuel.percent * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pt-2 space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchVehicleData}
              disabled={loading}
              className="flex-1"
            >
              <Info className="mr-2 h-4 w-4" />
              Uppdatera data
            </Button>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => disconnectVehicle(connection.id)}
            className="w-full"
          >
            <Unplug className="mr-2 h-4 w-4" />
            Koppla från
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};