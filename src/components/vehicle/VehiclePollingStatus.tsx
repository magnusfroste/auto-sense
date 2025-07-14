import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useVehiclePolling } from '@/hooks/useVehiclePolling';
import { useVehicleConnections } from '@/hooks/useVehicleConnections';
import { useTrips } from '@/hooks/useTrips';
import { Activity, Car, Clock, MapPin, PlayCircle, StopCircle } from 'lucide-react';

export const VehiclePollingStatus = () => {
  const { vehicleStates, hasActiveTrips } = useVehiclePolling();
  const { connections } = useVehicleConnections();
  const { trips } = useTrips();
  
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Get active trips
  const activeTrips = trips.filter(trip => trip.trip_status === 'active');
  const latestTrip = trips[0]; // Most recent trip

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const pollTime = new Date(date);
    const diffMinutes = Math.floor((now.getTime() - pollTime.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just nu';
    if (diffMinutes < 60) return `${diffMinutes}m sedan`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h sedan`;
    return `${Math.floor(diffMinutes / 1440)}d sedan`;
  };

  const getPollingStatus = () => {
    if (connections.length === 0) {
      return { status: 'no-vehicles', color: 'secondary', text: 'Inga fordon anslutna' };
    }
    
    if (hasActiveTrips()) {
      return { status: 'active-trip', color: 'destructive', text: 'Aktiv resa pågår' };
    }
    
    if (vehicleStates.length > 0) {
      return { status: 'monitoring', color: 'default', text: 'Automatisk spårning aktiv' };
    }
    
    return { status: 'connected', color: 'secondary', text: 'Fordon anslutna' };
  };

  const pollingStatus = getPollingStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Car className="mr-2 h-5 w-5" />
          Fordonsövervakning
        </CardTitle>
        <CardDescription>
          Status för automatisk resspårning via anslutna fordon
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Status:</span>
          </div>
          <Badge variant={pollingStatus.color === 'default' ? 'default' : 'secondary'}>
            {pollingStatus.text}
          </Badge>
        </div>

        {connections.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-medium">Anslutna fordon ({connections.length})</div>
            {connections.map((connection) => {
              const state = vehicleStates.find(s => s.connection_id === connection.id);
              return (
                <div key={connection.id} className="flex items-center justify-between p-2 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">
                      {connection.year} {connection.make} {connection.model}
                    </p>
                    {state?.last_poll_time && (
                      <p className="text-xs text-muted-foreground">
                        Senast kontrollad: {formatTimeAgo(state.last_poll_time)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {state?.current_trip_id && (
                      <Badge variant="destructive" className="text-xs">
                        <PlayCircle className="w-3 h-3 mr-1" />
                        Aktiv resa
                      </Badge>
                    )}
                    <div className={`w-2 h-2 rounded-full ${
                      state?.last_poll_time && 
                      new Date().getTime() - new Date(state.last_poll_time).getTime() < 300000 // 5 minutes
                        ? 'bg-green-500' 
                        : 'bg-gray-400'
                    }`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTrips.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Aktiva resor ({activeTrips.length})</div>
            {activeTrips.map((trip) => (
              <div key={trip.id} className="flex items-center justify-between p-2 rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                <div className="flex items-center space-x-2">
                  <PlayCircle className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium">Pågående resa</p>
                    <p className="text-xs text-muted-foreground">
                      Startad: {new Date(trip.start_time).toLocaleString('sv-SE')}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="border-orange-300">
                  {trip.distance_km?.toFixed(1) || '0'} km
                </Badge>
              </div>
            ))}
          </div>
        )}

        {latestTrip && !activeTrips.length && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Senaste resa</div>
            <div className="flex items-center justify-between p-2 rounded-lg border">
              <div className="flex items-center space-x-2">
                <StopCircle className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {latestTrip.start_location?.address || 'Startpunkt'} → {latestTrip.end_location?.address || 'Slutpunkt'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(latestTrip.created_at || '').toLocaleDateString('sv-SE')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{latestTrip.distance_km?.toFixed(1) || '0'} km</p>
                <Badge variant="secondary" className="text-xs">
                  {latestTrip.trip_type === 'work' ? 'Arbete' : 'Privat'}
                </Badge>
              </div>
            </div>
          </div>
        )}


        <div className="text-xs text-muted-foreground">
          Senast uppdaterad: {lastUpdate.toLocaleTimeString('sv-SE')}
        </div>
      </CardContent>
    </Card>
  );
};