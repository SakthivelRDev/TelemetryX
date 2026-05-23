'use client';
import { useEffect, useRef } from 'react';

const STATUS_COLORS = {
  CRITICAL: '#ef4444',
  WARNING:  '#f59e0b',
  OK:       '#10b981',
};

const SEVERITY_COLORS = {
  CRITICAL: '#ef4444',
  MAJOR:    '#f97316',
  MINOR:    '#eab308',
  WARNING:  '#f59e0b',
  INFO:     '#6378ff',
};

// Using dynamic import for Leaflet to avoid SSR issues
export default function SiteMap({ sites = [], onSiteClick }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Dynamic import Leaflet (client-side only)
    import('leaflet').then((L) => {
      import('leaflet/dist/leaflet.css');

      if (mapInstanceRef.current) {
        // Already initialized — just update markers
        updateMarkers(L.default, mapInstanceRef.current);
        return;
      }

      // Initialize map centered on India
      const map = L.default.map(mapRef.current, {
        center: [20.5937, 78.9629],
        zoom: 5,
        zoomControl: true,
      });

      // Dark tile layer
      L.default.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      updateMarkers(L.default, map);
    });

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when sites change
  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === 'undefined') return;
    import('leaflet').then((L) => {
      updateMarkers(L.default, mapInstanceRef.current);
    });
  }, [sites]);

  function updateMarkers(L, map) {
    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    sites.forEach((site) => {
      const color = STATUS_COLORS[site.status] || '#10b981';
      const alarmColor = SEVERITY_COLORS[site.topSeverity] || '#10b981';

      // Custom circle marker
      const marker = L.circleMarker([site.lat, site.lng], {
        radius:      site.status === 'CRITICAL' ? 14 : site.status === 'WARNING' ? 11 : 9,
        fillColor:   color,
        color:       color,
        fillOpacity: 0.75,
        weight:      2,
        opacity:     1,
      });

      // Popup content
      const popupContent = `
        <div style="font-family: Inter, sans-serif; min-width: 200px; padding: 4px;">
          <div style="font-weight: 700; font-size: 14px; color: #e2e8f0; margin-bottom: 8px;">${site.name}</div>
          <div style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">📍 ${site.region}</div>
          <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
            <span style="background: ${color}22; color: ${color}; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; border: 1px solid ${color}55;">${site.status}</span>
            <span style="background: ${alarmColor}22; color: ${alarmColor}; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; border: 1px solid ${alarmColor}55;">${site.topSeverity || 'OK'}</span>
          </div>
          <div style="font-size: 12px; color: #94a3b8; margin-bottom: 10px;">🔔 ${site.alarmCount || 0} total alarms</div>
          <a href="/alarms?siteId=${site.id}" style="display: block; text-align: center; background: #6378ff22; color: #818cf8; padding: 6px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 500; border: 1px solid #6378ff44;">View Alarms →</a>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 260 });
      marker.on('click', () => onSiteClick && onSiteClick(site));
      marker.addTo(map);
      markersRef.current.push(marker);
    });
  }

  return (
    <div ref={mapRef} style={{ height: '600px', width: '100%', borderRadius: '16px' }} />
  );
}
