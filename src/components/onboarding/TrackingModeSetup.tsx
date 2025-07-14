import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Smartphone, 
  Car, 
  MapPin, 
  Clock, 
  CheckCircle, 
  ArrowRight,
  Zap
} from 'lucide-react';

interface TrackingModeSetupProps {
  onComplete: (mode: 'gps' | 'vehicle') => void;
  onConnectVehicle: () => void;
}

export function TrackingModeSetup({ onComplete, onConnectVehicle }: TrackingModeSetupProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedMode, setSelectedMode] = useState<'gps' | 'vehicle' | null>(null);
  const [vehicleReg, setVehicleReg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleModeSelection = async (mode: 'gps' | 'vehicle') => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('sense_profiles')
        .upsert({
          id: user.id,
          tracking_mode: mode,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: 'Inställningar sparade!',
        description: `Du har valt ${mode === 'gps' ? 'GPS-spårning' : 'automatisk fordonsspårning'}.`,
      });

      onComplete(mode);
    } catch (error) {
      toast({
        title: 'Fel vid sparande',
        description: 'Kunde inte spara dina inställningar. Försök igen.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Välj spårningsmetod</h2>
        <p className="text-muted-foreground">
          Hur vill du spåra dina resor? Du kan ändra detta senare i inställningarna.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* GPS Mode */}
        <Card 
          className={`cursor-pointer transition-all border-2 ${
            selectedMode === 'gps' 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}
          onClick={() => setSelectedMode('gps')}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                  <Smartphone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">GPS-spårning</CardTitle>
                  <CardDescription>Använd telefonens GPS</CardDescription>
                </div>
              </div>
              {selectedMode === 'gps' && (
                <CheckCircle className="h-5 w-5 text-primary" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-sm">
                <MapPin className="h-4 w-4 text-green-600" />
                <span>Manuell start/stopp av resor</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Clock className="h-4 w-4 text-green-600" />
                <span>Exakt spårning av rutt och tid</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Funkar med alla fordon</span>
              </div>
            </div>
            
            <div className="pt-2">
              <Badge variant="secondary" className="text-xs">
                Rekommenderas för start
              </Badge>
            </div>
            
            {selectedMode === 'gps' && (
              <div className="pt-4 border-t">
                <div className="space-y-3">
                  <Label htmlFor="vehicle-reg">Registreringsnummer (valfritt)</Label>
                  <Input
                    id="vehicle-reg"
                    placeholder="ABC123"
                    value={vehicleReg}
                    onChange={(e) => setVehicleReg(e.target.value.toUpperCase())}
                    className="text-center font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Vi kan hämta fordonsdata för rapporter
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vehicle Mode */}
        <Card 
          className={`cursor-pointer transition-all border-2 ${
            selectedMode === 'vehicle' 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}
          onClick={() => setSelectedMode('vehicle')}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                  <Car className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Automatisk spårning</CardTitle>
                  <CardDescription>Via anslutna fordon</CardDescription>
                </div>
              </div>
              {selectedMode === 'vehicle' && (
                <CheckCircle className="h-5 w-5 text-primary" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-sm">
                <Zap className="h-4 w-4 text-purple-600" />
                <span>Resor startar automatiskt</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Car className="h-4 w-4 text-purple-600" />
                <span>Exakta fordonsdata</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Clock className="h-4 w-4 text-purple-600" />
                <span>Ingen manuell hantering</span>
              </div>
            </div>
            
            <div className="pt-2">
              <Badge variant="outline" className="text-xs">
                Kräver kompatibelt fordon
              </Badge>
            </div>
            
            {selectedMode === 'vehicle' && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-3">
                  Du behöver ansluta ditt fordon via Smartcar för automatisk spårning.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onConnectVehicle();
                  }}
                  className="w-full"
                >
                  Anslut fordon först
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedMode && (
        <div className="text-center pt-4">
          <Button 
            onClick={() => handleModeSelection(selectedMode)}
            disabled={isLoading || (selectedMode === 'vehicle')}
            size="lg"
            className="w-full md:w-auto"
          >
            {isLoading ? 'Sparar...' : 'Fortsätt med valt läge'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          
          {selectedMode === 'vehicle' && (
            <p className="text-sm text-muted-foreground mt-2">
              Anslut ditt fordon först för att använda automatisk spårning
            </p>
          )}
        </div>
      )}
    </div>
  );
}