import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useVehicleConnections } from '@/hooks/useVehicleConnections';
import { RefreshCw, Bug, Play, Clock } from 'lucide-react';

interface VehicleStateHistory {
  timestamp: string;
  odometer: number;
  delta: number;
  poll_time: string;
}

export const TripDebugPanel = () => {
  const [isPolling, setIsPolling] = useState(false);
  const [stateHistory, setStateHistory] = useState<VehicleStateHistory[]>([]);
  const { connections } = useVehicleConnections();
  const { toast } = useToast();

  const fetchVehicleStateHistory = async () => {
    if (connections.length === 0) {
      console.log('🔧 Debug: No connections available for history fetch');
      return;
    }

    console.log('🔧 Debug: Fetching vehicle state history for connection:', connections[0].id);
    
    try {
      const { data, error } = await supabase
        .from('vehicle_states')
        .select('last_odometer, last_poll_time, updated_at')
        .eq('connection_id', connections[0].id)
        .not('last_odometer', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(100); // Show more entries to see the full data stream

      if (error) throw error;

      if (data && data.length > 0) {
        const history: VehicleStateHistory[] = data
          .filter(state => state.last_odometer !== null)
          .map((state, index, array) => {
            const odometer = state.last_odometer || 0;
            const prevOdometer = array[index + 1]?.last_odometer || odometer;
            const delta = Math.abs(odometer - prevOdometer) * 1000; // Convert km to meters
            
            return {
              timestamp: state.updated_at,
              odometer: odometer,
              delta: index === array.length - 1 ? 0 : delta, // No delta for the oldest entry
              poll_time: state.last_poll_time || state.updated_at
            };
          })
          .reverse(); // Show oldest first for chronological order

        setStateHistory(history);
      }
    } catch (error) {
      console.error('Error fetching vehicle state history:', error);
    }
  };

  useEffect(() => {
    fetchVehicleStateHistory();
    const interval = setInterval(fetchVehicleStateHistory, 5000); // Refresh every 5 seconds for more real-time feel
    
    // Set up real-time subscription for vehicle_states updates
    const channel = supabase
      .channel('vehicle-states-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vehicle_states'
        },
        (payload) => {
          console.log('🔧 Debug: Vehicle state updated in real-time:', payload);
          // Refresh data when vehicle_states changes
          setTimeout(() => fetchVehicleStateHistory(), 500);
        }
      )
      .subscribe();
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [connections]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('sv-SE');
  };

  const manualTriggerPolling = async () => {
    setIsPolling(true);
    try {
      console.log('🔧 Manually triggering vehicle polling...');
      
      const { data, error } = await supabase.functions.invoke('vehicle-trip-polling-v2', {
        body: {}
      });

      if (error) throw error;

      console.log('✅ Manual polling result:', data);
      
      toast({
        title: 'Polling triggrad',
        description: 'Automatisk trip detection har körts manuellt'
      });

      // Refresh history after polling
      setTimeout(() => fetchVehicleStateHistory(), 1000);
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

        {stateHistory.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center text-sm font-medium text-yellow-800 dark:text-yellow-200">
              <Clock className="mr-2 h-4 w-4" />
              Odometer Data Stream (varje API-anrop = ny rad)
            </div>
            <div className="max-h-80 overflow-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tid</TableHead>
                    <TableHead className="text-xs">Odometer (km)</TableHead>
                    <TableHead className="text-xs">Delta (m)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stateHistory.map((entry, index) => (
                    <TableRow key={`${entry.timestamp}-${index}`} className="text-xs">
                      <TableCell className="font-mono">
                        {formatTime(entry.poll_time)}
                      </TableCell>
                      <TableCell className="font-mono">
                        {entry.odometer.toFixed(3)}
                      </TableCell>
                      <TableCell className="font-mono">
                        <span className={entry.delta > 0 ? 'text-green-600 font-medium' : 'text-gray-500'}>
                          {entry.delta > 0 ? `+${entry.delta.toFixed(0)}` : '-'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              Real-time uppdateringar + refresh var 5:e sekund. Varje rad = en datapunkt från Smartcar API.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};