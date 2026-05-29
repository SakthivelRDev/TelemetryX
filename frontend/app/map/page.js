'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import RoleGuard from '../../components/RoleGuard';
import AppLayout from '../../components/AppLayout';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { detectUserRegion } from '../../lib/geoRegion';
import {
  Map as MapIcon, Radio, Server, Network, RefreshCw, X, MapPin,
  BarChart2, AlertTriangle, CheckCircle, XCircle, ChevronRight, BellRing,
} from 'lucide-react';

// Client-only map (Leaflet needs window)
const SiteMap = dynamic(
  () => import(/* webpackChunkName: "site-map" */ '../../components/MapView'),
  {
    ssr: false,
    loading: () => (
      <div className="loading-state" style={{ height: 600 }}>
        <div className="spinner" />
      </div>
    ),
  }
);

const REGIONS        = ['', 'North', 'South', 'East', 'West'];
const STATUSES       = ['', 'CRITICAL', 'WARNING', 'OK'];
const NETWORK_LAYERS = ['', 'RAN', 'CORE', 'TRANSPORT'];

const LAYER_META = {
  RAN:       { Icon: Radio,   color: '#22d3ee', desc: 'Radio Access Network – gNodeB, eNodeB, CU, DU, RRU' },
  CORE:      { Icon: Server,  color: '#a855f7', desc: 'Core Network – AMF, SMF, UPF, MME, SGW, PCF' },
  TRANSPORT: { Icon: Network, color: '#f59e0b', desc: 'Backhaul/Transport – Routers, Switches, OTN, Microwave' },
};

const STATUS_COLORS   = { CRITICAL: '#ef4444', WARNING: '#f59e0b', OK: '#10b981' };
const SEV_COLORS      = { CRITICAL: '#ef4444', MEDIUM: '#f97316', LOW: '#eab308' };
const RULE_LABEL      = {
  RULE_1_SAME_SITE_DEVICE:   '📍 Rule 1',
  RULE_2_SITE_WIDE_CRITICAL: '🏢 Rule 2',
  RULE_3_STANDALONE:         '⚡ Rule 3',
};

