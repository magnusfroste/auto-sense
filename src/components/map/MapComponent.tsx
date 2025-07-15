import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapbox } from '@/hooks/useMapbox';
import { Card } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';

interface LocationData {
  lat: number;
  lng: number;
  address?: string;
}

interface MapComponentProps {
  currentLocation?: LocationData | null;
  startLocation?: LocationData | null;
  route?: LocationData[] | any; // Accept both LocationData[] and GeoJSON
  className?: string;
  height?: string;
  showNavigation?: boolean;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  currentLocation,
  startLocation,
  route = [],
  className = '',
  height = 'h-96',
  showNavigation = true
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const { token, loading, error } = useMapbox();

  // Initialize map when token is available (only once)
  useEffect(() => {
    console.log('🗺️ MapComponent init effect triggered:', { 
      hasToken: !!token, 
      hasContainer: !!mapContainer.current, 
      hasMap: !!map.current
    });

    if (!token || !mapContainer.current || map.current) return;

    try {
      console.log('🗺️ Initializing Mapbox map...');
      mapboxgl.accessToken = token;
      
      // Default to Stockholm - we'll update center with markers/route later
      const defaultCenter: [number, number] = [18.0686, 59.3293]; // Stockholm

      console.log('🗺️ Map center:', defaultCenter);

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: defaultCenter,
        zoom: 10, // Start zoomed out, will adjust based on content
        pitch: 0,
      });

      console.log('✅ Mapbox map initialized successfully');

      // Add navigation controls
      if (showNavigation) {
        map.current.addControl(
          new mapboxgl.NavigationControl({
            visualizePitch: true,
          }),
          'top-right'
        );
      }

      map.current.on('load', () => {
        console.log('✅ Mapbox map loaded successfully');
        setMapLoaded(true);
      });

      // Add geolocate control
      const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
      });
      
      map.current.addControl(geolocate);

    } catch (err) {
      console.error('❌ Error initializing map:', err);
      setMapError(err instanceof Error ? err.message : 'Failed to initialize map');
    }

    // Cleanup
    return () => {
      console.log('🗺️ Cleaning up map...');
      if (map.current) {
        map.current.remove();
        map.current = null;
        setMapLoaded(false);
      }
    };
  }, [token, showNavigation]); // Only depend on token and showNavigation, NOT currentLocation

  // Helper function to extract coordinates from route data
  const getRouteCoordinates = (routeData: any): [number, number][] => {
    if (!routeData) return [];
    
    // If it's already an array of LocationData objects
    if (Array.isArray(routeData) && routeData.length > 0 && routeData[0].lat !== undefined) {
      return routeData.map((point: LocationData) => [point.lng, point.lat]);
    }
    
    // If it's GeoJSON FeatureCollection
    if (routeData.type === 'FeatureCollection' && routeData.features) {
      const feature = routeData.features[0];
      if (feature && feature.geometry && feature.geometry.type === 'LineString') {
        return feature.geometry.coordinates;
      }
    }
    
    // If it's GeoJSON Feature
    if (routeData.type === 'Feature' && routeData.geometry && routeData.geometry.type === 'LineString') {
      return routeData.geometry.coordinates;
    }
    
    // If it's just the geometry part
    if (routeData.type === 'LineString' && routeData.coordinates) {
      return routeData.coordinates;
    }
    
    return [];
  };

  // Helper function to validate location data
  const isValidLocation = (location: any): location is LocationData => {
    return (
      location &&
      typeof location.lat === 'number' &&
      typeof location.lng === 'number' &&
      !isNaN(location.lat) &&
      !isNaN(location.lng) &&
      location.lat >= -90 && 
      location.lat <= 90 &&
      location.lng >= -180 && 
      location.lng <= 180
    );
  };

  // Update markers when locations change
  useEffect(() => {
    console.log('🗺️ MapComponent markers effect triggered:', { 
      mapLoaded, 
      hasCurrentLocation: !!currentLocation,
      hasStartLocation: !!startLocation,
      routeLength: route ? getRouteCoordinates(route).length : 0,
      currentLocationValid: isValidLocation(currentLocation),
      startLocationValid: isValidLocation(startLocation),
      currentLocationData: currentLocation,
      startLocationData: startLocation
    });
    
    if (!map.current || !mapLoaded) return;

    // Clear existing markers and sources
    if (map.current.getSource('route')) {
      map.current.removeLayer('route');
      map.current.removeSource('route');
    }

    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Add start location marker - only if valid
    if (isValidLocation(startLocation)) {
      console.log('✅ Adding valid start marker:', startLocation);
      const startMarker = new mapboxgl.Marker({ 
        color: '#22c55e' // Green for start
      })
        .setLngLat([startLocation.lng, startLocation.lat])
        .setPopup(new mapboxgl.Popup().setHTML('<div><strong>Start</strong></div>'))
        .addTo(map.current);
    } else if (startLocation) {
      console.warn('⚠️ Invalid start location data:', startLocation);
    }

    // Add current location marker (end location for completed trips) - only if valid
    if (isValidLocation(currentLocation)) {
      console.log('✅ Adding valid current marker:', currentLocation);
      const currentMarker = new mapboxgl.Marker({ 
        color: '#ef4444' // Red for end
      })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .setPopup(new mapboxgl.Popup().setHTML('<div><strong>Slutpunkt</strong></div>'))
        .addTo(map.current);
    } else if (currentLocation) {
      console.warn('⚠️ Invalid current location data:', currentLocation);
    }

    // Add route if available
    const coordinates = getRouteCoordinates(route);
    if (coordinates.length > 1) {
      const routeGeoJSON = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: coordinates
        }
      };

      map.current.addSource('route', {
        type: 'geojson',
        data: routeGeoJSON
      });

      map.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3b82f6', // Blue for route
          'line-width': 4
        }
      });

      // Fit map to route bounds
      const bounds = new mapboxgl.LngLatBounds();
      coordinates.forEach(coord => bounds.extend(coord));
      map.current.fitBounds(bounds, { padding: 50 });
    } else {
      // If no route but have valid locations, center on them
      const validCurrentLocation = isValidLocation(currentLocation) ? currentLocation : null;
      const validStartLocation = isValidLocation(startLocation) ? startLocation : null;
      const centerLocation = validCurrentLocation || validStartLocation;
      
      if (centerLocation) {
        console.log('🎯 Centering map on valid location:', centerLocation);
        map.current.flyTo({
          center: [centerLocation.lng, centerLocation.lat],
          zoom: 15
        });
      } else {
        console.log('📍 No valid locations found, keeping default center');
      }
    }
  }, [mapLoaded, currentLocation, startLocation, route]);

  if (loading) {
    console.log('🗺️ MapComponent is loading...');
    return (
      <Card className={`${className} ${height} flex items-center justify-center`}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Laddar karta...</p>
        </div>
      </Card>
    );
  }

  if (error || mapError) {
    const displayError = error || mapError;
    console.log('🗺️ MapComponent has error:', displayError);
    return (
      <Card className={`${className} ${height} flex items-center justify-center`}>
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Kunde inte ladda karta</p>
          <p className="text-xs text-muted-foreground">{displayError}</p>
        </div>
      </Card>
    );
  }

  console.log('🗺️ MapComponent rendering map container, token available:', !!token);

  return (
    <Card className={`${className} ${height} overflow-hidden`}>
      <div ref={mapContainer} className="w-full h-full" />
    </Card>
  );
};