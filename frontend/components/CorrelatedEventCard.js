'use client';
import Link from 'next/link';
import { SeverityBadge, StatusBadge, formatTime } from './AlarmTable';

const RULE_LABELS = {
  RULE_1_SAME_SITE_DEVICE:    '📍 Rule 1 – Same Site & Device (5min)',
  RULE_2_SITE_WIDE_CRITICAL:  '🏢 Rule 2 – Site-Wide Critical (10min)',
  RULE_3_STANDALONE:          '⚡ Rule 3 – Standalone Alarm',
};

export default function CorrelatedEventCard({ event }) {
  const rule = RULE_LABELS[event.correlationRule] || event.correlationRule;

  return (
    <div className="card fade-in" style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <SeverityBadge severity={event.severity} />
            <StatusBadge status={event.status} />
            <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {event.alarmIds?.length || 0} alarms
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            {event.groupKeyLabel || event.groupKey}
          </div>
          {event.groupKeyLabel && (
            <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              {event.groupKey}
            </div>
          )}
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{rule}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            {formatTime(event.startTime)} → {formatTime(event.endTime)}
          </div>
        </div>
        <Link href={`/alarms/${event.id}`} className="btn btn-secondary btn-sm" id={`view-event-${event.id}`}>
          Details →
        </Link>
      </div>
    </div>
  );
}
