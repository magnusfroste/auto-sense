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
        .select('id, user_id, vehicle_id, smartcar_vehicle_id, access_token, make, model, year, vin, connected_at, last_sync_at')
        .eq('user_id', user.id)
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

      // Redirect to OAuth URL (will come back to /settings with parameters)
      console.log('Redirecting to OAuth URL:', authData.oauth_url);
      window.location.href = authData.oauth_url;

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
        .delete()
        .eq('id', connectionId)
        .eq('user_id', user?.id);

      if (error) throw error;

      await fetchConnections();
      
      toast({
        title: "Fordon borttaget",
        description: "Fordonsanslutningen och alla relaterade resor har tagits bort"
      });
    } catch (error: any) {
      console.error('Error disconnecting vehicle:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ta bort fordon",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Expose OAuth redirect handler for Settings page
  const handleOAuthRedirect = useCallback(async (code: string, state: string, autoStart: boolean = false) => {
    console.log('🎯 handleOAuthRedirect called with:', { code: code?.substring(0, 10) + '...', state, autoStart });
    await handleOAuthSuccess(code, state);
    // Clean URL after processing
    window.history.replaceState({}, '', window.location.pathname);
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
      stateMatch: state === storedState,
      hasStoredData: !!(storedState && userId)
    });

    if (!code || !state) {
      console.error('❌ Missing code or state in OAuth callback');
      toast({
        title: "Fel",
        description: "Ofullständig OAuth-callback",
        variant: "destructive"
      });
      return;
    }

    if (state !== storedState) {
      console.error('❌ State mismatch:', { received: state, stored: storedState });
      toast({
        title: "Säkerhetsfel",
        description: "OAuth state mismatch",
        variant: "destructive"
      });
      return;
    }

    if (!userId) {
      console.error('❌ Missing user ID in OAuth callback - localStorage might have been cleared');
      
      // Fallback to current user if available
      if (user?.id) {
        console.log('⚠️ Using current user ID as fallback:', user.id);
        // We'll continue with current user, but can't determine test mode
      } else {
        toast({
          title: "Fel",
          description: "Användar-ID saknas",
          variant: "destructive"
        });
        return;
      }
    }

    const finalUserId = userId || user?.id;
    console.log('📤 Making POST request to complete OAuth...', { finalUserId, testMode });

    try {
      const { data, error } = await supabase.functions.invoke('smartcar-auth', {
        body: { 
          code, 
          user_id: finalUserId,
          test: testMode
        }
      });

      console.log('📥 POST response:', { data, error, hasData: !!data, hasError: !!error });

      if (error) {
        console.error('❌ Edge function error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          status: error.status,
          statusText: error.statusText,
          fullError: error
        });
        throw new Error(`Smartcar error: ${error.message || error.statusText || 'Unknown server error'} (Status: ${error.status || 'unknown'})`);
      }

      // Clean up localStorage
      localStorage.removeItem('smartcar_state');
      localStorage.removeItem('smartcar_user_id');
      localStorage.removeItem('smartcar_test_mode');
      
      console.log('✅ OAuth completed successfully, fetching updated connections...');
      await fetchConnections();
      
      // Automatically enable vehicle tracking and start polling
      console.log('🚗 Automatically enabling vehicle tracking and starting polling...');
      try {
        // Update user's tracking mode to 'vehicle'
        const { error: profileError } = await supabase
          .from('sense_profiles')
          .update({ tracking_mode: 'vehicle' })
          .eq('id', finalUserId);

        if (profileError) {
          console.error('❌ Error updating tracking mode:', profileError);
        } else {
          console.log('✅ Successfully updated tracking mode to vehicle');
        }

        // Start vehicle polling for all connected vehicles
        const { error: pollingError } = await supabase.functions.invoke('vehicle-trip-polling-v2', {
          body: {} // Empty body means poll all vehicles
        });

        if (pollingError) {
          console.error('❌ Error starting vehicle polling:', pollingError);
        } else {
          console.log('✅ Successfully started vehicle polling');
        }
      } catch (autoError) {
        console.error('❌ Error in automatic setup:', autoError);
      }
      
      const vehicleCount = data?.connections_stored || 1;
      console.log('🎉 Showing success toast for', vehicleCount, 'vehicles');
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
    refreshConnections: fetchConnections,
    handleOAuthRedirect
  };
};