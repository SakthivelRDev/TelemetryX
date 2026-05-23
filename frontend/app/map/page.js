'use client';
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import RoleGuard from '../../components/RoleGuard';
import AppLayout from '../../components/AppLayout';
import api from '../../lib/api';

// Dynamic import to avoid SSR issues with Leaflet
const SiteMap = dynamic(() => import('../../components/SiteMap'), { ssr: false, loading: () => <div className="loading-state"><div className="spinner" /></div> });

const REGIONS    = ['', 'North', 'South', 'East', 'West'];
const SEVERITIES = ['', 'CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'INFO'];
const STATUSES   = ['', 'CRITICAL', 'WARNING', 'OK'];

export default function MapPage() {
  const [sites, setSites]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [region, setRegion]       = useState('');
  const [severity, setSeverity]   = useState('');
  const [status, setStatus]       = useState('');
  const [selected, setSelected]   = useState(null);

  const fetchSites = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (region)   params.set('region',   region);
      if (severity) params.set('severity', severity);
      if (status)   params.set('status',   status);
      const res = await api.get(`/api/map/sites?${params}`);
      setSites(res.data.sites || []);
    } catch (err) {
      console.error('Map fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [region, severity, status]);

  useEffect(() => { fetchSites(); }, [fetchSites]);

  // Refresh every 10s
  useEffect(() => {
    const timer = setInterval(fetchSites, 10000);
    return () => clearInterval(timer);
  }, [fetchSites]);

  const statusCounts = {
    CRITICAL: sites.filter((s) => s.status === 'CRITICAL').length,
    WARNING:  sites.filter((s) => s.status === 'WARNING').length,
    OK:       sites.filter((s) => s.status === 'OK').length,
  };

  return (
    <AppLayout>
      <RoleGuard>
      <div className="fade-in">
        <div className="page-header">
          <div className="flex-between">
            <div>
              <h1 className="page-title">🗺 Network Map</h1>
              <p className="page-subtitle">Interactive site topology – India region · Auto-refresh 10s <span className="pulse-dot" /></p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span className="badge badge-critical">🔴 Critical: {statusCounts.CRITICAL}</span>
              <span className="badge badge-warning">🟡 Warning: {statusCounts.WARNING}</span>
              <span className="badge badge-ok">🟢 OK: {statusCounts.OK}</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-bar">
          <select value={region} onChange={(e) => setRegion(e.target.value)} id="map-filter-region">
            {REGIONS.map((r) => <option key={r} value={r}>{r || 'All Regions'}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} id="map-filter-status">
            {STATUSES.map((s) => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
          </select>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} id="map-filter-severity">
            {SEVERITIES.map((s) => <option key={s} value={s}>{s || 'All Severities'}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={fetchSites} id="map-refresh">↺ Refresh</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 320px' : '1fr', gap: '1.25rem' }}>
          {/* Map */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <div className="loading-state" style={{ height: 600 }}><div className="spinner" /></div>
            ) : (
              <SiteMap sites={sites} onSiteClick={setSelected} />
            )}
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

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <span className={`badge badge-${selected.status?.toLowerCase()}`}>{selected.status}</span>
                <span className={`badge badge-${selected.topSeverity?.toLowerCase()}`}>{selected.topSeverity || 'INFO'}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Alarms</div>
                  <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{selected.alarmCount || 0}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lat / Lng</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{selected.lat?.toFixed(2)}, {selected.lng?.toFixed(2)}</div>
                </div>
              </div>

              <a href={`/alarms?siteId=${selected.id}`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} id={`map-view-alarms-${selected.id}`}>
                View Alarms →
              </a>
            </div>
          )}
        </div>

        {/* Sites List */}
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <div className="card-header">
            <span className="card-title">Site Inventory ({sites.length})</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Site</th><th>Region</th><th>Status</th><th>Top Severity</th><th>Alarms</th><th>Coordinates</th></tr>
              </thead>
              <tbody>
                {sites.map((site) => (
                  <tr key={site.id} onClick={() => setSelected(site)} id={`site-row-${site.id}`}>
                    <td style={{ fontWeight: 500 }}>{site.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{site.region}</td>
                    <td><span className={`badge badge-${site.status?.toLowerCase()}`}>{site.status}</span></td>
                    <td><span className={`badge badge-${site.topSeverity?.toLowerCase()}`}>{site.topSeverity || 'INFO'}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{site.alarmCount || 0}</td>
                    <td className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{site.lat?.toFixed(4)}, {site.lng?.toFixed(4)}</td>
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
