import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

interface VehicleConnection {
  id: string;
  user_id: string;
  vehicle_id: string;
  smartcar_vehicle_id: string;
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  is_active: boolean;
  connected_at: string;
  last_sync_at?: string;
}

export const useVehicleConnections = () => {
  const [connections, setConnections] = useState<VehicleConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchConnections = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('vehicle_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('connected_at', { ascending: false });

      if (error) throw error;
      
      setConnections(data || []);
    } catch (error: any) {
      console.error('Error fetching vehicle connections:', error);
      toast({
        title: "Fel",
        description: "Kunde inte hämta fordonsanslutningar",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const connectVehicle = async (testMode: boolean = false) => {
    if (!user) return;

    try {
      // Get OAuth URL from edge function with optional test mode
      const url = new URL(`${window.location.origin}/functions/v1/smartcar-auth`)
      if (testMode) {
        url.searchParams.set('test', 'true')
      }

      const { data: authData, error: authError } = await supabase.functions.invoke('smartcar-auth', {
        method: 'GET',
        ...(testMode && { body: { test: true } })
      });

      if (authError) throw authError;

      // Store state for verification
      const state = authData.state;
      localStorage.setItem('smartcar_state', state);
      localStorage.setItem('smartcar_user_id', user.id);

      // Open OAuth flow in popup
      const popup = window.open(
        authData.oauth_url,
        'smartcar-connect',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for popup completion
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          // Check if connection was successful
          setTimeout(() => {
            fetchConnections();
          }, 1000);
        }
      }, 1000);

    } catch (error: any) {
      console.error('Error connecting vehicle:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ansluta fordon",
        variant: "destructive"
      });
    }
  };

  const disconnectVehicle = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('vehicle_connections')
        .update({ is_active: false })
        .eq('id', connectionId)
        .eq('user_id', user?.id);

      if (error) throw error;

      await fetchConnections();
      
      toast({
        title: "Fordon frånkopplat",
        description: "Fordonsanslutningen har inaktiverats"
      });
    } catch (error: any) {
      console.error('Error disconnecting vehicle:', error);
      toast({
        title: "Fel",
        description: "Kunde inte koppla från fordon",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [user]);

  // Handle OAuth callback
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'SMARTCAR_AUTH_SUCCESS') {
        const { code, state } = event.data;
        const storedState = localStorage.getItem('smartcar_state');
        const userId = localStorage.getItem('smartcar_user_id');

        if (state === storedState && userId) {
          try {
            const { error } = await supabase.functions.invoke('smartcar-auth', {
              body: { code, user_id: userId }
            });

            if (error) throw error;

            localStorage.removeItem('smartcar_state');
            localStorage.removeItem('smartcar_user_id');
            
            await fetchConnections();
            
            toast({
              title: "Fordon anslutet!",
              description: "Ditt fordon har anslutits och kan nu automatiskt spåra resor"
            });
          } catch (error: any) {
            console.error('Error completing OAuth:', error);
            toast({
              title: "Fel",
              description: "Kunde inte slutföra fordonsanslutning",
              variant: "destructive"
            });
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [toast]);

  return {
    connections,
    loading,
    connectVehicle,
    disconnectVehicle,
    refreshConnections: fetchConnections
  };
};