'use client';
import { useState, useEffect } from 'react';
import api from '../lib/api';

const MODULES = ['ALARM', 'MAP', 'API', 'USER'];
const ROLES   = ['ADMIN', 'ENGINEER', 'VIEWER'];
const ACTIONS = [
  { key: 'canRead',   label: 'Read'   },
  { key: 'canWrite',  label: 'Write'  },
  { key: 'canDelete', label: 'Delete' },
];

export default function PermissionsEditor({ permissions = [], onUpdated }) {
  const [saving, setSaving]         = useState(null);
  const [localPerms, setLocalPerms] = useState([]);
  const [error, setError]           = useState('');
  const [successKey, setSuccessKey] = useState('');

  // ── Sync local state whenever parent passes fresh permissions ──────────────
  // This is the KEY fix: use useEffect to sync props → state
  useEffect(() => {
    if (permissions && permissions.length > 0) {
      setLocalPerms(permissions);
    }
  }, [permissions]);

  // Build lookup: "ROLE:MODULE" → permission object
  const permMap = {};
  localPerms.forEach((p) => { permMap[`${p.role}:${p.module}`] = p; });

  const getVal = (role, module, action) =>
    permMap[`${role}:${module}`]?.[action] ?? false;

  const handleToggle = async (role, module, action, currentVal) => {
    // Admin is always full access — never editable
    if (role === 'ADMIN') return;

    const key = `${role}:${module}:${action}`;
    setSaving(key);
    setError('');

    // ── Optimistic update ────────────────────────────────────────────────────
    const newVal = !currentVal;
    setLocalPerms((prev) => {
      const idx = prev.findIndex((p) => p.role === role && p.module === module);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], [action]: newVal };
        return next;
      }
      return [...prev, { role, module, canRead: false, canWrite: false, canDelete: false, [action]: newVal }];
    });

    try {
      // Build full updated permission (must send all 3 flags)
      const current = permMap[`${role}:${module}`] || { canRead: false, canWrite: false, canDelete: false };
      const payload  = { ...current, [action]: newVal };

      const res = await api.put(`/api/users/permissions/${role}/${module}`, payload);

      // Flash success indicator
      setSuccessKey(key);
      setTimeout(() => setSuccessKey(''), 1200);

      onUpdated && onUpdated();
    } catch (err) {
      // Roll back optimistic update on failure
      console.error('Permission update failed:', err);
      const msg = err?.response?.data?.error || 'Failed to save — check your role permissions.';
      setError(msg);

      setLocalPerms((prev) => {
        const idx = prev.findIndex((p) => p.role === role && p.module === module);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], [action]: currentVal }; // revert
          return next;
        }
        return prev;
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '0.75rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
          ⚠️ {error}
        </div>
      )}

      <div className="table-wrapper">
        <table className="perm-table">
          <thead>
            <tr>
              <th>Role / Module</th>
              {MODULES.map((m) => (
                <th key={m} colSpan={3} style={{ borderLeft: '1px solid var(--border-color)', textAlign: 'center' }}>
                  {m}
                </th>
              ))}
            </tr>
            <tr>
              <th />
              {MODULES.flatMap((m) =>
                ACTIONS.map((a) => (
                  <th key={`${m}-${a.key}`} style={{
                    fontSize: '0.65rem',
                    color: 'var(--text-muted)',
                    ...(a.key === 'canRead' && { borderLeft: '1px solid var(--border-color)' }),
                  }}>
                    {a.label}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => (
              <tr key={role}>
                <td>
                  <span className={`badge badge-${role.toLowerCase()}`}>{role}</span>
                </td>
                {MODULES.flatMap((module) =>
                  ACTIONS.map((action) => {
                    const val        = getVal(role, module, action.key);
                    const cellKey    = `${role}:${module}:${action.key}`;
                    const isAdmin    = role === 'ADMIN';       // Always locked ON
                    const isSaving   = saving === cellKey;
                    const isSuccess  = successKey === cellKey;

                    return (
                      <td
                        key={cellKey}
                        style={{
                          ...(action.key === 'canRead' && { borderLeft: '1px solid var(--border-color)' }),
                          transition: 'background 0.3s',
                          background: isSuccess ? 'rgba(16,185,129,0.08)' : undefined,
                        }}
                      >
                        <label
                          className="toggle"
                          title={isAdmin ? 'Admin always has full access' : `${role} – ${module} – ${action.label}: click to toggle`}
                          style={{ opacity: isSaving ? 0.5 : 1 }}
                        >
                          <input
                            type="checkbox"
                            checked={val}
                            disabled={isAdmin || isSaving}
                            onChange={() => handleToggle(role, module, action.key, val)}
                            id={`perm-${role}-${module}-${action.key}`}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        💡 <strong>Admin</strong> permissions are locked (always full access). Toggle any other cell to save immediately.
        Changes take effect on the next API request by that role.
      </div>
    </div>
  );
}
