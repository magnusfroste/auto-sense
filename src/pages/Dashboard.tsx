import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapComponent } from '@/components/map/MapComponent';
import { VehicleStatusIndicator } from '@/components/vehicle/VehicleStatusIndicator';
import { useTrips } from '@/hooks/useTrips';
import { 
  MapPin, 
  Clock, 
  Route as RouteIcon, 
  Calendar,
  TrendingUp,
  Car,
  Play,
  FileText
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

export default function Dashboard() {
  const { trips, loading } = useTrips();
  const [selectedTrip, setSelectedTrip] = useState<any>(null);

  // Beräkna statistik från riktiga data
  const stats = {
    totalTrips: trips.length,
    totalDistance: trips.reduce((sum, trip) => sum + (trip.distance_km || 0), 0),
    workTrips: trips.filter(trip => trip.trip_type === 'work').length,
    personalTrips: trips.filter(trip => trip.trip_type === 'personal').length,
    thisMonth: {
      trips: trips.filter(trip => {
        const tripDate = new Date(trip.created_at || '');
        const now = new Date();
        return tripDate.getMonth() === now.getMonth() && tripDate.getFullYear() === now.getFullYear();
      }).length,
      distance: trips.filter(trip => {
        const tripDate = new Date(trip.created_at || '');
        const now = new Date();
        return tripDate.getMonth() === now.getMonth() && tripDate.getFullYear() === now.getFullYear();
      }).reduce((sum, trip) => sum + (trip.distance_km || 0), 0),
      workDistance: trips.filter(trip => {
        const tripDate = new Date(trip.created_at || '');
        const now = new Date();
        return tripDate.getMonth() === now.getMonth() && 
               tripDate.getFullYear() === now.getFullYear() && 
               trip.trip_type === 'work';
      }).reduce((sum, trip) => sum + (trip.distance_km || 0), 0)
    }
  };

  // Ta de 5 senaste resorna
  const recentTrips = trips.slice(0, 5);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getTripTypeName = (type: string) => {
    switch (type) {
      case 'work':
        return 'Arbete';
      case 'personal':
        return 'Privat';
      default:
        return 'Oklart';
    }
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded"></div>
          <div className="h-4 w-96 bg-muted rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Översikt över dina resor och statistik</p>
        </div>
        <NavLink to="/trip/active">
          <Button size="lg" className="w-full lg:w-auto">
            <Play className="mr-2 h-4 w-4" />
            Starta ny resa
          </Button>
        </NavLink>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totala resor</CardTitle>
            <RouteIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTrips}</div>
            <p className="text-xs text-muted-foreground">
              {stats.workTrips} arbete, {stats.personalTrips} privat
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total sträcka</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDistance.toLocaleString()} km</div>
            <p className="text-xs text-muted-foreground">
              Alla registrerade resor
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Denna månad</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisMonth.trips}</div>
            <p className="text-xs text-muted-foreground">
              {stats.thisMonth.distance} km totalt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Arbetsresor</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisMonth.workDistance} km</div>
            <p className="text-xs text-muted-foreground">
              Denna månad
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Trips */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="mr-2 h-5 w-5" />
              Senaste resor
            </CardTitle>
            <CardDescription>
              Dina mest recent registrerade resor
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentTrips.length === 0 ? (
              <div className="text-center py-8">
                <Car className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Inga resor registrerade än</p>
              </div>
            ) : (
              recentTrips.map((trip) => (
                <div 
                  key={trip.id} 
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedTrip(selectedTrip === trip.id ? null : trip.id)}
                >
                  <div className="flex items-center space-x-3">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {trip.start_location?.address || 'Startpunkt'} → {trip.end_location?.address || 'Slutpunkt'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(trip.created_at || '').toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={trip.trip_type === 'work' ? 'default' : 'secondary'}>
                      {getTripTypeName(trip.trip_type)}
                    </Badge>
                    <span className="text-sm font-medium">{trip.distance_km?.toFixed(1) || '0'} km</span>
                  </div>
                </div>
              ))
            )}
            {selectedTrip && (
              <div className="mt-4">
                {(() => {
                  const trip = recentTrips.find(t => t.id === selectedTrip);
                  return trip ? (
                    <MapComponent
                      startLocation={trip.start_location}
                      currentLocation={trip.end_location}
                      route={trip.route_data || []}
                      height="h-64"
                      className="w-full"
                      showNavigation={false}
                    />
                  ) : null;
                })()}
              </div>
            )}
            <NavLink to="/trips">
              <Button variant="outline" className="w-full">
                Visa alla resor
              </Button>
            </NavLink>
          </CardContent>
        </Card>

        {/* Vehicle Status and Quick Actions */}
        <div className="space-y-6">
          <VehicleStatusIndicator />
          
          <Card>
            <CardHeader>
              <CardTitle>Snabbåtgärder</CardTitle>
              <CardDescription>
                Vanliga uppgifter och funktioner
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <NavLink to="/trip/active" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Play className="mr-2 h-4 w-4" />
                  Starta ny resa
                </Button>
              </NavLink>
              <NavLink to="/trips" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <MapPin className="mr-2 h-4 w-4" />
                  Granska resor
                </Button>
              </NavLink>
              <NavLink to="/reports" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  Exportera rapport
                </Button>
              </NavLink>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}