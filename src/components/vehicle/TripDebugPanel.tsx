import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useVehicleConnections } from '@/hooks/useVehicleConnections';
import { RefreshCw, Bug, Play } from 'lucide-react';

export const TripDebugPanel = () => {
  const [isPolling, setIsPolling] = useState(false);
  const { connections } = useVehicleConnections();
  const { toast } = useToast();

  const manualTriggerPolling = async () => {
    setIsPolling(true);
    try {
      console.log('🔧 Manually triggering vehicle polling...');
      
      const { data, error } = await supabase.functions.invoke('vehicle-trip-polling', {
        body: {}
      });

      if (error) throw error;

      console.log('✅ Manual polling result:', data);
      
      toast({
        title: 'Polling triggrad',
        description: 'Automatisk trip detection har körts manuellt'
      });
    } catch (error: any) {
      console.error('❌ Manual polling error:', error);
      toast({
        title: 'Polling fel',
        description: error.message || 'Kunde inte köra manuell polling',
        variant: 'destructive'
      });
    } finally {
      setIsPolling(false);
    }
  };

  // Don't show in production
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <Card className="border-dashed border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/20">
      <CardHeader>
        <CardTitle className="flex items-center text-yellow-800 dark:text-yellow-200">
          <Bug className="mr-2 h-5 w-5" />
          Debug Panel
        </CardTitle>
        <CardDescription>
          Manuell kontroll för trip detection (endast utvecklingsläge)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Anslutna fordon: {connections.length}</p>
            <p className="text-xs text-muted-foreground">
              {connections.map(c => `${c.make} ${c.model}`).join(', ') || 'Inga fordon'}
            </p>
          </div>
          <Badge variant="outline" className="border-yellow-400">
            Debug läge
          </Badge>
        </div>

        <Button 
          onClick={manualTriggerPolling}
          disabled={isPolling}
          className="w-full bg-yellow-600 hover:bg-yellow-700"
          size="sm"
        >
          {isPolling ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          {isPolling ? 'Kör polling...' : 'Trigga manuell polling'}
        </Button>

        <div className="text-xs text-muted-foreground">
          <p>• Kör manuell trip detection</p>
          <p>• Kontrollera logs i browser console</p>
          <p>• Treshold: 100m för resa, 2min för avslut</p>
        </div>
      </CardContent>
    </Card>
  );
};