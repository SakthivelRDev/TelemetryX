'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

// ── Colors ─────────────────────────────────────────────────────────────────
const STATUS_FILL = {
  CRITICAL: '#ef4444',
  WARNING:  '#f59e0b',
  OK:       '#10b981',
};

const SEVERITY_COLORS = {
  CRITICAL: '#ef4444',
  MEDIUM:   '#f97316',
  LOW:      '#eab308',
};

// Network layer → marker border color + icon
const LAYER_STYLE = {
  RAN:       { color: '#22d3ee', label: '📡 RAN',       desc: 'Radio Access Network' },
  CORE:      { color: '#a855f7', label: '🖥 CORE',      desc: 'Core Network (AMF/SMF/UPF)' },
  TRANSPORT: { color: '#f59e0b', label: '🔀 TRANSPORT', desc: 'Backhaul / Transport' },
};

// ── Tile Layers ────────────────────────────────────────────────────────────
const TILE_LAYERS = {
  dark: {
    label:       '🌑 Dark',
    url:         'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>',
    maxZoom:     19,
    subdomains:  'abcd',
  },
  light: {
    label:       '☀️ Light',
    url:         'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom:     19,
    subdomains:  'abcd',
  },
  satellite: {
    label:       '🛰 Satellite',
    url:         'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USGS, NGA',
    maxZoom:     18,
    subdomains:  '',
  },
  terrain: {
    label:       '🏔 Terrain',
    url:         'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap &copy; OpenTopoMap',
    maxZoom:     17,
    subdomains:  'abc',
  },
  streets: {
    label:       '🗺 Streets',
    url:         'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom:     19,
    subdomains:  'abc',
  },
};

