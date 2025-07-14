import { useEffect, useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTrips } from '@/hooks/useTrips';
import { useVehicleConnections } from '@/hooks/useVehicleConnections';
import { VehiclePollingStatus } from '@/components/vehicle/VehiclePollingStatus';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TripDebugPanel } from '@/components/vehicle/TripDebugPanel';
import { MapPin, Clock, Car, Navigation, Route, Gauge } from 'lucide-react';

const TripActive = () => {
  const { trips, refreshTrips } = useTrips();
  const { connections } = useVehicleConnections();
  const [lastUpdate, setLastUpdate] = useState(new Date());
  
  // Auto-refresh trips every 10 seconds to prevent flickering
  useEffect(() => {
    const interval = setInterval(() => {
      refreshTrips();
      setLastUpdate(new Date());
    }, 10000);

    return () => clearInterval(interval);
  }, [refreshTrips]);

  // Memoize active trips to prevent unnecessary re-renders
  const activeTrips = useMemo(() => 
    trips.filter(trip => trip.trip_status === 'active'),
    [trips]
  );

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pågående resa</h1>
          <p className="text-muted-foreground">
            Automatisk fordonsspårning
          </p>
        </div>

        {/* Debug Panel for development */}
        <TripDebugPanel />

        {/* Vehicle Status */}
        <VehiclePollingStatus />

        {/* Active Trips Display */}
        {activeTrips.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Aktiva resor ({activeTrips.length})</h2>
            {activeTrips.map((trip) => {
              const connection = connections.find(c => c.id === trip.vehicle_connection_id);
              
              return (
                <Card key={trip.id} className="border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center">
                          <Car className="mr-2 h-5 w-5 text-orange-600" />
                          {connection ? `${connection.year} ${connection.make} ${connection.model}` : 'Okänt fordon'}
                        </CardTitle>
                        <CardDescription>
                          Startad {formatTime(trip.start_time)} • Pågått {formatDuration(trip.start_time)}
                        </CardDescription>
                      </div>
                      <Badge className="bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900 dark:text-orange-100">
                        Aktiv resa
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Tid</p>
                          <p className="font-medium">{formatDuration(trip.start_time)}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Gauge className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Sträcka</p>
                          <p className="font-medium">{trip.distance_km?.toFixed(1) || '0.0'} km</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Startplats</p>
                          <p className="font-medium text-xs">
                            {trip.start_location?.address || 
                             `${trip.start_location?.latitude?.toFixed(4)}, ${trip.start_location?.longitude?.toFixed(4)}` ||
                             'Okänd position'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {trip.notes && (
                      <div className="mt-4 p-3 bg-white/50 dark:bg-black/20 rounded-lg border">
                        <p className="text-sm text-muted-foreground mb-1">Anteckningar</p>
                        <p className="text-sm">{trip.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Navigation className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Inga aktiva resor</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {connections.length === 0 
                  ? "Anslut ett fordon i inställningar för att starta automatisk resspårning."
                  : "Automatisk spårning är aktiverad. Resor detekteras och spåras automatiskt när du kör med ditt anslutna fordon."
                }
              </p>
            </CardContent>
          </Card>
        )}

        {/* Recent Trips Summary */}
        {trips.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Route className="mr-2 h-5 w-5" />
                Senaste resor
              </CardTitle>
              <CardDescription>
                Översikt av dina senaste resor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {trips.slice(0, 3).map((trip) => (
                  <div key={trip.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        trip.trip_status === 'active' ? 'bg-orange-500' :
                        trip.trip_status === 'completed' ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(trip.start_time).toLocaleDateString('sv-SE')} • {formatTime(trip.start_time)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {trip.trip_status === 'active' ? 'Pågående' : 'Avslutad'} • {trip.distance_km?.toFixed(1) || '0'} km
                        </p>
                      </div>
                    </div>
                    <Badge variant={trip.trip_type === 'work' ? 'default' : 'secondary'} className="text-xs">
                      {trip.trip_type === 'work' ? 'Arbete' : 
                       trip.trip_type === 'personal' ? 'Privat' : 'Okänt'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-xs text-muted-foreground text-center">
          Senast uppdaterad: {lastUpdate.toLocaleTimeString('sv-SE')}
        </div>
      </div>
    </AppLayout>
  );
};

export default TripActive;