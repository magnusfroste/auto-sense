import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useMapbox = () => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        console.log('🗺️ Fetching Mapbox token...');
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        console.log('🗺️ Mapbox token response:', { data, error });
        
        if (error) {
          console.error('❌ Mapbox token error:', error);
          throw error;
        }
        
        if (data?.token) {
          console.log('✅ Mapbox token received successfully');
          setToken(data.token);
        } else {
          console.error('❌ No Mapbox token in response:', data);
          throw new Error('No token received');
        }
      } catch (err) {
        console.error('❌ Error fetching Mapbox token:', err);
        setError(err instanceof Error ? err.message : 'Failed to load map');
      } finally {
        setLoading(false);
      }
    };

    fetchMapboxToken();
  }, []);

  return { token, loading, error };
};