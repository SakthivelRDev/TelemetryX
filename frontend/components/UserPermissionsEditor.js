'use client';
import { useState } from 'react';
import api from '../lib/api';
import { MODULES, MODULE_CAPABILITIES } from '../lib/moduleCapabilities';

export default function UserPermissionsEditor({ userId, detail, canEdit, onUpdated }) {
  const [saving, setSaving] = useState(null);
  const [error, setError]   = useState('');

  if (!detail?.user) return null;

  const isAdminUser = detail.user.role === 'ADMIN';
  const rolePerms   = detail.rolePermissions || {};
  const overrides   = detail.overrides || {};
  const effective   = detail.effective || {};

  const getEffectiveVal = (module, action) => Boolean(effective[module]?.[action]);
  const getRoleVal      = (module, action) => Boolean(rolePerms[module]?.[action]);
  const hasOverride     = (module) => Boolean(overrides[module]);

  const handleToggle = async (module, action, currentVal) => {
    if (!canEdit || isAdminUser) return;
    if (!MODULE_CAPABILITIES[module]?.actions.includes(action)) return;

    const key = `${module}:${action}`;
    setSaving(key);
    setError('');

    const base = overrides[module] || rolePerms[module] || { canRead: false, canWrite: false, canDelete: false };
    const payload = {
      canRead:   action === 'canRead'   ? !currentVal : Boolean(base.canRead),
      canWrite:  action === 'canWrite'  ? !currentVal : Boolean(base.canWrite),
      canDelete: action === 'canDelete' ? !currentVal : Boolean(base.canDelete),
    };

    try {
      await api.put(`/api/users/permissions/user/${userId}/${module}`, payload);
      onUpdated && onUpdated();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save user permission');
    } finally {
      setSaving(null);
    }
  };

  const handleResetModule = async (module) => {
    if (!canEdit || isAdminUser) return;
    setSaving(`reset:${module}`);
    try {
      await api.delete(`/api/users/permissions/user/${userId}/${module}`);
      onUpdated && onUpdated();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to reset override');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>⚠️ {error}</div>
      )}

      {isAdminUser && (
        <div className="info-banner" style={{ marginBottom: '1rem' }}>
          Admin users always have full access — overrides cannot be applied.
        </div>
      )}

      <div className="table-wrapper">
        <table className="perm-table">
          <thead>
            <tr>
              <th>Module</th>
              <th>Role default</th>
              <th>User override (effective)</th>
              {canEdit && !isAdminUser && <th />}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((mod) => {
              const caps = MODULE_CAPABILITIES[mod];
              return (
                <tr key={mod}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{mod}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{caps.description}</div>
                  </td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {caps.actions.map((a) => (
                      <span key={a} style={{ marginRight: 8 }}>
                        {caps.labels[a]}: {getRoleVal(mod, a) ? '✓' : '—'}
                      </span>
                    ))}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {caps.actions.map((action) => {
                        const val = getEffectiveVal(mod, action);
                        const cellKey = `${mod}:${action}`;
                        const overridden = hasOverride(mod);
                        return (
                          <div key={action} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', minWidth: 52 }}>{caps.labels[action]}</span>
                            {canEdit && !isAdminUser ? (
                              <label className="toggle" style={{ opacity: saving === cellKey ? 0.5 : 1 }}>
                                <input
                                  type="checkbox"
                                  checked={val}
                                  disabled={saving === cellKey}
                                  onChange={() => handleToggle(mod, action, val)}
                                />
                                <span className="toggle-slider" />
                              </label>
                            ) : (
                              <span>{val ? '✅' : '—'}</span>
                            )}
                            {overridden && <span style={{ fontSize: '0.6rem', color: 'var(--accent-cyan)' }}>*</span>}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  {canEdit && !isAdminUser && (
                    <td>
                      {hasOverride(mod) && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={saving === `reset:${mod}`}
                          onClick={() => handleResetModule(mod)}
                        >
                          Use role
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        💡 Toggle to set permissions for this user only. <strong>Use role</strong> removes the override and reverts to the role matrix.
      </div>
    </div>
  );
}
