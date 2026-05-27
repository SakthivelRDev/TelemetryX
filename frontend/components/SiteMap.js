'use client';
import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useTheme } from '../context/ThemeContext';
import { buildTopologyLinks } from '../lib/networkTopology';
import { saveMapStyle } from '../lib/mapTheme';

const STATUS_BORDER = {
  CRITICAL: '#ef4444',
  WARNING:  '#f59e0b',
  OK:       '#10b981',
};

const SEVERITY_COLORS = {
  CRITICAL: '#ef4444',
  MEDIUM:   '#f97316',
  LOW:      '#eab308',
};

const LAYER_STYLE = {
  RAN:       { color: '#22d3ee', desc: 'Radio Access Network' },
  CORE:      { color: '#a855f7', desc: 'Core Network' },
  TRANSPORT: { color: '#f59e0b', desc: 'Backhaul / Transport' },
};

const TILE_LAYERS = {
  dark: {
    label: '🌑 Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19,
    subdomains: 'abcd',
  },
  light: {
    label: '☀️ Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19,
    subdomains: 'abcd',
  },
  satellite: {
    label: '🛰 Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18,
  },
  terrain: {
    label: '🏔 Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap',
    maxZoom: 17,
    subdomains: 'abc',
  },
  streets: {
    label: '🗺 Streets',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
    subdomains: 'abc',
  },
};

const INDIA_CENTER = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;

function MapResize() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize({ animate: false });
    fix();
    const t1 = setTimeout(fix, 100);
    const t2 = setTimeout(fix, 400);
    window.addEventListener('resize', fix);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', fix);
    };
  }, [map]);
  return null;
}

function FitBounds({ sites }) {
  const map = useMap();
  const points = useMemo(
    () => sites.filter((s) => s.lat != null && s.lng != null).map((s) => [s.lat, s.lng]),
    [sites]
  );

  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points);
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.12), { maxZoom: 7, animate: false });
    }
  }, [map, points]);

  return null;
}

function TopologyAndMarkers({ sites, onSiteClick }) {
  const links = useMemo(() => buildTopologyLinks(sites), [sites]);

  return (
    <>
      {links.map((link, i) => (
        <Polyline
          key={`link-${link.from.id}-${link.to.id}-${i}`}
          positions={[
            [link.from.lat, link.from.lng],
            [link.to.lat, link.to.lng],
          ]}
          pathOptions={{
            color: link.color,
            weight: link.weight,
            opacity: link.opacity,
            dashArray: link.dashArray,
          }}
        />
      ))}
      {sites.map((site) => {
        if (site.lat == null || site.lng == null) return null;
        const layerStyle = LAYER_STYLE[site.networkLayer] || LAYER_STYLE.TRANSPORT;
        const borderColor = STATUS_BORDER[site.status] || STATUS_BORDER.OK;
        const sevColor = SEVERITY_COLORS[site.topSeverity] || borderColor;
        const radius = site.status === 'CRITICAL' ? 12 : site.status === 'WARNING' ? 10 : 9;

        return (
          <CircleMarker
            key={site.id}
            center={[site.lat, site.lng]}
            radius={radius}
            pathOptions={{
              fillColor: layerStyle.color,
              fillOpacity: site.status === 'OK' ? 0.82 : 0.92,
              color: borderColor,
              weight: site.status === 'CRITICAL' ? 3.5 : 2.5,
              opacity: 1,
            }}
            eventHandlers={{
              click: () => onSiteClick?.(site),
            }}
          >
            <Popup maxWidth={280}>
              <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{site.name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
                  📍 {site.region} · {site.networkLayer || 'TRANSPORT'}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
                  🔔 <strong>{site.alarmCount || 0}</strong> alarms
                  {site.topSeverity ? (
                    <span style={{ color: sevColor, fontWeight: 600 }}> · {site.topSeverity}</span>
                  ) : null}
                </div>
                <a href={`/alarms?siteId=${site.id}`} style={{ fontSize: 12, color: '#818cf8' }}>
                  View Alarms →
                </a>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

export default function SiteMap({ sites = [], onSiteClick }) {
  const { mapStyle, setMapStyle } = useTheme();
  const tileCfg = TILE_LAYERS[mapStyle] || TILE_LAYERS.dark;

  const selectStyle = (key) => {
    if (!TILE_LAYERS[key]) return;
    saveMapStyle(key);
    setMapStyle(key);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        style={{
          position: 'absolute',
          top: '0.75rem',
          right: '0.75rem',
          zIndex: 1000,
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          padding: '0.4rem',
          border: '1px solid var(--border-color)',
          display: 'flex',
          gap: '2px',
          flexWrap: 'wrap',
          maxWidth: 260,
        }}
      >
        {Object.entries(TILE_LAYERS).map(([key, cfg]) => (
          <button
            key={key}
            type="button"
            className={`tile-btn ${mapStyle === key ? 'active' : ''}`}
            onClick={() => selectStyle(key)}
            id={`tile-layer-${key}`}
            title={cfg.label}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '1rem',
          left: '0.75rem',
          zIndex: 1000,
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          padding: '0.5rem 0.75rem',
          border: '1px solid var(--border-color)',
          fontSize: '0.72rem',
          maxWidth: 220,
        }}
      >
        <div style={{ fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
          Topology
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Fill = layer · Border = status</div>
        <div style={{ fontSize: '0.65rem', marginBottom: '0.2rem' }}><span style={{ color: '#22d3ee' }}>━━</span> RAN → CORE</div>
        <div style={{ fontSize: '0.65rem', marginBottom: '0.2rem' }}><span style={{ color: '#f59e0b' }}>━━</span> CORE → TRANSPORT</div>
        <div style={{ fontSize: '0.65rem' }}><span style={{ color: '#64748b' }}>━━</span> Backbone mesh</div>
      </div>

      <MapContainer
        center={INDIA_CENTER}
        zoom={DEFAULT_ZOOM}
        className="leaflet-map-host"
        style={{ height: '600px', width: '100%', borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)' }}
        scrollWheelZoom
        zoomControl
      >
        <TileLayer
          key={mapStyle}
          url={tileCfg.url}
          attribution={tileCfg.attribution}
          maxZoom={tileCfg.maxZoom}
          {...(tileCfg.subdomains ? { subdomains: tileCfg.subdomains } : {})}
        />
        <MapResize />
        <FitBounds sites={sites} />
        <TopologyAndMarkers sites={sites} onSiteClick={onSiteClick} />
      </MapContainer>
    </div>
  );
}
