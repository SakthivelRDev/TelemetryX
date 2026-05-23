'use client';
import { useEffect, useRef, useState } from 'react';

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

// Available tile layers
const TILE_LAYERS = {
  dark: {
    label: '🌑 Dark',
    url:   'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19,
  },
  light: {
    label: '🌤 Light',
    url:   'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19,
  },
  satellite: {
    label: '🛰 Satellite',
    url:   'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &copy; NASA &copy; NGA &copy; USGS',
    maxZoom: 18,
  },
  terrain: {
    label: '🏔 Terrain',
    url:   'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap &copy; OpenTopoMap',
    maxZoom: 17,
  },
  streets: {
    label: '🗺 Streets',
    url:   'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
};

export default function SiteMap({ sites = [], onSiteClick }) {
  const mapRef         = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef     = useRef([]);
  const tileLayerRef   = useRef(null);
  const [activeLayer, setActiveLayer] = useState('dark');

  // Initialize map once
  useEffect(() => {
    if (typeof window === 'undefined' || mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      if (mapInstanceRef.current) return;

      const map = L.default.map(mapRef.current, {
        center:      [20.5937, 78.9629],
        zoom:        5,
        zoomControl: true,
      });

      const layer = TILE_LAYERS[activeLayer];
      tileLayerRef.current = L.default.tileLayer(layer.url, {
        attribution: layer.attribution,
        maxZoom:     layer.maxZoom,
        subdomains:  'abcd',
      }).addTo(map);

      mapInstanceRef.current = map;
      updateMarkers(L.default, map);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Switch tile layer when activeLayer changes
  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === 'undefined') return;

    import('leaflet').then((L) => {
      if (tileLayerRef.current) {
        mapInstanceRef.current.removeLayer(tileLayerRef.current);
      }
      const layer = TILE_LAYERS[activeLayer];
      tileLayerRef.current = L.default.tileLayer(layer.url, {
        attribution: layer.attribution,
        maxZoom:     layer.maxZoom,
        subdomains:  'abcd',
      }).addTo(mapInstanceRef.current);
    });
  }, [activeLayer]);

  // Update markers when sites change
  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === 'undefined') return;
    import('leaflet').then((L) => updateMarkers(L.default, mapInstanceRef.current));
  }, [sites]);

  function updateMarkers(L, map) {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    sites.forEach((site) => {
      const color      = STATUS_COLORS[site.status]      || '#10b981';
      const alarmColor = SEVERITY_COLORS[site.topSeverity] || '#10b981';
      const radius     = site.status === 'CRITICAL' ? 14 : site.status === 'WARNING' ? 11 : 9;

      const marker = L.circleMarker([site.lat, site.lng], {
        radius,
        fillColor:   color,
        color:       '#fff',
        fillOpacity: 0.85,
        weight:      2,
        opacity:     1,
      });

      const popupContent = `
        <div style="font-family: Inter, sans-serif; min-width: 210px; padding: 4px;">
          <div style="font-weight: 700; font-size: 14px; color: #e2e8f0; margin-bottom: 6px;">${site.name}</div>
          <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">📍 ${site.region} Region</div>
          <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
            <span style="background:${color}22;color:${color};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid ${color}55;">${site.status}</span>
            <span style="background:${alarmColor}22;color:${alarmColor};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid ${alarmColor}55;">${site.topSeverity || 'INFO'}</span>
          </div>
          <div style="font-size:12px;color:#94a3b8;margin-bottom:10px;">🔔 ${site.alarmCount || 0} alarms</div>
          <a href="/alarms?siteId=${site.id}" style="display:block;text-align:center;background:#6378ff22;color:#818cf8;padding:6px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:500;border:1px solid #6378ff44;">View Alarms →</a>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 260 });
      marker.on('click', () => onSiteClick && onSiteClick(site));
      marker.addTo(map);
      markersRef.current.push(marker);
    });
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Tile Layer Switcher */}
      <div className="tile-control" style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', zIndex: 1000, background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '0.4rem', border: '1px solid var(--border-color)' }}>
        {Object.entries(TILE_LAYERS).map(([key, layer]) => (
          <button
            key={key}
            className={`tile-btn ${activeLayer === key ? 'active' : ''}`}
            onClick={() => setActiveLayer(key)}
            id={`tile-layer-${key}`}
            title={layer.label}
            style={{ margin: '1px', display: 'inline-block' }}
          >
            {layer.label}
          </button>
        ))}
      </div>

      <div ref={mapRef} style={{ height: '600px', width: '100%', borderRadius: 'var(--radius-lg)' }} />
    </div>
  );
}
