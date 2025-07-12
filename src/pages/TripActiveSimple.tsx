import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Clock, MapPin, Route } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useGPSTrip } from '@/hooks/useGPSTrip';
import { useVehicleTrip } from '@/hooks/useVehicleTrip';
import { supabase } from '@/integrations/supabase/client';

export default function TripActiveSimple() {
  const { user } = useAuth();
  const { trip: gpsTrip, startTrip: startGPSTrip, stopTrip: stopGPSTrip } = useGPSTrip();
  const { vehicleTrip, enableVehicleTracking } = useVehicleTrip();
  const [trackingMode, setTrackingMode] = useState<'gps' | 'vehicle' | null>(null);
  const [loading, setLoading] = useState(true);

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
      
      setTrackingMode((data?.tracking_mode as 'gps' | 'vehicle') || 'gps');
    } catch (error) {
      console.error('Error fetching tracking mode:', error);
      setTrackingMode('gps'); // Default fallback
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Laddar...</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  // GPS Mode
  if (trackingMode === 'gps') {
    return (
      <div className="p-4 lg:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Aktiv resa</h1>
            <p className="text-muted-foreground">GPS-spårning</p>
          </div>

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
                  
                  <Button onClick={stopGPSTrip} className="w-full" size="lg">
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
        </div>
      </div>
    );
  }

  // Vehicle Mode
  if (trackingMode === 'vehicle') {
    return (
      <div className="p-4 lg:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Automatisk spårning</h1>
            <p className="text-muted-foreground">Fordons-spårning</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Route className="h-5 w-5" />
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
                    <Route className="h-12 w-12 mx-auto mb-4 text-primary" />
                    <p className="text-lg font-medium mb-2">Automatisk spårning är aktiverad</p>
                    <p className="text-muted-foreground">
                      Resor detekteras och spåras automatiskt när du kör med ditt anslutna fordon.
                      Du behöver inte göra något - resor startar och stoppar automatiskt.
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      Status: {vehicleTrip.vehicleStatus}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center p-8 bg-muted rounded-lg">
                    <Route className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium mb-2">Automatisk spårning är inte aktiverad</p>
                    <p className="text-muted-foreground mb-4">
                      Aktivera automatisk spårning för att få resor detekterade automatiskt från ditt fordon.
                    </p>
                  </div>
                  
                  <Button onClick={enableVehicleTracking} className="w-full" size="lg">
                    <Play className="h-4 w-4 mr-2" />
                    Aktivera automatisk spårning
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}