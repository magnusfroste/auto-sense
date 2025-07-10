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
  route?: LocationData[];
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
  const { token, loading, error } = useMapbox();

  // Initialize map when token is available
  useEffect(() => {
    if (!token || !mapContainer.current || map.current) return;

    try {
      mapboxgl.accessToken = token;
      
      // Default to Stockholm if no location provided
      const defaultCenter: [number, number] = currentLocation ? 
        [currentLocation.lng, currentLocation.lat] : 
        [18.0686, 59.3293]; // Stockholm

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: defaultCenter,
        zoom: currentLocation ? 15 : 10,
        pitch: 0,
      });

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
      console.error('Error initializing map:', err);
    }

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        setMapLoaded(false);
      }
    };
  }, [token, showNavigation]);

  // Update markers when locations change
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers and sources
    if (map.current.getSource('route')) {
      map.current.removeLayer('route');
      map.current.removeSource('route');
    }

    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Add start location marker
    if (startLocation) {
      const startMarker = new mapboxgl.Marker({ 
        color: '#22c55e' // Green for start
      })
        .setLngLat([startLocation.lng, startLocation.lat])
        .setPopup(new mapboxgl.Popup().setHTML('<div><strong>Start</strong></div>'))
        .addTo(map.current);
    }

    // Add current location marker
    if (currentLocation) {
      const currentMarker = new mapboxgl.Marker({ 
        color: '#3b82f6' // Blue for current
      })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .setPopup(new mapboxgl.Popup().setHTML('<div><strong>Nuvarande position</strong></div>'))
        .addTo(map.current);

      // Center map on current location
      map.current.flyTo({
        center: [currentLocation.lng, currentLocation.lat],
        zoom: 15
      });
    }

    // Add route if available
    if (route.length > 1) {
      const routeGeoJSON = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: route.map(point => [point.lng, point.lat])
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
          'line-color': '#ef4444', // Red for route
          'line-width': 4
        }
      });

      // Fit map to route bounds
      const bounds = new mapboxgl.LngLatBounds();
      route.forEach(point => bounds.extend([point.lng, point.lat]));
      map.current.fitBounds(bounds, { padding: 50 });
    }
  }, [mapLoaded, currentLocation, startLocation, route]);

  if (loading) {
    return (
      <Card className={`${className} ${height} flex items-center justify-center`}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Laddar karta...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`${className} ${height} flex items-center justify-center`}>
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Kunde inte ladda karta</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`${className} ${height} overflow-hidden`}>
      <div ref={mapContainer} className="w-full h-full" />
    </Card>
  );
};