// ── Floating Alarms Modal ────────────────────────────────────────────────────
function AlarmsModal({ site, alarms, loading, onClose, onRefresh }) {
  if (!site) return null;
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
        }}
      />
      {/* Modal card */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 2001,
        transform: 'translate(-50%, -50%)',
        width: 'min(92vw, 860px)', maxHeight: '80vh',
        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>🔔 Open Alarms — {site.name}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              📍 {site.region} Region &nbsp;·&nbsp;
              <span className={`badge badge-${site.networkLayer?.toLowerCase()}`} style={{ fontSize: '0.7rem', padding: '1px 6px' }}>{site.networkLayer}</span>
              &nbsp;·&nbsp;
              <span className={`badge badge-${site.status?.toLowerCase()}`} style={{ fontSize: '0.7rem', padding: '1px 6px' }}>{site.status}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {onRefresh && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={onRefresh}
                disabled={loading}
                title="Refresh alarms list"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                id="modal-refresh-alarms"
              >
                <RefreshCw size={12} className={loading ? 'spin-continuous' : ''} />
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>
            )}
            <a
              href={`/alarms?siteId=${site.id}`}
              className="btn btn-secondary btn-sm"
              id={`modal-open-alarms-${site.id}`}
            >
              ↗ Open in Alarms Page
            </a>
            <button className="btn btn-secondary btn-sm" onClick={onClose} id="close-alarms-modal">✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div className="loading-state" style={{ height: 160 }}><div className="spinner" /></div>
          ) : !alarms || alarms.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem' }}>
              <div className="empty-state-icon">✅</div>
              <div>No open alarms for this site</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Layer</th>
                    <th>Device / Group</th>
                    <th>Rule</th>
                    <th>Alarms</th>
                    <th>Start</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {alarms.map((ev) => (
                    <tr key={ev.id}>
                      <td><span className={`badge badge-${ev.severity?.toLowerCase()}`}>{ev.severity}</span></td>
                      <td>
                        {ev.networkLayer
                          ? <span className={`badge badge-${ev.networkLayer?.toLowerCase()}`}>{ev.networkLayer}</span>
                          : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>
                        <div style={{ fontWeight: 500 }}>{ev.deviceId}</div>
                        <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {ev.groupKey?.slice(0, 36)}…
                        </div>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {RULE_LABEL[ev.correlationRule] || ev.correlationRule}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{ev.alarmIds?.length || 0}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {new Date(ev.startTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td>
                        <a href={`/alarms/${ev.id}`} className="btn btn-secondary btn-sm" id={`modal-alarm-${ev.id}`}>
                          Details →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Recharts tooltip ─────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-color)',
      borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.8rem',
    }}>
      {label && <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>}
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color || p.fill }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MapPage() {
  const { user, canAccess }         = useAuth();
  const [sites, setSites]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [lastFetched, setLastFetched] = useState(null);
  const [region, setRegion]         = useState('');
  const [status, setStatus]         = useState('');
  const [networkLayer, setNetworkLayer] = useState('');
  const [searchTerm, setSearchTerm]  = useState('');
  const [selected, setSelected]     = useState(null);
  // Geo-region auto-filter state
  const [geoRegion, setGeoRegion]         = useState(null);   // detected region name
  const [geoBannerOpen, setGeoBannerOpen] = useState(true);   // banner visibility
  const [geoLoading, setGeoLoading]       = useState(false);
  const [isGeoFallback, setIsGeoFallback] = useState(false);  // geolocation denied fallback state

  // Alarms modal state
  const [modalSite, setModalSite]       = useState(null);
  const [modalAlarms, setModalAlarms]   = useState(null);
  const [alarmsLoading, setAlarmsLoading] = useState(false);

  const fetchSites = useCallback(async () => {
    if (initialLoad) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (region)       params.set('region',       region);
      if (status)       params.set('status',       status);
      if (networkLayer) params.set('networkLayer', networkLayer);
      const res = await api.get(`/api/map/sites?${params}`);
      setSites(res.data.sites || []);
      setLastFetched(new Date());
    } catch (err) {
      console.error('Map fetch error:', err);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [region, status, networkLayer]);

  // Manual refresh with spin animation (minimum 800ms spin feedback)
  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (region)       params.set('region',       region);
      if (status)       params.set('status',       status);
      if (networkLayer) params.set('networkLayer', networkLayer);

      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const promises = [
        api.get(`/api/map/sites?${params}`),
        delay(800)
      ];

      // If alarms modal is open, also refresh its alarms in parallel
      if (modalSite) {
        promises.push(api.get(`/api/alarms/correlated?siteId=${modalSite.id}&limit=20&status=OPEN`));
      }

      const results = await Promise.all(promises);
      const sitesRes = results[0];
      setSites(sitesRes.data.sites || []);
      setLastFetched(new Date());

      if (modalSite && results[2]) {
        setModalAlarms(results[2].data.events || []);
      }
    } catch (err) {
      console.error('Map refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [region, status, networkLayer, modalSite]);

  const openAlarmsModal = useCallback(async (site) => {
    setModalSite(site);
    setModalAlarms([]);
    setAlarmsLoading(true);
    try {
      const res = await api.get(`/api/alarms/correlated?siteId=${site.id}&limit=20&status=OPEN`);
      setModalAlarms(res.data.events || []);
    } catch (err) {
      console.error('Site alarms fetch error:', err);
      setModalAlarms([]);
    } finally {
      setAlarmsLoading(false);
    }
  }, []);

  const refreshModalAlarms = useCallback(async () => {
    if (!modalSite) return;
    setAlarmsLoading(true);
    try {
      const res = await api.get(`/api/alarms/correlated?siteId=${modalSite.id}&limit=20&status=OPEN`);
      setModalAlarms(res.data.events || []);
    } catch (err) {
      console.error('Site alarms refresh error:', err);
    } finally {
      setAlarmsLoading(false);
    }
  }, [modalSite]);

  useEffect(() => { fetchSites(); }, [fetchSites]);
  useEffect(() => {
    const timer = setInterval(fetchSites, 15000);
    return () => clearInterval(timer);
  }, [fetchSites]);

  // ── Geo-region auto-filter (Engineer / Viewer with Region View permission) ──
  const isRegionViewEnabled = canAccess('MAP', 'canWrite');
  const isNonAdmin          = user?.role === 'ENGINEER' || user?.role === 'VIEWER';

  useEffect(() => {
    if (!isNonAdmin || !isRegionViewEnabled) return;
    setGeoLoading(true);
    detectUserRegion().then((result) => {
      if (result?.region) {
        setGeoRegion(result.region);
        setRegion(result.region);   // pre-fill the filter dropdown
        setIsGeoFallback(false);
      } else {
        setGeoRegion('South');
        setRegion('South');         // fallback to South region
        setIsGeoFallback(true);
      }
      setGeoBannerOpen(true);
      setGeoLoading(false);
    });
  // Run only once when role/permission are known
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNonAdmin, isRegionViewEnabled]);

  // ── Derived chart data ────────────────────────────────────────────────────
  const displayedSites = sites.filter((site) => {
    if (!searchTerm) return true;
    const query = searchTerm.toLowerCase();
    return (
      site.name.toLowerCase().includes(query) ||
      site.region.toLowerCase().includes(query)
    );
  });

  const statusCounts = {
    CRITICAL: displayedSites.filter((s) => s.status === 'CRITICAL').length,
    WARNING:  displayedSites.filter((s) => s.status === 'WARNING').length,
    OK:       displayedSites.filter((s) => s.status === 'OK').length,
  };

  const layerCounts = {
    RAN:       displayedSites.filter((s) => s.networkLayer === 'RAN').length,
    CORE:      displayedSites.filter((s) => s.networkLayer === 'CORE').length,
    TRANSPORT: displayedSites.filter((s) => s.networkLayer === 'TRANSPORT').length,
  };

  const statusPieData = Object.entries(statusCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const layerAlarmData = ['RAN', 'CORE', 'TRANSPORT'].map((layer) => ({
    layer,
    alarms: displayedSites.filter((s) => s.networkLayer === layer).reduce((sum, s) => sum + (s.alarmCount || 0), 0),
    sites:  displayedSites.filter((s) => s.networkLayer === layer).length,
  }));

  const sevData = [
    { name: 'CRITICAL', value: displayedSites.filter((s) => s.topSeverity === 'CRITICAL').length, color: '#ef4444' },
    { name: 'MEDIUM',   value: displayedSites.filter((s) => s.topSeverity === 'MEDIUM').length,   color: '#f97316' },
    { name: 'LOW',      value: displayedSites.filter((s) => s.topSeverity === 'LOW').length,      color: '#eab308' },
    { name: 'OK',       value: displayedSites.filter((s) => !s.topSeverity || s.topSeverity === 'OK').length, color: '#10b981' },
  ].filter((d) => d.value > 0);

  const topSites = [...displayedSites]
    .sort((a, b) => (b.alarmCount || 0) - (a.alarmCount || 0))
    .slice(0, 8);

  useEffect(() => {
    if (!selected) return;
    const updated = displayedSites.find((s) => s.id === selected.id);
    if (!updated) {
      setSelected(null);
    } else {
      // Sync basic details from updated site object to avoid showing stale data in sidebar
      if (
        updated.status !== selected.status ||
        updated.alarmCount !== selected.alarmCount ||
        updated.topSeverity !== selected.topSeverity
      ) {
        setSelected(updated);
      }
    }
  }, [displayedSites, selected]);

  return (
    <AppLayout>
      <RoleGuard module="MAP" redirect>
      <div className="fade-in">

        {/* ── Geo-Region Banner ── */}
        {geoRegion && geoBannerOpen && isRegionViewEnabled && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(99,120,255,0.12), rgba(34,211,238,0.10))',
            border: '1px solid rgba(99,120,255,0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '0.6rem 1rem',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            color: 'var(--text-primary)',
          }}>
            <span>
              <span style={{ marginRight: 6 }}><MapPin size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /></span>
              <strong>Region View active</strong>
              {' '}— showing sites in the{' '}
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{geoRegion}</span>
              {' '}{isGeoFallback ? 'region (location permission denied/unavailable)' : 'region based on your current location'}.
              <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                (Locked to this region)
              </span>
            </span>
            <button
              id="geo-banner-dismiss"
              onClick={() => setGeoBannerOpen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1,
                padding: '0 4px', marginLeft: 12,
              }}
              title="Dismiss"
            >✕</button>
          </div>
        )}

        {/* ── Geo-loading indicator ── */}
        {geoLoading && (
          <div style={{
            fontSize: '0.8rem', color: 'var(--text-muted)',
            marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
            Detecting your region…
          </div>
        )}

        <div className="page-header">
          <div className="flex-between">
            <div>
              <h1 className="page-title">
                <span className="page-title-icon"><MapIcon size={22} /></span>
                Network Map
              </h1>
              <p className="page-subtitle">
                Live API data · auto-refresh 15s
                {lastFetched && (
                  <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    · updated {lastFetched.toLocaleTimeString('en-IN')}
                  </span>
                )}
                &nbsp;<span className="pulse-dot" />
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge badge-critical">🔴 Critical: {statusCounts.CRITICAL}</span>
              <span className="badge badge-warning">🟡 Warning: {statusCounts.WARNING}</span>
              <span className="badge badge-ok">🟢 OK: {statusCounts.OK}</span>
            </div>
          </div>
        </div>

        {/* Layer Info Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {Object.entries(LAYER_META).map(([key, meta]) => (
            <div key={key} className="card" style={{ padding: '1rem', borderColor: `${meta.color}33`, cursor: 'pointer', borderWidth: networkLayer === key ? 2 : 1 }} onClick={() => setNetworkLayer(networkLayer === key ? '' : key)} id={`layer-filter-${key.toLowerCase()}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span style={{ color: meta.color, display: 'flex', alignItems: 'center' }}><meta.Icon size={18} strokeWidth={2} /></span>
                <span style={{ fontWeight: 700, color: meta.color, fontSize: '0.9rem' }}>{key}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: '1.2rem', color: meta.color }}>{layerCounts[key]}</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{meta.desc}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="filters-bar">
          <input
            type="text"
            placeholder="🔍 Search by site name or region..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              padding: '0.6rem 0.9rem',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
            }}
            id="map-search"
          />
          <select
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              // If user manually clears back to all-regions, also clear geo marker
              if (!e.target.value) setGeoRegion(null);
            }}
            id="map-filter-region"
            disabled={isNonAdmin && isRegionViewEnabled}
            style={geoRegion && region === geoRegion ? { borderColor: 'var(--accent-cyan)', boxShadow: '0 0 0 2px rgba(34,211,238,0.2)', opacity: isNonAdmin && isRegionViewEnabled ? 0.8 : 1 } : {}}
          >
            {REGIONS.map((r) => <option key={r} value={r}>{r || 'All Regions'}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} id="map-filter-status">
            {STATUSES.map((s) => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
          </select>
          <select value={networkLayer} onChange={(e) => setNetworkLayer(e.target.value)} id="map-filter-layer">
            {NETWORK_LAYERS.map((l) => <option key={l} value={l}>{l || 'All Layers'}</option>)}
          </select>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleManualRefresh}
            disabled={refreshing}
            id="map-refresh"
            title="Refresh map data"
          >
            <RefreshCw size={13} className={refreshing ? 'spin-continuous' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          {networkLayer && (
            <button className="btn btn-danger btn-sm" onClick={() => setNetworkLayer('')}><X size={12} /> Clear Layer Filter</button>
          )}
        </div>

        {/* Map + Site Detail */}
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 300px' : '1fr', gap: '1.25rem' }}>
          {/* Map */}
          <div className="card" style={{ padding: 0, position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {loading && initialLoad && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 900,
                background: 'rgba(10,14,26,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 'var(--radius-lg)',
              }}>
                <div className="spinner" />
              </div>
            )}
            <SiteMap 
              sites={displayedSites} 
              onSiteClick={(site) => setSelected(site)} 
            />
          </div>

          {/* Site Detail Panel */}
          {selected && (
            <div className="card fade-in" style={{ position: 'sticky', top: '2rem', height: 'fit-content' }}>
              <div className="card-header">
                <span className="card-title">Site Details</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)} id="close-site-panel">✕</button>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>{selected.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>📍 {selected.region} Region</div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <span className={`badge badge-${selected.status?.toLowerCase()}`}>{selected.status}</span>
                {selected.networkLayer && (
                  <span className={`badge badge-${selected.networkLayer?.toLowerCase()}`}>{selected.networkLayer}</span>
                )}
              </div>

              {selected.networkLayer && LAYER_META[selected.networkLayer] && (
                <div className="info-banner" style={{ marginBottom: '0.75rem', fontSize: '0.75rem' }}>
                  <strong>
                    {(() => { const Meta = LAYER_META[selected.networkLayer]; return <Meta.Icon size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />; })()} {selected.networkLayer}:
                  </strong><br />
                  {LAYER_META[selected.networkLayer].desc}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Alarms</div>
                  <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{selected.alarmCount || 0}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lat / Lng</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{selected.lat?.toFixed(3)}, {selected.lng?.toFixed(3)}</div>
                </div>
              </div>

              {/* VIEW ALARMS MODAL BUTTON */}
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                id={`map-view-alarms-${selected.id}`}
                onClick={() => openAlarmsModal(selected)}
              >
                <BellRing size={15} /> View Alarms
              </button>
              <a
                href={`/alarms?siteId=${selected.id}`}
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
                id={`map-open-alarms-page-${selected.id}`}
              >
                <ChevronRight size={14} /> Open in Alarms Page
              </a>
            </div>
          )}
        </div>

        {/* ── Analytics Charts ─────────────────────────────────────────────── */}
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            📊 Network Analytics
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>

            {/* Chart 1: Site Status Pie */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Site Status Distribution</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{displayedSites.length} sites</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart margin={{ top: 18, right: 44, bottom: 18, left: 44 }}>
                  <Pie
                    data={statusPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={62}
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {statusPieData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#6378ff'} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 2: Alarms by Layer */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Alarms by Network Layer</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>active alarms</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={layerAlarmData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="layer" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="alarms" name="Alarms" radius={[4, 4, 0, 0]}>
                    {layerAlarmData.map((entry) => (
                      <Cell key={entry.layer} fill={LAYER_META[entry.layer]?.color || '#6378ff'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 3: Severity distribution across sites */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Sites by Top Severity</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>top alarm per site</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart margin={{ top: 18, right: 28, bottom: 16, left: 28 }}>
                  <Pie
                    data={sevData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={68}
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {sevData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 4: Top 8 sites by alarm count */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Top Sites by Alarm Count</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>top 8</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topSites} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={105} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="alarmCount" name="Alarms" radius={[0, 4, 4, 0]}>
                    {topSites.map((site) => (
                      <Cell key={site.id} fill={STATUS_COLORS[site.status] || '#6378ff'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

          </div>
        </div>

        {/* Sites Table */}
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <div className="card-header">
            <span className="card-title">Site Inventory ({displayedSites.length})</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {Object.entries(layerCounts).map(([k, v]) => (
                <span key={k} className={`badge badge-${k.toLowerCase()}`}>{k}: {v}</span>
              ))}
            </div>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Layer</th>
                  <th>Region</th>
                  <th>Status</th>
                  <th>Top Severity</th>
                  <th>Alarms</th>
                  <th>Coordinates</th>
                </tr>
              </thead>
              <tbody>
                {displayedSites.map((site) => (
                  <tr key={site.id} onClick={() => setSelected(site)} id={`site-row-${site.id}`} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 500 }}>{site.name}</td>
                    <td>
                      <span className={`badge badge-${site.networkLayer?.toLowerCase()}`}>
                        {site.networkLayer || 'TRANSPORT'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{site.region}</td>
                    <td><span className={`badge badge-${site.status?.toLowerCase()}`}>{site.status}</span></td>
                    <td>
                      {site.topSeverity ? (
                        <span className={`badge badge-${site.topSeverity?.toLowerCase()}`}>{site.topSeverity}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{site.alarmCount || 0}</td>
                    <td className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {site.lat?.toFixed(4)}, {site.lng?.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </RoleGuard>

      {/* ── Alarms Modal (outside RoleGuard layout, positioned fixed) ── */}
      {modalSite && (
        <AlarmsModal
          site={modalSite}
          alarms={modalAlarms}
          loading={alarmsLoading}
          onClose={() => { setModalSite(null); setModalAlarms(null); }}
          onRefresh={refreshModalAlarms}
        />
      )}
    </AppLayout>
  );
}
