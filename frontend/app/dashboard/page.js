'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import RoleGuard from '../../components/RoleGuard';
import AppLayout from '../../components/AppLayout';
import api from '../../lib/api';
import Link from 'next/link';

const TIME_RANGES = [
  { value: '1h', label: 'Last 1 Hour' },
  { value: '6h', label: 'Last 6 Hours' },
  { value: '12h', label: 'Last 12 Hours' },
  { value: '24h', label: 'Last 1 Day' },
  { value: '7d', label: 'Last 7 Days' },
];

// Dynamic import recharts (client-side only)
const {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} = require('recharts');

const SEVERITY_COLORS = {
  CRITICAL: '#ef4444',
  MEDIUM: '#f97316',
  LOW: '#eab308',
};

const SITE_STATUS_COLORS = { CRITICAL: '#ef4444', WARNING: '#f59e0b', OK: '#10b981' };

function StatCard({ icon, value, label, colorClass, id }) {
  return (
    <div className={`stat-card ${colorClass}`} id={id}>
      <div className={`stat-icon ${colorClass}`}>{icon}</div>
      <div>
        <div className="stat-value">{value ?? '—'}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

const CUSTOM_TOOLTIP_STYLE = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  fontSize: 12,
};

export default function DashboardPage() {
  const { user, canAccess } = useAuth();
  const [stats, setStats] = useState(null);
  const [series, setSeries] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState('');
  const [timeRange, setTimeRange] = useState('12h');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, seriesRes, eventsRes] = await Promise.all([
        api.get('/api/alarms/stats'),
        api.get(`/api/alarms/timeseries?range=${timeRange}`),
        api.get('/api/alarms/correlated?limit=5&status=OPEN'),
      ]);
      setStats(statsRes.data);
      setSeries(seriesRes.data.series || []);
      setEvents(eventsRes.data.events || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const timer = setInterval(fetchData, 10000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const rangeLabel = TIME_RANGES.find((r) => r.value === timeRange)?.label || 'Last 12 Hours';

  const handleReset = async () => {
    if (!confirm('Close all open events and reset site statuses? This clears accumulated CRITICAL data.')) return;
    setResetting(true);
    try {
      const res = await api.post('/api/alarms/reset');
      showToast(`✅ ${res.data.message}`);
      setTimeout(fetchData, 1000);
    } catch (err) {
      showToast('❌ Reset failed');
    } finally {
      setResetting(false);
    }
  };

  // Prepare severity pie chart data
  const severityPieData = stats?.severityCounts
    ? Object.entries(stats.severityCounts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
    : [];

  // Prepare site status pie data
  const statusPieData = stats?.siteStatuses
    ? Object.entries(stats.siteStatuses)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
    : [];

  const RULE_LABELS = {
    RULE_1_SAME_SITE_DEVICE: 'Rule 1 – Device',
    RULE_2_SITE_WIDE_CRITICAL: 'Rule 2 – Site-Wide',
    RULE_3_STANDALONE: 'Rule 3 – Standalone',
  };

  return (
    <AppLayout>
      <RoleGuard module="ALARM" redirect>
        <div className="fade-in">
          {toast && <div className={`alert ${toast.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 999, width: 'auto', minWidth: 300 }}>{toast}</div>}

          {/* Header */}
          <div className="page-header">
            <div className="flex-between">
              <div>
                <h1 className="page-title">⬡ Dashboard</h1>
                <p className="page-subtitle">
                  Network operations overview · Auto-refresh 10s &nbsp;<span className="pulse-dot" />
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className={`badge badge-${user?.role?.toLowerCase()}`}>{user?.role}</span>
                {canAccess('ALARM', 'canWrite') && (
                  <button className="btn btn-secondary btn-sm" onClick={handleReset} disabled={resetting} id="reset-data-btn" title="Close all stale open events and reset site statuses">
                    {resetting ? '⏳ Resetting…' : '🔄 Reset Data'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="stats-grid">
                <StatCard id="stat-total-alarms" icon="🔔" value={stats?.totalRaw} label="Total Alarms" colorClass="blue" />
                <StatCard id="stat-open-events" icon="⚡" value={stats?.openEvents} label="Open Correlated Events" colorClass="red" />
                <StatCard id="stat-critical-sites" icon="🏢" value={stats?.criticalSites} label="Critical Sites" colorClass="orange" />
                <StatCard id="stat-critical-alarms" icon="🚨" value={stats?.criticalAlarms} label="Critical Alarms" colorClass="red" />
              </div>

              {/* Charts Row 1 */}
              <div className="charts-grid" style={{ gridTemplateColumns: '2fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                {/* Area Chart: Alarm volume last 12 hours */}
                <div className="chart-card">
                  <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                    <div className="chart-title" style={{ marginBottom: 0 }}>📈 Alarm Volume – {rangeLabel}</div>
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                      id="alarm-volume-range"
                      style={{ minWidth: 150, fontSize: '0.8rem' }}
                      aria-label="Alarm volume time range"
                    >
                      {TIME_RANGES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={series} margin={{ top: 4, right: 16, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6378ff" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6378ff" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradCrit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,120,255,0.1)" />
                      <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                      <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="total" stroke="#6378ff" fill="url(#gradTotal)" name="Total" strokeWidth={2} />
                      <Area type="monotone" dataKey="critical" stroke="#ef4444" fill="url(#gradCrit)" name="Critical" strokeWidth={2} />
                      <Area type="monotone" dataKey="medium" stroke="#f97316" fill="none" name="Medium" strokeWidth={1.5} strokeDasharray="4 2" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Pie Chart: Site Status */}
                <div className="chart-card">
                  <div className="chart-title">🏢 Site Status</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        label={false}
                      >
                        {statusPieData.map((entry) => (
                          <Cell key={entry.name} fill={SITE_STATUS_COLORS[entry.name] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value, entry) => `${value}: ${entry.payload?.value ?? 0}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  {statusPieData.length === 0 && <div className="empty-state" style={{ padding: '1rem' }}>No site data</div>}
                </div>
              </div>

              {/* Charts Row 2 */}
              <div className="charts-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                {/* Bar Chart: Alarms by Severity */}
                <div className="chart-card">
                  <div className="chart-title">📊 Alarms by Severity</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={Object.entries(stats?.severityCounts || {}).map(([name, value]) => ({ name, value }))} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,120,255,0.1)" />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                      <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                      <Bar dataKey="value" name="Alarms" radius={[4, 4, 0, 0]}>
                        {Object.keys(stats?.severityCounts || {}).map((sev) => (
                          <Cell key={sev} fill={SEVERITY_COLORS[sev] || '#94a3b8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Donut: Alarm severity distribution */}
                <div className="chart-card">
                  <div className="chart-title">🥧 Severity Distribution</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={severityPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                        {severityPieData.map((entry) => (
                          <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  {severityPieData.length === 0 && <div className="empty-state" style={{ padding: '1rem' }}>No alarm data</div>}
                </div>
              </div>

              {/* Recent Open Events */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">🔥 Recent Open Correlated Events</span>
                  <Link href="/alarms" className="btn btn-secondary btn-sm" id="view-all-events">View All →</Link>
                </div>

                {events.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">✅</div>
                    <div>No open events — all systems operational</div>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr><th>Severity</th><th>Group Key</th><th>Rule</th><th>Alarms</th><th>Status</th><th>Started</th><th></th></tr>
                      </thead>
                      <tbody>
                        {events.map((e) => (
                          <tr key={e.id}>
                            <td><span className={`badge badge-${e.severity?.toLowerCase()}`}>{e.severity}</span></td>
                            <td className="mono" style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>{e.groupKey}</td>
                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{RULE_LABELS[e.correlationRule] || e.correlationRule}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{e.alarmIds?.length || 0}</td>
                            <td><span className={`badge badge-${e.status?.toLowerCase()}`}>{e.status}</span></td>
                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{new Date(e.startTime).toLocaleTimeString('en-IN')}</td>
                            <td><Link href={`/alarms/${e.id}`} className="btn btn-secondary btn-sm" id={`dash-event-${e.id}`}>View →</Link></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </RoleGuard>
    </AppLayout>
  );
}
