import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Smartphone, Car } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';

export function TrackingModeSelector() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [trackingMode, setTrackingMode] = useState<'gps' | 'vehicle'>('gps');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrackingMode();
  }, [user]);

  const fetchTrackingMode = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('sense_profiles')
        .select('tracking_mode')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      setTrackingMode((data?.tracking_mode as 'gps' | 'vehicle') || 'gps');
    } catch (error) {
      console.error('Error fetching tracking mode:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTrackingMode = async (mode: 'gps' | 'vehicle') => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('sense_profiles')
        .update({ tracking_mode: mode })
        .eq('id', user.id);

      if (error) throw error;

      setTrackingMode(mode);
      toast({
        title: 'Spårningsläge uppdaterat',
        description: `Du använder nu ${mode === 'gps' ? 'GPS' : 'fordon'}-spårning som standard.`,
      });
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte uppdatera spårningsläge.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spårningsläge</CardTitle>
          <CardDescription>Laddar...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spårningsläge</CardTitle>
        <CardDescription>
          Välj hur du vill spåra dina resor. Detta påverkar hur appen fungerar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={trackingMode}
          onValueChange={(value) => updateTrackingMode(value as 'gps' | 'vehicle')}
          className="space-y-4"
        >
          <div className="flex items-center space-x-3 p-4 rounded-lg border bg-card">
            <RadioGroupItem value="gps" id="gps" />
            <Smartphone className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <Label htmlFor="gps" className="text-base font-medium cursor-pointer">
                GPS-spårning
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Manuell kontroll - starta och stoppa resor själv med telefonens GPS
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 p-4 rounded-lg border bg-card">
            <RadioGroupItem value="vehicle" id="vehicle" />
            <Car className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <Label htmlFor="vehicle" className="text-base font-medium cursor-pointer">
                Fordons-spårning
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Automatisk - resor detekteras och spåras automatiskt via ditt anslutna fordon
              </p>
            </div>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}