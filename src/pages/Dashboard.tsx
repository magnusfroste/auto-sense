import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  // Mock data - detta kommer att hämtas från Supabase senare
  const stats = {
    totalTrips: 24,
    totalDistance: 1245,
    workTrips: 18,
    personalTrips: 6,
    thisMonth: {
      trips: 8,
      distance: 425,
      workDistance: 320
    }
  };

  const recentTrips = [
    {
      id: 1,
      date: '2024-01-10',
      from: 'Stockholm',
      to: 'Göteborg',
      distance: 470,
      type: 'work' as const,
      status: 'completed' as const
    },
    {
      id: 2,
      date: '2024-01-09',
      from: 'Hem',
      to: 'ICA Maxi',
      distance: 12,
      type: 'personal' as const,
      status: 'completed' as const
    },
    {
      id: 3,
      date: '2024-01-08',
      from: 'Kontor',
      to: 'Kundmöte',
      distance: 85,
      type: 'work' as const,
      status: 'completed' as const
    }
  ];

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
            {recentTrips.map((trip) => (
              <div key={trip.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center space-x-3">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{trip.from} → {trip.to}</p>
                    <p className="text-sm text-muted-foreground">{trip.date}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={trip.type === 'work' ? 'default' : 'secondary'}>
                    {trip.type === 'work' ? 'Arbete' : 'Privat'}
                  </Badge>
                  <span className="text-sm font-medium">{trip.distance} km</span>
                </div>
              </div>
            ))}
            <NavLink to="/trips">
              <Button variant="outline" className="w-full">
                Visa alla resor
              </Button>
            </NavLink>
          </CardContent>
        </Card>

        {/* Quick Actions */}
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
  );
}