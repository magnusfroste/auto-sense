import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Car, Info, TestTube, Key } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useVehicleConnections } from '@/hooks/useVehicleConnections';
import { useToast } from '@/hooks/use-toast';
import { VehicleConnectionCard } from './VehicleConnectionCard';

export const VehicleConnectionSection = () => {
  const [demoMode, setDemoMode] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const { connections, loading, connectVehicle } = useVehicleConnections();
  const { toast } = useToast();

  const connectTestVehicle = async () => {
    if (demoMode && (!testEmail.trim() || !testPassword.trim())) {
      toast({
        title: "Fyll i test-credentials",
        description: "Både e-post och lösenord krävs för testfordonet",
        variant: "destructive"
      });
      return;
    }

    setConnecting(true);
    try {
      if (demoMode) {
        sessionStorage.setItem('smartcar_test_email', testEmail);
        sessionStorage.setItem('smartcar_test_password', testPassword);
        await connectVehicle(true);
        toast({
          title: "Test OAuth-flöde startat",
          description: `Använd ${testEmail} för att logga in i Smartcar testmiljön`
        });
      } else {
        await connectVehicle(false);
      }
    } catch (error: any) {
      console.error('Error connecting vehicle:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ansluta fordon",
        variant: "destructive"
      });
    } finally {
      setConnecting(false);
    }
  };

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
          {/* Demo Mode Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <TestTube className="h-4 w-4" />
                <Label htmlFor="demo-mode" className="text-sm font-medium">Demo-läge</Label>
                <Badge variant={demoMode ? "secondary" : "outline"} className="text-xs">
                  {demoMode ? "TEST" : "LIVE"}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Använd Smartcar's testfordon istället för riktiga bilar
              </div>
            </div>
            <Switch 
              id="demo-mode"
              checked={demoMode}
              onCheckedChange={setDemoMode}
            />
          </div>

          {/* Test Vehicle Credentials */}
          {demoMode && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                <Label className="text-sm font-medium">Test-credentials</Label>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="test-email">E-post</Label>
                  <Input
                    id="test-email"
                    type="email"
                    placeholder="exempel@simulated.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="test-password">Lösenord</Label>
                  <Input
                    id="test-password"
                    type="password"
                    placeholder="Testfordonets lösenord"
                    value={testPassword}
                    onChange={(e) => setTestPassword(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground">
                Hitta test-credentials i din Smartcar dashboard under "Test Vehicles"
              </div>
            </div>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {demoMode 
                ? "Demo-läge använder Smartcar's testfordon för utveckling och testning."
                : "Automatisk resspårning kräver att ditt fordon är kompatibelt med Smartcar. Stöd finns för de flesta bilar från 2015 och senare från märken som Tesla, BMW, Mercedes, Audi, Ford m.fl."
              }
            </AlertDescription>
          </Alert>

          {connections.length === 0 ? (
            <div className="text-center py-8">
              <Car className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Inga fordon anslutna</h3>
              <p className="text-muted-foreground mb-4">
                {demoMode 
                  ? "Anslut ett testfordon för utveckling och testning"
                  : "Anslut ditt fordon för att automatiskt spåra dina resor"
                }
              </p>
              <Button 
                onClick={connectTestVehicle}
                disabled={connecting || (demoMode && (!testEmail.trim() || !testPassword.trim()))}
              >
                <Plus className="mr-2 h-4 w-4" />
                {connecting 
                  ? "Ansluter..." 
                  : demoMode 
                    ? "Anslut testfordon" 
                    : "Anslut fordon"
                }
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Anslutna fordon ({connections.length})</h3>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={connectTestVehicle}
                  disabled={connecting || (demoMode && (!testEmail.trim() || !testPassword.trim()))}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {connecting 
                    ? "Ansluter..." 
                    : demoMode 
                      ? "Anslut testfordon" 
                      : "Anslut fler"
                  }
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