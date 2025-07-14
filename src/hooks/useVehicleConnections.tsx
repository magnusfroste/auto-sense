import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

interface VehicleConnection {
  id: string;
  user_id: string;
  vehicle_id: string;
  smartcar_vehicle_id: string;
  access_token: string;
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

  const fetchConnections = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('vehicle_connections')
        .select('id, user_id, vehicle_id, smartcar_vehicle_id, access_token, make, model, year, vin, is_active, connected_at, last_sync_at')
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
  }, [user, toast]);

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
      
      console.log('Opening OAuth popup:', authData.oauth_url);

      // Open popup for OAuth
      const popup = window.open(
        authData.oauth_url,
        'smartcar_oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Listen for popup messages
      const handleMessage = (event: MessageEvent) => {
        // Accept messages from popup and validate content instead of origin
        if (!event.data || typeof event.data !== 'object') return;
        
        // Handle both old and new message types
        if (event.data.type === 'oauth_success' || event.data.type === 'SMARTCAR_AUTH_SUCCESS') {
          popup.close();
          window.removeEventListener('message', handleMessage);
          handleOAuthSuccess(event.data.code, event.data.state);
        } else if (event.data.type === 'oauth_error') {
          popup.close();
          window.removeEventListener('message', handleMessage);
          toast({
            title: "Fel",
            description: "OAuth-fel: " + event.data.error,
            variant: "destructive",
          });
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          console.log('Popup was closed manually');
        }
      }, 1000);

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
  }, [fetchConnections]);

  // Handle OAuth callback from URL parameters (after redirect)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth_success');
    const oauthError = urlParams.get('oauth_error');
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (oauthError) {
      toast({
        title: "OAuth Fel",
        description: `OAuth error: ${oauthError}`,
        variant: "destructive"
      });
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (oauthSuccess && code) {
      handleOAuthSuccess(code, state);
    }
  }, []);

  const handleOAuthSuccess = async (code: string, state: string | null) => {
    const storedState = localStorage.getItem('smartcar_state');
    const userId = localStorage.getItem('smartcar_user_id');
    const testMode = localStorage.getItem('smartcar_test_mode') === 'true';

    console.log('🎯 Processing OAuth success via URL redirect:', { 
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
      
      // Automatically enable vehicle tracking and start polling
      console.log('Automatically enabling vehicle tracking and starting polling...');
      try {
        // Update user's tracking mode to 'vehicle'
        const { error: profileError } = await supabase
          .from('sense_profiles')
          .update({ tracking_mode: 'vehicle' })
          .eq('id', userId);

        if (profileError) {
          console.error('Error updating tracking mode:', profileError);
        } else {
          console.log('Successfully updated tracking mode to vehicle');
        }

        // Start vehicle polling for all connected vehicles
        const { error: pollingError } = await supabase.functions.invoke('vehicle-trip-polling', {
          body: { action: 'start_all' }
        });

        if (pollingError) {
          console.error('Error starting vehicle polling:', pollingError);
        } else {
          console.log('Successfully started vehicle polling');
        }
      } catch (autoError) {
        console.error('Error in automatic setup:', autoError);
      }
      
      const vehicleCount = data?.connections_stored || 1;
      toast({
        title: "Fordon anslutet!",
        description: `${vehicleCount} fordon har anslutits och automatisk spårning är nu aktiverad`
      });

    } catch (error: any) {
      console.error('Error completing OAuth:', error);
      toast({
        title: "Fel",
        description: error.message || "Kunde inte slutföra fordonsanslutning",
        variant: "destructive"
      });
    } finally {
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  return {
    connections,
    loading,
    connectVehicle,
    disconnectVehicle,
    refreshConnections: fetchConnections
  };
};