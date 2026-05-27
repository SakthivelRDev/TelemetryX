'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import RoleGuard from '../../components/RoleGuard';
import AppLayout from '../../components/AppLayout';
import CorrelatedEventCard from '../../components/CorrelatedEventCard';
import api from '../../lib/api';

const SEVERITIES     = ['', 'CRITICAL', 'MEDIUM', 'LOW'];
const STATUSES       = ['', 'OPEN', 'ACKNOWLEDGED', 'CLOSED'];
const REGIONS        = ['', 'North', 'South', 'East', 'West'];
const NETWORK_LAYERS = ['', 'RAN', 'CORE', 'TRANSPORT'];

export default function AlarmsPage() {
  const { canAccess } = useAuth();
  const searchParams = useSearchParams();
  const [events, setEvents]     = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [severity, setSeverity] = useState('');
  const [status, setStatus]     = useState('');
  const [region, setRegion]     = useState('');
  const [networkLayer, setNetworkLayer] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage]         = useState(1);
  const siteId = searchParams.get('siteId') || '';

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit: 20,
        ...(severity && { severity }),
        ...(status && { status }),
        ...(siteId && { siteId }),
        ...(region && { region }),
        ...(networkLayer && { networkLayer }),
      });
      const res = await api.get(`/api/alarms/correlated?${params}`);
      setEvents(res.data.events || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Alarms fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [severity, status, siteId, region, networkLayer, page]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const triggerIngest = async () => {
    try {
      await api.post('/api/alarms/ingest');
      setTimeout(fetchEvents, 2000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AppLayout>
      <RoleGuard module="ALARM" redirect>
      <div className="fade-in">
        <div className="page-header">
          <div className="flex-between">
            <div>
              <h1 className="page-title">🔔 Correlated Alarms</h1>
              <p className="page-subtitle">{total} events found · Click to drill-down</p>
            </div>
            {canAccess('ALARM', 'canWrite') && (
              <button
                className="btn btn-primary btn-sm"
                onClick={triggerIngest}
                id="trigger-ingest"
                title="Manually fire one ingestion cycle: generate mock alarms → normalize → correlate → update site statuses."
              >
                ⚡ Trigger Ingest
              </button>
            )}
          </div>
        </div>

        <div className="info-banner" style={{ marginBottom: '1rem' }}>
          <strong>Correlation rules:</strong>{' '}
          <em>Rule 1</em> groups alarms on the same site + device within 5 min ·{' '}
          <em>Rule 2</em> flags site-wide impact when 2+ critical/medium devices fail within 10 min ·{' '}
          <em>Rule 3</em> keeps standalone alarms separate.
          {' '}<strong>Group key</strong> is the unique ID for each correlated group (site + device pattern).
        </div>

        {/* Filters */}
        <div className="filters-bar">
          <input
            type="text"
            placeholder="🔍 Search by site, device, group, or message..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            style={{
              flex: 1,
              padding: '0.6rem 0.9rem',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
            }}
            id="alarms-search"
          />
          <select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }} id="filter-severity">
            {SEVERITIES.map((s) => <option key={s} value={s}>{s || 'All Severities'}</option>)}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} id="filter-status">
            {STATUSES.map((s) => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
          </select>
          <select value={region} onChange={(e) => { setRegion(e.target.value); setPage(1); }} id="filter-region">
            {REGIONS.map((r) => <option key={r} value={r}>{r || 'All Regions'}</option>)}
          </select>
          <select value={networkLayer} onChange={(e) => { setNetworkLayer(e.target.value); setPage(1); }} id="filter-network-layer">
            {NETWORK_LAYERS.map((l) => <option key={l} value={l}>{l || 'All Layers'}</option>)}
          </select>
          {siteId && (
            <span className="badge badge-info">Filtered by site</span>
          )}
          {region && (
            <span className="badge badge-info">Region: {region}</span>
          )}
        </div>

        {/* Events Table */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Correlated Events</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{total} total</span>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : (() => {
            const filteredEvents = events.filter((e) => {
              if (!searchTerm) return true;
              const query = searchTerm.toLowerCase();
              return (
                (e.siteName || '').toLowerCase().includes(query) ||
                (e.groupKeyLabel || '').toLowerCase().includes(query) ||
                (e.groupKey || '').toLowerCase().includes(query) ||
                (e.deviceId || '').toLowerCase().includes(query)
              );
            });
            return filteredEvents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <div>No events match the current filters</div>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                    <th>Severity</th>
                    <th>Network Layer</th>
                    <th>Site</th>
                    <th>Group / Correlation</th>
                    <th>Rule</th>
                    <th>Alarms</th>
                    <th>Status</th>
                    <th>Start Time</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((e) => {
                    const RULE_LABELS = {
                      RULE_1_SAME_SITE_DEVICE:   '📍 Rule 1 – Device',
                      RULE_2_SITE_WIDE_CRITICAL: '🏢 Rule 2 – Site-Wide',
                      RULE_3_STANDALONE:         '⚡ Rule 3 – Standalone',
                    };
                    return (
                      <tr key={e.id}>
                        <td><span className={`badge badge-${e.severity?.toLowerCase()}`}>{e.severity}</span></td>
                        <td>
                          {e.networkLayer ? (
                            <span className={`badge badge-${e.networkLayer?.toLowerCase()}`}>{e.networkLayer}</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.78rem' }}>{e.siteName || '—'}</td>
                        <td>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{e.groupKeyLabel || e.groupKey}</div>
                          <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{e.groupKey}</div>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }} title={e.correlationRule}>{RULE_LABELS[e.correlationRule] || e.correlationRule}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{e.alarmIds?.length || 0}</td>
                        <td><span className={`badge badge-${e.status?.toLowerCase()}`}>{e.status}</span></td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{new Date(e.startTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td>
                          <a href={`/alarms/${e.id}`} className="btn btn-secondary btn-sm" id={`alarm-row-${e.id}`}>Details →</a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            );
          })()}

          {/* Pagination */}
          {total > 20 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} id="prev-page">← Prev</button>
              <span style={{ color: 'var(--text-muted)', lineHeight: '2rem', fontSize: '0.85rem' }}>Page {page}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage((p) => p + 1)} disabled={events.length < 20} id="next-page">Next →</button>
            </div>
          )}
        </div>
      </div>
      </RoleGuard>
    </AppLayout>
  );
}
