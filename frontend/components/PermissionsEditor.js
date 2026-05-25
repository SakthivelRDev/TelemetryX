'use client';
import { useState, useEffect } from 'react';
import api from '../lib/api';
import { MODULES, MODULE_CAPABILITIES, ALL_ACTIONS } from '../lib/moduleCapabilities';

const ROLES = ['ADMIN', 'ENGINEER', 'VIEWER'];

export default function PermissionsEditor({ permissions = [], onUpdated, canEdit = true }) {
  const [saving, setSaving]         = useState(null);
  const [localPerms, setLocalPerms] = useState([]);
  const [error, setError]           = useState('');
  const [successKey, setSuccessKey] = useState('');

  useEffect(() => {
    setLocalPerms(permissions || []);
  }, [permissions]);

  const permMap = {};
  localPerms.forEach((p) => { permMap[`${p.role}:${p.module}`] = p; });

  const getVal = (role, module, action) =>
    permMap[`${role}:${module}`]?.[action] ?? false;

  const handleToggle = async (role, module, action, currentVal) => {
    if (role === 'ADMIN' || !canEdit) return;
    if (!MODULE_CAPABILITIES[module]?.actions.includes(action)) return;

    const key = `${role}:${module}:${action}`;
    setSaving(key);
    setError('');

    const newVal = !currentVal;
    const idx = localPerms.findIndex((p) => p.role === role && p.module === module);
    const current = idx >= 0
      ? localPerms[idx]
      : { canRead: false, canWrite: false, canDelete: false };

    const payload = {
      canRead:   action === 'canRead'   ? newVal : Boolean(current.canRead),
      canWrite:  action === 'canWrite'  ? newVal : Boolean(current.canWrite),
      canDelete: action === 'canDelete' ? newVal : Boolean(current.canDelete),
    };

    setLocalPerms((prev) => {
      const i = prev.findIndex((p) => p.role === role && p.module === module);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], ...payload };
        return next;
      }
      return [...prev, { role, module, ...payload }];
    });

    try {
      const res = await api.put(`/api/users/permissions/${role}/${module}`, payload);
      const saved = res.data.permission;
      if (saved) {
        setLocalPerms((prev) => {
          const i = prev.findIndex((p) => p.role === role && p.module === module);
          if (i >= 0) {
            const next = [...prev];
            next[i] = saved;
            return next;
          }
          return [...prev, saved];
        });
      }
      setSuccessKey(key);
      setTimeout(() => setSuccessKey(''), 1200);
      onUpdated && onUpdated();
    } catch (err) {
      console.error('Permission update failed:', err);
      setError(err?.response?.data?.error || 'Failed to save — check your role permissions.');
      setLocalPerms((prev) => {
        const i = prev.findIndex((p) => p.role === role && p.module === module);
        if (i >= 0) {
          const next = [...prev];
          next[i] = { ...next[i], [action]: currentVal };
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
                <th key={m} colSpan={MODULE_CAPABILITIES[m].actions.length} style={{ borderLeft: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div>{m}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>
                    {MODULE_CAPABILITIES[m].description}
                  </div>
                </th>
              ))}
            </tr>
            <tr>
              <th />
              {MODULES.flatMap((m) =>
                ALL_ACTIONS.map((action) => {
                  if (!MODULE_CAPABILITIES[m].actions.includes(action)) return null;
                  return (
                    <th key={`${m}-${action}`} style={{
                      fontSize: '0.65rem',
                      color: 'var(--text-muted)',
                      ...(MODULE_CAPABILITIES[m].actions[0] === action && { borderLeft: '1px solid var(--border-color)' }),
                    }}>
                      {MODULE_CAPABILITIES[m].labels[action]}
                    </th>
                  );
                })
              )}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => (
              <tr key={role}>
                <td><span className={`badge badge-${role.toLowerCase()}`}>{role}</span></td>
                {MODULES.flatMap((module) =>
                  ALL_ACTIONS.map((action) => {
                    if (!MODULE_CAPABILITIES[module].actions.includes(action)) return null;

                    const val       = getVal(role, module, action);
                    const cellKey   = `${role}:${module}:${action}`;
                    const isAdmin   = role === 'ADMIN';
                    const isSaving  = saving === cellKey;
                    const isSuccess = successKey === cellKey;

                    return (
                      <td
                        key={cellKey}
                        style={{
                          ...(MODULE_CAPABILITIES[module].actions[0] === action && { borderLeft: '1px solid var(--border-color)' }),
                          background: isSuccess ? 'rgba(16,185,129,0.08)' : undefined,
                        }}
                      >
                        <label className="toggle" style={{ opacity: isSaving ? 0.5 : 1 }}>
                          <input
                            type="checkbox"
                            checked={val}
                            disabled={isAdmin || isSaving || !canEdit}
                            onChange={() => handleToggle(role, module, action, val)}
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
        💡 Each module only shows relevant permissions: Map = View only · Alarm = View + Manage · API & User = View/Edit/Delete.
        {canEdit ? ' Toggle to save immediately.' : ' Read-only for your role.'}
      </div>
    </div>
  );
}
