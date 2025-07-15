import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapComponent } from '@/components/map/MapComponent';
import { useVehicleConnections } from '@/hooks/useVehicleConnections';
import { useActiveTrip } from '@/hooks/useActiveTrip';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, TestTube, Car, Navigation } from 'lucide-react';

export default function TestMap() {
  const { connections } = useVehicleConnections();
  const { activeTrip } = useActiveTrip(connections[0]?.id);
  const [vehicleState, setVehicleState] = useState<any>(null);
  const [testMode, setTestMode] = useState<'simple' | 'vehicle' | 'trip'>('simple');

  // Test data
  const testLocation = {
    lat: 59.3293, // Stockholm
    lng: 18.0686
  };

  const testRoute = [
    [18.0686, 59.3293], // Stockholm
    [18.0720, 59.3310],
    [18.0750, 59.3330],
    [18.0780, 59.3350]
  ];

  const fetchVehicleData = async () => {
    if (connections.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('vehicle_states')
        .select('*')
        .eq('connection_id', connections[0].id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        const location = data.last_location as any;
        setVehicleState({
          ...data,
          last_location: location ? {
            latitude: location.latitude,
            longitude: location.longitude
          } : null
        });
      }
    } catch (error) {
      console.error('Error fetching vehicle state:', error);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <TestTube className="mr-3 h-8 w-8" />
            Test Map
          </h1>
          <p className="text-muted-foreground">
            Testa kartfunktionalitet steg för steg
          </p>
        </div>
      </div>

      {/* Test Mode Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Test Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={testMode === 'simple' ? 'default' : 'outline'}
              onClick={() => setTestMode('simple')}
            >
              <MapPin className="mr-2 h-4 w-4" />
              Enkel karta
            </Button>
            <Button
              variant={testMode === 'vehicle' ? 'default' : 'outline'}
              onClick={() => {
                setTestMode('vehicle');
                fetchVehicleData();
              }}
            >
              <Car className="mr-2 h-4 w-4" />
              Vehicle data
            </Button>
            <Button
              variant={testMode === 'trip' ? 'default' : 'outline'}
              onClick={() => setTestMode('trip')}
            >
              <Navigation className="mr-2 h-4 w-4" />
              Trip data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Debug Info */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Test Mode:</strong> {testMode}
            </div>
            <div>
              <strong>Vehicle Connections:</strong> {connections.length}
            </div>
            <div>
              <strong>Active Trip:</strong> {activeTrip ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Vehicle State:</strong> {vehicleState ? 'Loaded' : 'None'}
            </div>
          </div>

          {testMode === 'vehicle' && vehicleState && (
            <div className="mt-4 p-3 bg-muted rounded">
              <pre className="text-xs">{JSON.stringify(vehicleState, null, 2)}</pre>
            </div>
          )}

          {testMode === 'trip' && activeTrip && (
            <div className="mt-4 p-3 bg-muted rounded">
              <pre className="text-xs">{JSON.stringify(activeTrip, null, 2)}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Map Test */}
      <Card>
        <CardHeader>
          <CardTitle>
            Karta Test - {testMode === 'simple' ? 'Enkel' : testMode === 'vehicle' ? 'Vehicle' : 'Trip'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {testMode === 'simple' && (
            <MapComponent
              currentLocation={testLocation}
              startLocation={{
                lat: 59.3250,
                lng: 18.0600
              }}
              route={{
                type: 'LineString',
                coordinates: testRoute
              }}
              height="500px"
              showNavigation={true}
            />
          )}

          {testMode === 'vehicle' && (
            <MapComponent
              currentLocation={vehicleState?.last_location ? {
                lat: vehicleState.last_location.latitude,
                lng: vehicleState.last_location.longitude
              } : testLocation}
              height="500px"
              showNavigation={true}
            />
          )}

          {testMode === 'trip' && (
            <MapComponent
              currentLocation={vehicleState?.last_location ? {
                lat: vehicleState.last_location.latitude,
                lng: vehicleState.last_location.longitude
              } : (activeTrip?.end_location ? {
                lat: activeTrip.end_location.latitude,
                lng: activeTrip.end_location.longitude
              } : testLocation)}
              startLocation={activeTrip?.start_location ? {
                lat: activeTrip.start_location.latitude,
                lng: activeTrip.start_location.longitude
              } : undefined}
              route={activeTrip?.route_data ? {
                type: 'LineString',
                coordinates: activeTrip.route_data
              } : undefined}
              height="500px"
              showNavigation={true}
            />
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button 
              onClick={() => window.location.reload()}
              variant="outline"
            >
              Reload Page
            </Button>
            <Button 
              onClick={fetchVehicleData}
              variant="outline"
            >
              Refresh Vehicle Data
            </Button>
            <Button 
              onClick={() => console.log('Current state:', { vehicleState, activeTrip, testMode })}
              variant="outline"
            >
              Log State
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}