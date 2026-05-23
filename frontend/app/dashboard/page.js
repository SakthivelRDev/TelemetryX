'use client';
import { useState, useEffect, useCallback } from 'react';
import RoleGuard from '../../components/RoleGuard';
import AppLayout from '../../components/AppLayout';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import Link from 'next/link';

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

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats]   = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, eventsRes] = await Promise.all([
        api.get('/api/alarms/stats'),
        api.get('/api/alarms/correlated?limit=5&status=OPEN'),
      ]);
      setStats(statsRes.data);
      setEvents(eventsRes.data.events || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 10000); // Auto-refresh every 10s
    return () => clearInterval(timer);
  }, [fetchData]);

  const RULE_LABELS = {
    RULE_1_SAME_SITE_DEVICE:   'Rule 1',
    RULE_2_SITE_WIDE_CRITICAL: 'Rule 2',
    RULE_3_STANDALONE:         'Rule 3',
  };

  return (
    <AppLayout>
      <RoleGuard>
        <div className="fade-in">
          {/* Header */}
          <div className="page-header">
            <div className="flex-between">
              <div>
                <h1 className="page-title">⬡ Dashboard</h1>
                <p className="page-subtitle">
                  Network operations overview · Auto-refresh every 10s &nbsp;
                  <span className="pulse-dot" />
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className={`badge badge-${user?.role?.toLowerCase()}`}>{user?.role}</span>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          {loading ? (
            <div className="loading-state"><div className="spinner" /></div>
          ) : (
            <>
              <div className="stats-grid">
                <StatCard id="stat-total-alarms"   icon="🔔" value={stats?.totalRaw}      label="Total Raw Alarms"       colorClass="blue"   />
                <StatCard id="stat-open-events"    icon="⚡" value={stats?.openEvents}    label="Open Correlated Events" colorClass="red"    />
                <StatCard id="stat-critical-sites" icon="🏢" value={stats?.criticalSites} label="Critical Sites"         colorClass="orange" />
                <StatCard id="stat-critical-alarms" icon="🚨" value={stats?.criticalAlarms} label="Critical Alarms"      colorClass="red"    />
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
                        <tr>
                          <th>Severity</th>
                          <th>Group Key</th>
                          <th>Rule</th>
                          <th>Alarms</th>
                          <th>Status</th>
                          <th>Started</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {events.map((e) => (
                          <tr key={e.id}>
                            <td><span className={`badge badge-${e.severity?.toLowerCase()}`}>{e.severity}</span></td>
                            <td className="mono" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>{e.groupKey}</td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{RULE_LABELS[e.correlationRule] || e.correlationRule}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{e.alarmIds?.length || 0}</td>
                            <td><span className={`badge badge-${e.status?.toLowerCase()}`}>{e.status}</span></td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(e.startTime).toLocaleTimeString('en-IN')}</td>
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

