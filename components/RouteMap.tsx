
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { GeoPoint, Checkpoint } from '../types';

interface RouteMapProps {
  points: GeoPoint[];
  checkpoints: Checkpoint[];
}

const RouteMap: React.FC<RouteMapProps> = ({ points, checkpoints }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const currentPosMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Default center (using first checkpoint or Vietnam center)
    const initialCenter: [number, number] = checkpoints.length > 0 
      ? [checkpoints[0].lat, checkpoints[0].lng] 
      : [10.762622, 106.660172];

    const map = L.map(mapRef.current, {
      center: initialCenter,
      zoom: 17,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Sync Checkpoints
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    checkpoints.forEach(cp => {
      if (!markersRef.current[cp.id]) {
        const marker = L.marker([cp.lat, cp.lng], {
          icon: L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg border border-slate-600 whitespace-nowrap -translate-x-1/2 -translate-y-full mb-2">
                     <i class="fas fa-map-pin text-amber-500 mr-1"></i>${cp.name}
                   </div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
          })
        }).addTo(map);
        markersRef.current[cp.id] = marker;
      }
    });
  }, [checkpoints]);

  // Sync Route and Current Position
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || points.length === 0) return;

    const latLngs = points.map(p => L.latLng(p.lat, p.lng));

    // Update Polyline
    if (polylineRef.current) {
      polylineRef.current.setLatLngs(latLngs);
    } else {
      polylineRef.current = L.polyline(latLngs, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.8,
        lineJoin: 'round',
        dashArray: '1, 5' // Style it a bit
      }).addTo(map);
    }

    // Update Current Position Marker
    const lastPoint = points[points.length - 1];
    const currentPos: [number, number] = [lastPoint.lat, lastPoint.lng];

    if (currentPosMarkerRef.current) {
      currentPosMarkerRef.current.setLatLng(currentPos);
    } else {
      currentPosMarkerRef.current = L.marker(currentPos, {
        icon: L.divIcon({
          className: 'pulse-marker',
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })
      }).addTo(map);
    }

    // Auto-center on movement
    map.panTo(currentPos);

  }, [points]);

  return (
    <div className="relative w-full aspect-square bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-inner z-0">
      <div ref={mapRef} className="w-full h-full" />
      <div className="absolute top-4 left-4 z-[1000]">
        <span className="bg-white/90 backdrop-blur-sm text-slate-800 text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm border border-slate-200 uppercase tracking-tight">
          <i className="fas fa-satellite-dish text-blue-500 mr-1.5 animate-pulse"></i>
          Live Tracking Active
        </span>
      </div>
    </div>
  );
};

export default RouteMap;