export default function SiteMap({ sites = [], onSiteClick }) {
  const containerRef   = useRef(null);
  const mapRef         = useRef(null);  // Leaflet map instance
  const leafletRef     = useRef(null);  // Leaflet library (L)
  const tileLayerRef   = useRef(null);  // Current tile layer
  const markersRef     = useRef([]);    // All circle markers
  const [activeLayer, setActiveLayer] = useState('dark');

  // ── Initialize map ONCE ────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (mapRef.current) return; // Already initialized

    import('leaflet').then((module) => {
      if (mapRef.current) return; // Double-check (StrictMode)

      const L = module.default;
      leafletRef.current = L;

      // Fix default icon paths in Next.js
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current, {
        center:       [20.5937, 78.9629],
        zoom:         5,
        zoomControl:  true,
        preferCanvas: true,  // Better performance for many markers
      });

      // Add default tile layer
      const cfg = TILE_LAYERS.dark;
      tileLayerRef.current = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom:     cfg.maxZoom,
        ...(cfg.subdomains && { subdomains: cfg.subdomains }),
      }).addTo(map);

      mapRef.current = map;

      // CRITICAL: give the browser time to fully paint the container before measuring
      // requestAnimationFrame is too fast — tiles appear black when container hasn't been laid out
      setTimeout(() => {
        if (mapRef.current) {
          map.invalidateSize({ animate: false });
          renderMarkers(L, map);
        }
      }, 400);

      // Second invalidation as fallback (handles slow renders)
      setTimeout(() => {
        if (mapRef.current) map.invalidateSize({ animate: false });
      }, 1200);

      // Also re-measure on window resize
      const onResize = () => { if (mapRef.current) mapRef.current.invalidateSize({ animate: false }); };
      window.addEventListener('resize', onResize);
      // Store cleanup ref
      mapRef._resizeCleanup = onResize;
    });

    return () => {
      if (mapRef.current) {
        if (mapRef._resizeCleanup) window.removeEventListener('resize', mapRef._resizeCleanup);
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-render markers when sites change ───────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !leafletRef.current) return;
    renderMarkers(leafletRef.current, mapRef.current);
  }, [sites]);

  // ── Switch tile layer (no async re-import needed — L stored in ref) ───────
  const switchTileLayer = useCallback((layerKey) => {
    if (!mapRef.current || !leafletRef.current) return;
    const L   = leafletRef.current;
    const map = mapRef.current;
    const cfg = TILE_LAYERS[layerKey];
    if (!cfg) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    tileLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom:     cfg.maxZoom,
      ...(cfg.subdomains && { subdomains: cfg.subdomains }),
    }).addTo(map);

    setActiveLayer(layerKey);
  }, []);

  // ── Render markers ─────────────────────────────────────────────────────────
  function renderMarkers(L, map) {
    // Remove existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    sites.forEach((site) => {
      const fillColor  = STATUS_FILL[site.status]       || '#10b981';
      const layerStyle = LAYER_STYLE[site.networkLayer] || LAYER_STYLE.TRANSPORT;
      const sevColor   = SEVERITY_COLORS[site.topSeverity] || fillColor;

      // Marker size = status-based
      const radius = site.status === 'CRITICAL' ? 13 : site.status === 'WARNING' ? 10 : 8;

      const marker = L.circleMarker([site.lat, site.lng], {
        radius,
        fillColor,
        fillOpacity: 0.85,
        color:       layerStyle.color,  // Border = network layer color
        weight:      2.5,
        opacity:     1,
      });

      const popup = buildPopup(site, fillColor, sevColor, layerStyle);
      marker.bindPopup(popup, { maxWidth: 280 });
      marker.on('click', () => onSiteClick && onSiteClick(site));
      marker.addTo(map);
      markersRef.current.push(marker);
    });
  }

  function buildPopup(site, fillColor, sevColor, layerStyle) {
    return `
      <div style="font-family: Inter, sans-serif; min-width: 220px; padding: 2px 4px;">
        <div style="font-weight: 700; font-size: 14px; color: #e2e8f0; margin-bottom: 4px;">${site.name}</div>
        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">📍 ${site.region} Region</div>

        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
          <span style="background:${fillColor}22;color:${fillColor};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid ${fillColor}55;">${site.status}</span>
          <span style="background:${layerStyle.color}22;color:${layerStyle.color};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid ${layerStyle.color}55;">${site.networkLayer || 'TRANSPORT'}</span>
        </div>

        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">
          ${layerStyle.desc}
        </div>

        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 10px;">
          🔔 <strong style="color:#e2e8f0;">${site.alarmCount || 0}</strong> active alarms
          ${site.topSeverity ? `&nbsp;·&nbsp;<span style="color:${sevColor};font-weight:600;">${site.topSeverity}</span>` : ''}
        </div>

        <a href="/alarms?siteId=${site.id}" style="display:block;text-align:center;background:#6378ff22;color:#818cf8;padding:6px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:500;border:1px solid #6378ff44;">
          View Alarms →
        </a>
      </div>
    `;
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* ── Tile Layer Switcher ── */}
      <div style={{
        position:     'absolute',
        top:          '0.75rem',
        right:        '0.75rem',
        zIndex:       1000,
        background:   'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        padding:      '0.4rem',
        border:       '1px solid var(--border-color)',
        display:      'flex',
        gap:          '2px',
        flexWrap:     'wrap',
        maxWidth:     240,
      }}>
        {Object.entries(TILE_LAYERS).map(([key, cfg]) => (
          <button
            key={key}
            className={`tile-btn ${activeLayer === key ? 'active' : ''}`}
            onClick={() => switchTileLayer(key)}
            id={`tile-layer-${key}`}
            title={cfg.label}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* ── Layer Legend ── */}
      <div style={{
        position:     'absolute',
        bottom:       '1rem',
        left:         '0.75rem',
        zIndex:       1000,
        background:   'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        padding:      '0.5rem 0.75rem',
        border:       '1px solid var(--border-color)',
        fontSize:     '0.72rem',
      }}>
        <div style={{ fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
          Network Layer
        </div>
        {Object.entries(LAYER_STYLE).map(([key, s]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: s.color }} />
            <span style={{ color: s.color, fontWeight: 600 }}>{key}</span>
            <span style={{ color: 'var(--text-muted)' }}>= {s.desc.split(' (')[0]}</span>
          </div>
        ))}
      </div>

      {/* ── Map Container ── */}
      <div
        ref={containerRef}
        style={{
          height:       '600px',
          width:        '100%',
          borderRadius: 'var(--radius-lg)',
          background:   '#0a0e1a',
        }}
      />
    </div>
  );
}
