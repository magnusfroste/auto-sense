import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Car, Unplug, Calendar, Activity } from 'lucide-react';
import { useVehicleConnections } from '@/hooks/useVehicleConnections';

interface VehicleConnection {
  id: string;
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  connected_at: string;
  last_sync_at?: string;
  is_active: boolean;
}

interface VehicleConnectionCardProps {
  connection: VehicleConnection;
}

export const VehicleConnectionCard = ({ connection }: VehicleConnectionCardProps) => {
  const { disconnectVehicle } = useVehicleConnections();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getVehicleName = () => {
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

        <div className="pt-2">
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