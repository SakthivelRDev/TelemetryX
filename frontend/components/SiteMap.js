'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';

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
  RAN:       { color: '#22d3ee', label: '📡 RAN',       desc: 'Radio Access Network' },
  CORE:      { color: '#a855f7', label: '🖥 CORE',      desc: 'Core Network (AMF/SMF/UPF)' },
  TRANSPORT: { color: '#f59e0b', label: '🔀 TRANSPORT', desc: 'Backhaul / Transport' },
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
    subdomains: '',
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

function distKm(a, b) {
  const dLat = (b.lat - a.lat) * 111;
  const dLng = (b.lng - a.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function nearestSite(from, candidates) {
  if (!candidates.length) return null;
  return candidates.reduce((best, s) => (distKm(from, s) < distKm(from, best) ? s : best));
}

export default function SiteMap({ sites = [], onSiteClick }) {
  const containerRef    = useRef(null);
  const mapRef          = useRef(null);
  const leafletRef      = useRef(null);
  const tileLayerRef    = useRef(null);
  const markersRef      = useRef([]);
  const linksLayerRef   = useRef(null);
  const sitesRef        = useRef(sites);
  const mapReadyRef     = useRef(false);
  const didFitBoundsRef = useRef(false);
  const [activeLayer, setActiveLayer] = useState('dark');

  sitesRef.current = sites;

  const renderMapContent = useCallback((L, map) => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (linksLayerRef.current) {
      map.removeLayer(linksLayerRef.current);
      linksLayerRef.current = null;
    }

    const siteList = sitesRef.current;
    if (!siteList.length) return;

    const linkGroup = L.layerGroup();

    const regions = [...new Set(siteList.map((s) => s.region))];
    for (const region of regions) {
      const inRegion   = siteList.filter((s) => s.region === region);
      const rans       = inRegion.filter((s) => s.networkLayer === 'RAN');
      const cores      = inRegion.filter((s) => s.networkLayer === 'CORE');
      const transports = inRegion.filter((s) => s.networkLayer === 'TRANSPORT');

      cores.forEach((core) => {
        if (!core.lat || !core.lng) return; // guard invalid coords
        rans.forEach((ran) => {
          if (!ran.lat || !ran.lng) return;
          L.polyline(
            [[ran.lat, ran.lng], [core.lat, core.lng]],
            { color: LAYER_STYLE.RAN.color, weight: 2, opacity: 0.55, dashArray: '6 4' }
          ).addTo(linkGroup);
        });

        const transport = nearestSite(core, transports.filter((t) => t.lat && t.lng));
        if (transport) {
          L.polyline(
            [[core.lat, core.lng], [transport.lat, transport.lng]],
            { color: LAYER_STYLE.TRANSPORT.color, weight: 2.5, opacity: 0.65, dashArray: '2 6' }
          ).addTo(linkGroup);
        }
      });

      if (cores.length === 0 && rans.length && transports.length) {
        const validRans = rans.filter((r) => r.lat && r.lng);
        const validTransports = transports.filter((t) => t.lat && t.lng);
        if (validRans.length && validTransports.length) {
          const hub = nearestSite(validRans[0], validTransports);
          if (hub) {
            validRans.forEach((ran) => {
              L.polyline(
                [[ran.lat, ran.lng], [hub.lat, hub.lng]],
                { color: '#94a3b8', weight: 1.5, opacity: 0.4, dashArray: '4 4' }
              ).addTo(linkGroup);
            });
          }
        }
      }
    }

    linkGroup.addTo(map);
    linksLayerRef.current = linkGroup;

    siteList.forEach((site) => {
      if (!site.lat || !site.lng) return; // skip sites with missing coords
      const layerStyle  = LAYER_STYLE[site.networkLayer] || LAYER_STYLE.TRANSPORT;
      const borderColor = STATUS_BORDER[site.status] || STATUS_BORDER.OK;
      const sevColor    = SEVERITY_COLORS[site.topSeverity] || borderColor;
      const radius      = site.status === 'CRITICAL' ? 12 : site.status === 'WARNING' ? 10 : 9;

      const marker = L.circleMarker([site.lat, site.lng], {
        radius,
        fillColor:   layerStyle.color,
        fillOpacity: site.status === 'OK' ? 0.82 : 0.92,
        color:       borderColor,
        weight:      site.status === 'CRITICAL' ? 3.5 : 2.5,
        opacity:     1,
      });

      marker.bindPopup(buildPopup(site, borderColor, sevColor, layerStyle), { maxWidth: 280 });
      marker.on('click', () => onSiteClick && onSiteClick(site));
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    if (!didFitBoundsRef.current && markersRef.current.length > 0) {
      try {
        const group = L.featureGroup(markersRef.current);
        const bounds = group.getBounds();
        if (bounds && bounds.isValid()) {
          map.fitBounds(bounds.pad(0.12), { maxZoom: 7, animate: false });
          didFitBoundsRef.current = true;
        }
      } catch (e) {
        console.warn('[SiteMap] fitBounds skipped:', e.message);
      }
    }
  }, [onSiteClick]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (mapRef.current) return;

    import('leaflet').then((module) => {
      if (mapRef.current) return;

      const L = module.default;
      leafletRef.current = L;

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current, {
        center: [20.5937, 78.9629],
        zoom: 5,
        zoomControl: true,
        preferCanvas: true,
        attributionControl: true,
      });

      const cfg = TILE_LAYERS.dark;
      tileLayerRef.current = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: cfg.maxZoom,
        ...(cfg.subdomains && { subdomains: cfg.subdomains }),
        crossOrigin: true,
      }).addTo(map);

      mapRef.current = map;
      mapReadyRef.current = true;

      // Invalidate size after mount paint, then paint markers once Leaflet is ready
      setTimeout(() => {
        map.invalidateSize({ animate: false });
        renderMapContent(L, map); // paint any sites already loaded by the time Leaflet init finishes
      }, 150);

      const onResize = () => map.invalidateSize({ animate: false });
      window.addEventListener('resize', onResize);
      mapRef._resizeCleanup = onResize;
    });

    return () => {
      if (mapRef.current) {
        if (mapRef._resizeCleanup) window.removeEventListener('resize', mapRef._resizeCleanup);
        mapRef.current.remove();
        mapRef.current = null;
        mapReadyRef.current = false;
        didFitBoundsRef.current = false;
      }
    };
  }, []); // run once — no renderMapContent dependency needed here

  useEffect(() => {
    if (!mapRef.current || !leafletRef.current || !mapReadyRef.current) return;
    renderMapContent(leafletRef.current, mapRef.current);
  }, [sites, renderMapContent]);

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
      maxZoom: cfg.maxZoom,
      ...(cfg.subdomains && { subdomains: cfg.subdomains }),
      crossOrigin: true,
    }).addTo(map);

    setTimeout(() => map.invalidateSize({ animate: false }), 100);
    setActiveLayer(layerKey);
  }, []);

  function buildPopup(site, borderColor, sevColor, layerStyle) {
    return `
      <div style="font-family: Inter, sans-serif; min-width: 220px; padding: 2px 4px;">
        <div style="font-weight: 700; font-size: 14px; color: #e2e8f0; margin-bottom: 4px;">${site.name}</div>
        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">📍 ${site.region} Region</div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
          <span style="background:${borderColor}22;color:${borderColor};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid ${borderColor}55;">${site.status}</span>
          <span style="background:${layerStyle.color}22;color:${layerStyle.color};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid ${layerStyle.color}55;">${site.networkLayer || 'TRANSPORT'}</span>
        </div>
        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">${layerStyle.desc}</div>
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
      <div style={{
        position: 'absolute', top: '0.75rem', right: '0.75rem', zIndex: 1000,
        background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '0.4rem',
        border: '1px solid var(--border-color)', display: 'flex', gap: '2px', flexWrap: 'wrap', maxWidth: 240,
      }}>
        {Object.entries(TILE_LAYERS).map(([key, cfg]) => (
          <button key={key} className={`tile-btn ${activeLayer === key ? 'active' : ''}`} onClick={() => switchTileLayer(key)} id={`tile-layer-${key}`} title={cfg.label}>
            {cfg.label}
          </button>
        ))}
      </div>

      <div style={{
        position: 'absolute', bottom: '1rem', left: '0.75rem', zIndex: 1000,
        background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.75rem',
        border: '1px solid var(--border-color)', fontSize: '0.72rem',
      }}>
        <div style={{ fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
          Map Legend
        </div>
        <div style={{ marginBottom: '0.35rem', color: 'var(--text-muted)', fontSize: '0.68rem' }}>Fill = network layer · Border = site status</div>
        {Object.entries(LAYER_STYLE).map(([key, s]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: s.color, border: '2px solid #10b981' }} />
            <span style={{ color: s.color, fontWeight: 600 }}>{key}</span>
          </div>
        ))}
        <div style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid var(--border-color)' }}>
          {Object.entries(STATUS_BORDER).map(([st, c]) => (
            <div key={st} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${c}`, background: 'transparent' }} />
              <span style={{ color: c, fontSize: '0.68rem' }}>{st}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '0.3rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>Dashed lines = RAN→CORE→TRANSPORT</div>
      </div>

      <div ref={containerRef} className="leaflet-map-host" style={{ height: '600px', width: '100%', borderRadius: 'var(--radius-lg)', background: '#0a0e1a' }} />
    </div>
  );
}
