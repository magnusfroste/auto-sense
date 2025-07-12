import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Car, 
  MapPin, 
  Fuel, 
  Gauge, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  Play
} from 'lucide-react';
import { useVehicleConnections } from '@/hooks/useVehicleConnections';
import { useNavigate } from 'react-router-dom';

export const VehicleStatusIndicator = () => {
  const { connections, loading } = useVehicleConnections();
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Car className="mr-2 h-5 w-5" />
            Fordonsstatus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeConnections = connections.filter(c => c.is_active);

  const getStatusIcon = () => {
    if (activeConnections.length === 0) return <XCircle className="h-4 w-4 text-muted-foreground" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (activeConnections.length === 0) return 'Inga anslutna fordon';
    if (activeConnections.length === 1) return '1 fordon anslutet';
    return `${activeConnections.length} fordon anslutna`;
  };

  const getStatusDescription = () => {
    if (activeConnections.length === 0) {
      return 'Anslut dina fordon för automatisk resspårning och fordonsdata';
    }
    return 'Dina fordon är redo för automatisk resspårning';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Car className="mr-2 h-5 w-5" />
              Fordonsstatus
            </CardTitle>
            <CardDescription className="flex items-center space-x-2 mt-1">
              {getStatusIcon()}
              <span>{getStatusText()}</span>
            </CardDescription>
          </div>
          <Badge 
            variant={activeConnections.length > 0 ? 'default' : 'secondary'}
            className="flex items-center space-x-1"
          >
            <span>{activeConnections.length > 0 ? 'Aktivt' : 'Inaktivt'}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {getStatusDescription()}
        </p>

        {activeConnections.length > 0 && (
          <>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Anslutna fordon:</h4>
              <div className="space-y-2">
                {activeConnections.map((connection) => (
                  <div key={connection.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <div className="flex items-center space-x-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {connection.make} {connection.model}
                        {connection.year && ` (${connection.year})`}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Redo
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center space-x-1">
                <MapPin className="h-3 w-3" />
                <span>Live GPS</span>
              </div>
              <div className="flex items-center space-x-1">
                <Fuel className="h-3 w-3" />
                <span>Bränslenit</span>
              </div>
              <div className="flex items-center space-x-1">
                <Gauge className="h-3 w-3" />
                <span>Mätarställning</span>
              </div>
              <div className="flex items-center space-x-1">
                <CheckCircle className="h-3 w-3" />
                <span>Auto-spårning</span>
              </div>
            </div>

            <Button 
              onClick={() => navigate('/trip/active')}
              className="w-full"
              size="sm"
            >
              <Play className="mr-2 h-4 w-4" />
              Starta resa med fordon
            </Button>
          </>
        )}

        {activeConnections.length === 0 && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Anslut dina fordon för att få tillgång till:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-4">
              <div className="flex items-center space-x-1">
                <MapPin className="h-3 w-3" />
                <span>Automatisk GPS</span>
              </div>
              <div className="flex items-center space-x-1">
                <Fuel className="h-3 w-3" />
                <span>Bränslenit</span>
              </div>
              <div className="flex items-center space-x-1">
                <Gauge className="h-3 w-3" />
                <span>Körjournal</span>
              </div>
              <div className="flex items-center space-x-1">
                <CheckCircle className="h-3 w-3" />
                <span>Hybrid-spårning</span>
              </div>
            </div>
            <Button 
              onClick={() => navigate('/settings')}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <Car className="mr-2 h-4 w-4" />
              Anslut fordon
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};