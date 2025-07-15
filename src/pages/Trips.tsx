import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapComponent } from '@/components/map/MapComponent';
import { useTrips } from '@/hooks/useTrips';
import { 
  MapPin, 
  Clock, 
  Gauge, 
  Calendar,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Briefcase,
  Home,
  RefreshCw,
  AlertCircle,
  Info
} from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

export default function Trips() {
  const { trips, loading, error, lastRefresh, refreshTrips, deleteTrip } = useTrips();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'work' | 'personal'>('all');
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);

  const filteredTrips = trips.filter(trip => {
    const matchesSearch = trip.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         trip.start_location?.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         trip.end_location?.address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' || trip.trip_type === filterType;
    
    return matchesSearch && matchesFilter;
  });

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getTripTypeIcon = (type: string) => {
    switch (type) {
      case 'work':
        return <Briefcase className="h-4 w-4" />;
      case 'personal':
        return <Home className="h-4 w-4" />;
      default:
        return <MapPin className="h-4 w-4" />;
    }
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
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mina resor</h1>
          <p className="text-muted-foreground">Översikt och hantering av alla dina registrerade resor</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDebug(!showDebug)}
          >
            <Info className="h-4 w-4 mr-1" />
            {showDebug ? 'Dölj debug' : 'Visa debug'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshTrips}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Uppdatera
          </Button>
        </div>
      </div>

      {/* Debug Information */}
      {showDebug && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-800">
              <Info className="mr-2 h-5 w-5" />
              Debug Information
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div><strong>Antal resor i state:</strong> {trips.length}</div>
            <div><strong>Senaste uppdatering:</strong> {lastRefresh.toLocaleString('sv-SE')}</div>
            <div><strong>Loading:</strong> {loading ? 'Ja' : 'Nej'}</div>
            {error && (
              <div className="text-red-600">
                <strong>Fel:</strong> {error}
              </div>
            )}
            <div><strong>Resor breakdown:</strong></div>
            <ul className="ml-4 space-y-1">
              {trips.slice(0, 5).map(trip => (
                <li key={trip.id} className="text-xs">
                  {trip.id?.substring(0, 8)}... - {trip.trip_status} - 
                  {trip.created_at ? new Date(trip.created_at).toLocaleString('sv-SE') : 'No date'}
                  {trip.end_time ? ` (slutad: ${new Date(trip.end_time).toLocaleString('sv-SE')})` : ' (aktiv)'}
                </li>
              ))}
              {trips.length > 5 && <li className="text-xs">...och {trips.length - 5} till</li>}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Error Alert */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center py-4">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshTrips}
              className="ml-auto"
            >
              Försök igen
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="mr-2 h-5 w-5" />
            Filter och sök
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Sök i anteckningar, platser..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={(value: 'all' | 'work' | 'personal') => setFilterType(value)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrera typ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla resor</SelectItem>
                <SelectItem value="work">Arbetsresor</SelectItem>
                <SelectItem value="personal">Privatresor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Totalt antal resor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trips.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total sträcka</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {trips.reduce((sum, trip) => sum + (trip.distance_km || 0), 0).toFixed(1)} km
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total tid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(trips.reduce((sum, trip) => sum + (trip.duration_minutes || 0), 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trips List */}
      <div className="space-y-4">
        {filteredTrips.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Inga resor hittades</h3>
              <p className="text-muted-foreground text-center">
                {searchTerm || filterType !== 'all' 
                  ? 'Prova att ändra dina filter- eller sökcriterie'
                  : 'Du har inte registrerat några resor än'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredTrips.map((trip) => (
            <Card key={trip.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {getTripTypeIcon(trip.trip_type)}
                      <Badge variant={trip.trip_type === 'work' ? 'default' : 'secondary'}>
                        {getTripTypeName(trip.trip_type)}
                      </Badge>
                    </div>
                    <Badge variant="outline">
                      {trip.trip_status === 'completed' ? 'Avslutad' : 'Pågående'}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTrip(selectedTrip === trip.id ? null : trip.id)}
                      className="text-xs"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {selectedTrip === trip.id ? 'Dölj karta' : 'Visa på karta'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTrip(trip.id!)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(trip.created_at!), 'PPP', { locale: sv })} • {format(new Date(trip.start_time), 'HH:mm')}
                  {trip.end_time && ` - ${format(new Date(trip.end_time), 'HH:mm')}`}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Sträcka</p>
                      <p className="font-medium">{trip.distance_km?.toFixed(1) || '0'} km</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Tid</p>
                      <p className="font-medium">{formatDuration(trip.duration_minutes || 0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Rutt</p>
                      <p className="font-medium text-sm">
                        {trip.start_location?.address || 'Startpunkt'} → {trip.end_location?.address || 'Slutpunkt'}
                      </p>
                    </div>
                  </div>
                </div>

                {trip.notes && (
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground">Anteckningar:</p>
                    <p className="text-sm">{trip.notes}</p>
                  </div>
                )}

                {selectedTrip === trip.id && (
                  <div className="mt-4 border-t pt-4">
                    <div className="flex items-center mb-2">
                      <MapPin className="h-4 w-4 mr-2 text-primary" />
                      <span className="font-medium">Sträckning på karta</span>
                    </div>
                    <MapComponent
                      startLocation={trip.start_location}
                      currentLocation={trip.end_location}
                      route={trip.route_data || []}
                      height="h-80"
                      className="w-full"
                      showNavigation={true}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}