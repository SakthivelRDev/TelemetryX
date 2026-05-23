'use client';

const SEVERITY_ORDER = ['CRITICAL', 'MAJOR', 'MINOR', 'WARNING', 'INFO'];

function SeverityBadge({ severity }) {
  return <span className={`badge badge-${severity?.toLowerCase()}`}>{severity}</span>;
}

function StatusBadge({ status }) {
  return <span className={`badge badge-${status?.toLowerCase()}`}>{status}</span>;
}

function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' });
}

export default function AlarmTable({ alarms = [], onRowClick, emptyMessage = 'No alarms found' }) {
  if (alarms.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔕</div>
        <div>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Severity</th>
            <th>Site</th>
            <th>Device</th>
            <th>Message</th>
            <th>Source</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {alarms.map((alarm) => (
            <tr key={alarm.id} onClick={() => onRowClick && onRowClick(alarm)}>
              <td><SeverityBadge severity={alarm.severity} /></td>
              <td className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{alarm.siteId?.slice(0, 8)}…</td>
              <td style={{ color: 'var(--accent-cyan)', fontWeight: 500 }}>{alarm.deviceId}</td>
              <td style={{ color: 'var(--text-secondary)', maxWidth: 280 }}>{alarm.message}</td>
              <td>
                <span style={{ color: alarm.source === 'sourceA' ? 'var(--accent-blue)' : 'var(--accent-purple)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  {alarm.source}
                </span>
              </td>
              <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{formatTime(alarm.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { SeverityBadge, StatusBadge, formatTime };
