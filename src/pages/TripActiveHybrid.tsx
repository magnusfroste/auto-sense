import { useState, useEffect } from 'react';
console.log('🔧 TripActiveHybrid component loaded');
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MapComponent } from '@/components/map/MapComponent';
import { 
  Play, 
  Pause, 
  Square, 
  MapPin, 
  Clock, 
  Gauge,
  Route as RouteIcon,
  Briefcase,
  Home,
  Car,
  Smartphone,
  Zap,
  Fuel,
  Info
} from 'lucide-react';
import { useHybridTrip, type TripSource } from '@/hooks/useHybridTrip';
import { useVehicleConnections } from '@/hooks/useVehicleConnections';

export default function TripActiveHybrid() {
  console.log('🚀 TripActiveHybrid component rendering');
  const navigate = useNavigate();
  const { connections } = useVehicleConnections();
  const { 
    trip, 
    availableSources, 
    startTrip, 
    pauseTrip, 
    resumeTrip, 
    stopTrip, 
    updateTripMetadata 
  } = useHybridTrip();

  const [selectedSource, setSelectedSource] = useState<TripSource>('gps');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');

  // Auto-select first vehicle if available
  useEffect(() => {
    if (connections.length > 0 && !selectedVehicle) {
      setSelectedVehicle(connections[0].id);
    }
  }, [connections, selectedVehicle]);

  const handleStartTrip = async () => {
    console.log('🎯 handleStartTrip called with:', { selectedSource, selectedVehicle });
    const vehicleId = (selectedSource === 'vehicle' || selectedSource === 'hybrid') 
      ? selectedVehicle 
      : undefined;
    
    await startTrip(selectedSource, vehicleId);
  };

  const saveAndFinish = async () => {
    await stopTrip();
    
    // Navigate back to dashboard after 1 second
    setTimeout(() => {
      navigate('/dashboard');
    }, 1000);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getSourceIcon = (source: TripSource) => {
    switch (source) {
      case 'gps': return <Smartphone className="h-4 w-4" />;
      case 'vehicle': return <Car className="h-4 w-4" />;
      case 'hybrid': return <Zap className="h-4 w-4" />;
      default: return <MapPin className="h-4 w-4" />;
    }
  };

  const getSourceLabel = (source: TripSource) => {
    switch (source) {
      case 'gps': return 'GPS Telefon';
      case 'vehicle': return 'Fordon';
      case 'hybrid': return 'Hybrid';
      default: return 'Okänd';
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Aktiv resa</h1>
        <p className="text-muted-foreground">Spåra din resa med GPS, fordon eller hybrid-läge</p>
      </div>

      {/* Source Selection (only when trip is inactive) */}
      {trip.status === 'inactive' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <RouteIcon className="mr-2 h-5 w-5" />
              Välj spårningsmetod
            </CardTitle>
            <CardDescription>
              Välj hur du vill spåra din resa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Spårningskälla</label>
              <Select value={selectedSource} onValueChange={(value: TripSource) => setSelectedSource(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableSources.map((source) => (
                    <SelectItem key={source.value} value={source.value}>
                      <div className="flex items-center space-x-2">
                        {getSourceIcon(source.value)}
                        <div>
                          <div className="font-medium">{source.label}</div>
                          <div className="text-sm text-muted-foreground">{source.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Vehicle Selection (when vehicle or hybrid is selected) */}
            {(selectedSource === 'vehicle' || selectedSource === 'hybrid') && connections.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Välj fordon</label>
                <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj anslutna fordon" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.map((connection) => (
                      <SelectItem key={connection.id} value={connection.id}>
                        <div className="flex items-center space-x-2">
                          <Car className="h-4 w-4" />
                          <span>
                            {connection.make} {connection.model} 
                            {connection.year && ` (${connection.year})`}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Trip Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <RouteIcon className="mr-2 h-5 w-5" />
                Resestatus
              </CardTitle>
              <CardDescription>
                {trip.status === 'inactive' && 'Ingen aktiv resa'}
                {trip.status === 'active' && `Resan pågår med ${getSourceLabel(trip.source)}`}
                {trip.status === 'paused' && 'Resan är pausad'}
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge 
                variant={
                  trip.status === 'active' ? 'default' :
                  trip.status === 'paused' ? 'secondary' : 'outline'
                }
                className="flex items-center space-x-1"
              >
                {getSourceIcon(trip.source)}
                <span>
                  {trip.status === 'active' && 'Aktiv'}
                  {trip.status === 'paused' && 'Pausad'}
                  {trip.status === 'inactive' && 'Inaktiv'}
                </span>
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Tid</p>
                <p className="font-medium">{formatDuration(trip.duration)}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Sträcka</p>
                <p className="font-medium">{trip.distance.toFixed(1)} km</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Position</p>
                <p className="font-medium">
                  {trip.currentLocation ? 'Spårning aktiv' : 'Ingen position'}
                </p>
                {trip.gpsAccuracy && (
                  <p className="text-xs text-muted-foreground">
                    GPS noggrannhet: ±{Math.round(trip.gpsAccuracy)}m
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Data (when available) */}
      {trip.vehicleData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Car className="mr-2 h-5 w-5" />
              Fordonsdata
            </CardTitle>
            <CardDescription>Live-data från anslutna fordon</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {trip.vehicleData.fuel && (
                <div className="flex items-center space-x-2">
                  <Fuel className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Bränslenit</p>
                    <p className="font-medium">{trip.vehicleData.fuel.percent}%</p>
                  </div>
                </div>
              )}
              {trip.vehicleData.odometer && (
                <div className="flex items-center space-x-2">
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Mätarställning</p>
                    <p className="font-medium">{Math.round(trip.vehicleData.odometer.distance)} km</p>
                  </div>
                </div>
              )}
              {trip.vehicleData.info && (
                <div className="flex items-center space-x-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Fordon</p>
                    <p className="font-medium">
                      {trip.vehicleData.info.make} {trip.vehicleData.info.model} ({trip.vehicleData.info.year})
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Kontroller</CardTitle>
          <CardDescription>Starta, pausa eller avsluta din resa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {trip.status === 'inactive' && (
              <Button onClick={handleStartTrip} size="lg" disabled={
                (selectedSource === 'vehicle' || selectedSource === 'hybrid') && !selectedVehicle
              }>
                <Play className="mr-2 h-4 w-4" />
                Starta resa
              </Button>
            )}
            
            {trip.status === 'active' && (
              <>
                <Button onClick={pauseTrip} variant="outline" size="lg">
                  <Pause className="mr-2 h-4 w-4" />
                  Pausa
                </Button>
                <Button onClick={stopTrip} variant="destructive" size="lg">
                  <Square className="mr-2 h-4 w-4" />
                  Avsluta resa
                </Button>
              </>
            )}
            
            {trip.status === 'paused' && (
              <>
                <Button onClick={resumeTrip} size="lg">
                  <Play className="mr-2 h-4 w-4" />
                  Fortsätt
                </Button>
                <Button onClick={stopTrip} variant="destructive" size="lg">
                  <Square className="mr-2 h-4 w-4" />
                  Avsluta resa
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MapPin className="mr-2 h-5 w-5" />
            Kartvy
          </CardTitle>
          <CardDescription>
            Realtidsvy av din pågående resa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MapComponent
            currentLocation={trip.currentLocation}
            startLocation={trip.startLocation}
            route={trip.route}
            height="h-80"
            className="w-full"
          />
        </CardContent>
      </Card>

      {/* Trip Classification */}
      {(trip.status !== 'inactive' || trip.endTime) && (
        <Card>
          <CardHeader>
            <CardTitle>Klassificera resa</CardTitle>
            <CardDescription>Välj typ av resa och lägg till anteckningar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Resetyp</label>
              <Select 
                value={trip.tripType} 
                onValueChange={(value: 'work' | 'personal' | 'unknown') => 
                  updateTripMetadata({ tripType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Välj resetyp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work">
                    <div className="flex items-center">
                      <Briefcase className="mr-2 h-4 w-4" />
                      Arbetsresa
                    </div>
                  </SelectItem>
                  <SelectItem value="personal">
                    <div className="flex items-center">
                      <Home className="mr-2 h-4 w-4" />
                      Privatresa
                    </div>
                  </SelectItem>
                  <SelectItem value="unknown">Oklart</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Anteckningar</label>
              <Textarea
                placeholder="Lägg till anteckningar om resan..."
                value={trip.notes}
                onChange={(e) => updateTripMetadata({ notes: e.target.value })}
                rows={3}
              />
            </div>

            {/* Spara och tillbaka knapp när resan är avslutad */}
            {trip.endTime && (
              <div className="pt-4 border-t">
                <Button onClick={saveAndFinish} className="w-full" size="lg">
                  <Home className="mr-2 h-4 w-4" />
                  Spara resa och tillbaka till dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}