'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import RoleGuard from '../../../components/RoleGuard';
import AppLayout from '../../../components/AppLayout';
import AlarmTable from '../../../components/AlarmTable';
import api from '../../../lib/api';

const RULE_LABELS = {
  RULE_1_SAME_SITE_DEVICE:   { label: 'Rule 1 – Same Site & Device within 5 minutes', icon: '📍', color: 'var(--accent-blue)' },
  RULE_2_SITE_WIDE_CRITICAL: { label: 'Rule 2 – Site-Wide Critical/Major within 10 minutes', icon: '🏢', color: 'var(--critical)' },
  RULE_3_STANDALONE:         { label: 'Rule 3 – Standalone Alarm (no group match)', icon: '⚡', color: 'var(--warning)' },
};

export default function AlarmDetailPage() {
  const params = useParams();
  const [event, setEvent]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await api.get(`/api/alarms/correlated/${params.id}`);
        setEvent(res.data.event);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load event');
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [params.id]);

  if (loading) return <div className="loading-state"><div className="spinner" /></div>;
  if (error)   return <div className="alert alert-error">⚠ {error}</div>;
  if (!event)  return null;

  const rule = RULE_LABELS[event.correlationRule];

  return (
    <AppLayout>
      <RoleGuard module="ALARM" redirect>
      <div className="fade-in">
        {/* Back + Header */}
        <div className="page-header">
          <Link href="/alarms" className="btn btn-secondary btn-sm" style={{ marginBottom: '1rem' }} id="back-to-alarms">
            ← Back to Alarms
          </Link>
          <div className="flex-between">
            <div>
              <h1 className="page-title">
                ⚡ Correlated Event
              </h1>
              <p className="page-subtitle mono" style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>{event.groupKey}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className={`badge badge-${event.severity?.toLowerCase()}`}>{event.severity}</span>
              <span className={`badge badge-${event.status?.toLowerCase()}`}>{event.status}</span>
            </div>
          </div>
        </div>

        {/* Correlation Rule Banner */}
        <div className="card" style={{ marginBottom: '1.25rem', borderColor: rule?.color || 'var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '2rem' }}>{rule?.icon || '🔗'}</span>
            <div>
              <div style={{ fontWeight: 600, color: rule?.color || 'var(--text-primary)', fontSize: '0.95rem' }}>
                {rule?.label || event.correlationRule}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                Correlation Rule Applied
              </div>
            </div>
          </div>
        </div>

        {/* Event Details */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header">
            <span className="card-title">Event Details</span>
          </div>
          <div className="detail-grid">
            <div className="detail-item"><label>Group Key</label><div className="value mono">{event.groupKey}</div></div>
            <div className="detail-item"><label>Device</label><div className="value" style={{ color: 'var(--accent-cyan)' }}>{event.deviceId}</div></div>
            <div className="detail-item"><label>Site</label><div className="value">{event.site?.name || event.siteId?.slice(0, 8) + '…'}</div></div>
            <div className="detail-item"><label>Region</label><div className="value">{event.site?.region || '—'}</div></div>
            <div className="detail-item"><label>Start Time</label><div className="value">{new Date(event.startTime).toLocaleString('en-IN')}</div></div>
            <div className="detail-item"><label>End Time</label><div className="value">{new Date(event.endTime).toLocaleString('en-IN')}</div></div>
            <div className="detail-item"><label>Duration</label><div className="value">{Math.round((new Date(event.endTime) - new Date(event.startTime)) / 1000)}s</div></div>
            <div className="detail-item"><label>Total Alarms</label><div className="value">{event.alarmIds?.length || 0}</div></div>
          </div>
        </div>

        {/* Raw Alarms Drill-Down */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">📋 Raw Alarms ({event.rawAlarms?.length || 0})</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setExpanded((v) => !v)} id="toggle-raw-alarms">
              {expanded ? '▲ Collapse' : '▼ Expand'}
            </button>
          </div>
          {expanded && (
            <AlarmTable
              alarms={event.rawAlarms || []}
              emptyMessage="No raw alarms found for this event"
            />
          )}
        </div>
      </div>
      </RoleGuard>
    </AppLayout>
  );
}
