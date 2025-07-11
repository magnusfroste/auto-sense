import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Car, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useVehicleConnections } from '@/hooks/useVehicleConnections';
import { VehicleConnectionCard } from './VehicleConnectionCard';

export const VehicleConnectionSection = () => {
  const { connections, loading, connectVehicle } = useVehicleConnections();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Car className="h-5 w-5" />
            <span>Fordonsanslutningar</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-3/4 bg-muted rounded"></div>
            <div className="h-4 w-1/2 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Car className="h-5 w-5" />
            <span>Fordonsanslutningar</span>
          </CardTitle>
          <CardDescription>
            Anslut ditt fordon för automatisk resspårning via Smartcar
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Automatisk resspårning kräver att ditt fordon är kompatibelt med Smartcar. 
              Stöd finns för de flesta bilar från 2015 och senare från märken som Tesla, BMW, Mercedes, Audi, Ford m.fl.
            </AlertDescription>
          </Alert>

          {connections.length === 0 ? (
            <div className="text-center py-8">
              <Car className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Inga fordon anslutna</h3>
              <p className="text-muted-foreground mb-4">
                Anslut ditt fordon för att automatiskt spåra dina resor
              </p>
              <Button onClick={() => connectVehicle()}>
                <Plus className="mr-2 h-4 w-4" />
                Anslut fordon
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Anslutna fordon ({connections.length})</h3>
                <Button variant="outline" size="sm" onClick={() => connectVehicle()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Anslut fler
                </Button>
              </div>
              
              <div className="grid gap-4">
                {connections.map((connection) => (
                  <VehicleConnectionCard 
                    key={connection.id} 
                    connection={connection} 
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};