'use client';
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import RoleGuard from '../../components/RoleGuard';
import AppLayout from '../../components/AppLayout';
import api from '../../lib/api';

// Dynamic import to avoid SSR issues with Leaflet
const SiteMap = dynamic(() => import('../../components/SiteMap'), {
  ssr: false,
  loading: () => <div className="loading-state" style={{ height: 600 }}><div className="spinner" /></div>,
});

const REGIONS       = ['', 'North', 'South', 'East', 'West'];
const STATUSES      = ['', 'CRITICAL', 'WARNING', 'OK'];
const NETWORK_LAYERS = ['', 'RAN', 'CORE', 'TRANSPORT'];

const LAYER_META = {
  RAN:       { icon: '📡', color: '#22d3ee', desc: 'Radio Access Network – gNodeB, eNodeB, CU, DU, RRU' },
  CORE:      { icon: '🖥',  color: '#a855f7', desc: 'Core Network – AMF, SMF, UPF, MME, SGW, PCF' },
  TRANSPORT: { icon: '🔀', color: '#f59e0b', desc: 'Backhaul/Transport – Routers, Switches, OTN, Microwave' },
};

export default function MapPage() {
  const [sites, setSites]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [region, setRegion]         = useState('');
  const [status, setStatus]         = useState('');
  const [networkLayer, setNetworkLayer] = useState('');
  const [selected, setSelected]     = useState(null);
  // Inline alarms panel
  const [siteAlarms, setSiteAlarms]     = useState(null);   // null = hidden, [] = empty
  const [alarmsLoading, setAlarmsLoading] = useState(false);

  const fetchSites = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (region)       params.set('region',       region);
      if (status)       params.set('status',       status);
      if (networkLayer) params.set('networkLayer', networkLayer);
      const res = await api.get(`/api/map/sites?${params}`);
      setSites(res.data.sites || []);
    } catch (err) {
      console.error('Map fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [region, status, networkLayer]);

  const fetchSiteAlarms = useCallback(async (siteId) => {
    setAlarmsLoading(true);
    setSiteAlarms([]);
    try {
      const res = await api.get(`/api/alarms/correlated?siteId=${siteId}&limit=10&status=OPEN`);
      setSiteAlarms(res.data.events || []);
    } catch (err) {
      console.error('Site alarms fetch error:', err);
      setSiteAlarms([]);
    } finally {
      setAlarmsLoading(false);
    }
  }, []);

  useEffect(() => { fetchSites(); }, [fetchSites]);
  useEffect(() => {
    const timer = setInterval(fetchSites, 15000);
    return () => clearInterval(timer);
  }, [fetchSites]);

  const statusCounts = {
    CRITICAL: sites.filter((s) => s.status === 'CRITICAL').length,
    WARNING:  sites.filter((s) => s.status === 'WARNING').length,
    OK:       sites.filter((s) => s.status === 'OK').length,
  };

  const layerCounts = {
    RAN:       sites.filter((s) => s.networkLayer === 'RAN').length,
    CORE:      sites.filter((s) => s.networkLayer === 'CORE').length,
    TRANSPORT: sites.filter((s) => s.networkLayer === 'TRANSPORT').length,
  };

  return (
    <AppLayout>
      <RoleGuard module="MAP" redirect>
      <div className="fade-in">
        <div className="page-header">
          <div className="flex-between">
            <div>
              <h1 className="page-title">🗺 Network Map</h1>
              <p className="page-subtitle">
                Telecom site topology – India &nbsp;·&nbsp;
                <span style={{ color: 'var(--accent-cyan)' }}>📡 RAN</span> ·{' '}
                <span style={{ color: '#a855f7' }}>🖥 CORE</span> ·{' '}
                <span style={{ color: '#f59e0b' }}>🔀 TRANSPORT</span>
                &nbsp;&nbsp;<span className="pulse-dot" />
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
                <span style={{ fontSize: '1.2rem' }}>{meta.icon}</span>
                <span style={{ fontWeight: 700, color: meta.color, fontSize: '0.9rem' }}>{key}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: '1.2rem', color: meta.color }}>{layerCounts[key]}</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{meta.desc}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="filters-bar">
          <select value={region} onChange={(e) => setRegion(e.target.value)} id="map-filter-region">
            {REGIONS.map((r) => <option key={r} value={r}>{r || 'All Regions'}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} id="map-filter-status">
            {STATUSES.map((s) => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
          </select>
          <select value={networkLayer} onChange={(e) => setNetworkLayer(e.target.value)} id="map-filter-layer">
            {NETWORK_LAYERS.map((l) => <option key={l} value={l}>{l || 'All Layers'}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={fetchSites} id="map-refresh">↺ Refresh</button>
          {networkLayer && (
            <button className="btn btn-danger btn-sm" onClick={() => setNetworkLayer('')}>✕ Clear Layer Filter</button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 300px' : '1fr', gap: '1.25rem' }}>
          {/* Map — always rendered so Leaflet measures a stable container */}
          <div className="card" style={{ padding: 0, position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'clip' }}>
            {/* Loading overlay on TOP of map — never unmount SiteMap */}
            {loading && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 900,
                background: 'rgba(10,14,26,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 'var(--radius-lg)',
              }}>
                <div className="spinner" />
              </div>
            )}
            <SiteMap sites={sites} onSiteClick={(site) => { setSelected(site); setSiteAlarms(null); }} />
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
                  <strong>{LAYER_META[selected.networkLayer].icon} {selected.networkLayer}:</strong><br />
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

              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                id={`map-view-alarms-${selected.id}`}
                onClick={() => fetchSiteAlarms(selected.id)}
              >
                {alarmsLoading ? '⏳ Loading…' : '🔔 View Alarms Inline'}
              </button>
              {siteAlarms !== null && (
                <a
                  href={`/alarms?siteId=${selected.id}`}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
                  id={`map-open-alarms-page-${selected.id}`}
                >
                  ↗ Open in Alarms Page
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Inline Site Alarms Panel ──────────────────────────────────────── */}
        {selected && siteAlarms !== null && (
          <div className="card fade-in" style={{ marginTop: '1.25rem' }}>
            <div className="card-header">
              <span className="card-title">🔔 Open Alarms — {selected.name}</span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{siteAlarms.length} events</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setSiteAlarms(null)} id="close-alarms-panel">✕ Close</button>
              </div>
            </div>
            {alarmsLoading ? (
              <div className="loading-state" style={{ height: 120 }}><div className="spinner" /></div>
            ) : siteAlarms.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
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
                    {siteAlarms.map((ev) => (
                      <tr key={ev.id}>
                        <td><span className={`badge badge-${ev.severity?.toLowerCase()}`}>{ev.severity}</span></td>
                        <td>
                          {ev.networkLayer
                            ? <span className={`badge badge-${ev.networkLayer?.toLowerCase()}`}>{ev.networkLayer}</span>
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={{ fontSize: '0.82rem' }}>
                          <div style={{ fontWeight: 500 }}>{ev.deviceId}</div>
                          <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{ev.groupKey?.slice(0, 30)}…</div>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {ev.correlationRule === 'RULE_1_SAME_SITE_DEVICE'   ? '📍 Rule 1' :
                           ev.correlationRule === 'RULE_2_SITE_WIDE_CRITICAL' ? '🏢 Rule 2' :
                           ev.correlationRule === 'RULE_3_STANDALONE'         ? '⚡ Rule 3' :
                           ev.correlationRule}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{ev.alarmIds?.length || 0}</td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {new Date(ev.startTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td>
                          <a href={`/alarms/${ev.id}`} className="btn btn-secondary btn-sm" id={`map-alarm-detail-${ev.id}`}>Details →</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Sites Table */}
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <div className="card-header">
            <span className="card-title">Site Inventory ({sites.length})</span>
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
                {sites.map((site) => (
                  <tr key={site.id} onClick={() => setSelected(site)} id={`site-row-${site.id}`}>
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
    </AppLayout>
  );
}
