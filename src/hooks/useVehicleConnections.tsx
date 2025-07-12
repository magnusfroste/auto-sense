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
    if (!user) {
      console.error('No user found for vehicle connection');
      return;
    }

    console.log('Starting vehicle connection process:', { testMode, userId: user.id });

    try {
      // Call edge function with test mode as query parameter
      console.log('Calling smartcar-auth GET endpoint...');
      const functionName = testMode ? 'smartcar-auth?test=true' : 'smartcar-auth';
      const { data: authData, error: authError } = await supabase.functions.invoke(functionName, {
        method: 'GET'
      });

      console.log('GET response:', { authData, authError });

      if (authError) {
        console.error('Auth data error:', authError);
        throw authError;
      }

      if (!authData?.oauth_url || !authData?.state) {
        console.error('Invalid auth data received:', authData);
        throw new Error('Invalid OAuth data received from server');
      }

      // Store state for verification
      const state = authData.state;
      localStorage.setItem('smartcar_state', state);
      localStorage.setItem('smartcar_user_id', user.id);
      localStorage.setItem('smartcar_test_mode', testMode.toString());
      
      console.log('Stored OAuth state and opening popup:', { state, testMode });

      // Open OAuth flow in popup
      const popup = window.open(
        authData.oauth_url,
        'smartcar-connect',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      console.log('OAuth popup opened, waiting for completion...');

      // Listen for popup completion with timeout
      let timeoutId: NodeJS.Timeout;
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          clearTimeout(timeoutId);
          console.log('Popup closed, checking for connection...');
          // Check if connection was successful
          setTimeout(() => {
            fetchConnections();
          }, 1000);
        }
      }, 1000);

      // Add timeout after 5 minutes
      timeoutId = setTimeout(() => {
        clearInterval(checkClosed);
        if (popup && !popup.closed) {
          popup.close();
          console.log('OAuth popup timed out');
          toast({
            title: "Tidsgräns överskred",
            description: "OAuth-processen tog för lång tid. Försök igen.",
            variant: "destructive"
          });
        }
      }, 300000); // 5 minutes

    } catch (error: any) {
      console.error('Error connecting vehicle:', error);
      toast({
        title: "Fel",
        description: error.message || "Kunde inte ansluta fordon",
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
      // Filter out MetaMask and other unwanted messages
      if (event.data?.target === 'metamask-inpage' || 
          event.data?.name === 'metamask-provider') {
        return; // Ignore MetaMask messages
      }

      console.log('Filtered message event received:', {
        origin: event.origin,
        data: event.data,
        type: typeof event.data,
        hasType: event.data?.type,
        hasCode: !!event.data?.code,
        hasState: !!event.data?.state
      });
      
      // Handle different message formats and sources
      if (event.data && typeof event.data === 'object') {
        // Handle direct message format
        if (event.data.type === 'SMARTCAR_AUTH_SUCCESS') {
          console.log('Processing SMARTCAR_AUTH_SUCCESS message');
          await handleOAuthSuccess(event.data);
        }
        // Handle nested message format (from Smartcar callback)
        else if (event.data.code && event.data.state && !event.data.target) {
          console.log('Processing OAuth callback with code and state');
          await handleOAuthSuccess({ ...event.data, type: 'SMARTCAR_AUTH_SUCCESS' });
        }
      }
    };

    const handleOAuthSuccess = async (data: any) => {
      const { code, state } = data;
      const storedState = localStorage.getItem('smartcar_state');
      const userId = localStorage.getItem('smartcar_user_id');
      const testMode = localStorage.getItem('smartcar_test_mode') === 'true';

      console.log('Processing OAuth success:', { 
        code: code?.substring(0, 10) + '...', 
        state, 
        storedState, 
        userId,
        testMode,
        stateMatch: state === storedState
      });

      if (!code || !state) {
        console.error('Missing code or state in OAuth callback');
        toast({
          title: "Fel",
          description: "Ofullständig OAuth-callback",
          variant: "destructive"
        });
        return;
      }

      if (state !== storedState) {
        console.error('State mismatch:', { received: state, stored: storedState });
        toast({
          title: "Säkerhetsfel",
          description: "OAuth state mismatch",
          variant: "destructive"
        });
        return;
      }

      if (!userId) {
        console.error('Missing user ID in OAuth callback');
        toast({
          title: "Fel",
          description: "Användar-ID saknas",
          variant: "destructive"
        });
        return;
      }

      try {
        console.log('Making POST request to complete OAuth...');
        const { data, error } = await supabase.functions.invoke('smartcar-auth', {
          body: { 
            code, 
            user_id: userId,
            test: testMode
          }
        });

        console.log('POST response:', { data, error });

        if (error) {
          console.error('Edge function error:', error);
          throw new Error(error.message || 'Unknown server error');
        }

        // Clean up localStorage
        localStorage.removeItem('smartcar_state');
        localStorage.removeItem('smartcar_user_id');
        localStorage.removeItem('smartcar_test_mode');
        
        console.log('OAuth completed successfully, fetching updated connections...');
        await fetchConnections();
        
        const vehicleCount = data?.connections_stored || 1;
        toast({
          title: "Fordon anslutet!",
          description: `${vehicleCount} fordon har anslutits och kan nu automatiskt spåra resor`
        });

      } catch (error: any) {
        console.error('Error completing OAuth:', error);
        toast({
          title: "Fel",
          description: error.message || "Kunde inte slutföra fordonsanslutning",
          variant: "destructive"
        });
      }
    };

    console.log('Adding message event listener...');
    window.addEventListener('message', handleMessage);
    return () => {
      console.log('Removing message event listener...');
      window.removeEventListener('message', handleMessage);
    };
  }, [toast, fetchConnections]);

  return {
    connections,
    loading,
    connectVehicle,
    disconnectVehicle,
    refreshConnections: fetchConnections
  };
};