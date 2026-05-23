'use client';
import { useState } from 'react';
import api from '../lib/api';

const MODULES = ['ALARM', 'MAP', 'API', 'USER'];
const ROLES   = ['ADMIN', 'ENGINEER', 'VIEWER'];
const ACTIONS = [
  { key: 'canRead',   label: 'Read'   },
  { key: 'canWrite',  label: 'Write'  },
  { key: 'canDelete', label: 'Delete' },
];

export default function PermissionsEditor({ permissions = [], onUpdated }) {
  const [saving, setSaving] = useState(null);
  const [localPerms, setLocalPerms] = useState(permissions);

  // Build a lookup: role+module → permission object
  const permMap = {};
  localPerms.forEach((p) => { permMap[`${p.role}:${p.module}`] = p; });

  const getVal = (role, module, action) => {
    return permMap[`${role}:${module}`]?.[action] || false;
  };

  const handleToggle = async (role, module, action, currentVal) => {
    const key = `${role}:${module}:${action}`;
    setSaving(key);

    try {
      const current = permMap[`${role}:${module}`] || { canRead: false, canWrite: false, canDelete: false };
      const updated = { ...current, [action]: !currentVal };

      await api.put(`/api/users/permissions/${role}/${module}`, updated);

      // Update local state
      setLocalPerms((prev) => {
        const idx = prev.findIndex((p) => p.role === role && p.module === module);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], [action]: !currentVal };
          return next;
        }
        return [...prev, { role, module, ...updated }];
      });

      onUpdated && onUpdated();
    } catch (err) {
      console.error('Failed to update permission:', err);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="table-wrapper">
      <table className="perm-table">
        <thead>
          <tr>
            <th>Role / Module</th>
            {MODULES.map((m) => (
              <th key={m} colSpan={3} style={{ borderLeft: '1px solid var(--border-color)' }}>
                {m}
              </th>
            ))}
          </tr>
          <tr>
            <th></th>
            {MODULES.flatMap((m) =>
              ACTIONS.map((a) => (
                <th key={`${m}-${a.key}`} style={{ fontSize: '0.65rem', color: 'var(--text-muted)', ...(a.key === 'canRead' && { borderLeft: '1px solid var(--border-color)' }) }}>
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
                  const val = getVal(role, module, action.key);
                  const key = `${role}:${module}:${action.key}`;
                  const isDisabled = role === 'ADMIN'; // Admin always has full access

                  return (
                    <td key={key} style={action.key === 'canRead' ? { borderLeft: '1px solid var(--border-color)' } : {}}>
                      <label className="toggle" title={`${role} – ${module} – ${action.label}`}>
                        <input
                          type="checkbox"
                          checked={val}
                          disabled={isDisabled || saving === key}
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
  );
}
