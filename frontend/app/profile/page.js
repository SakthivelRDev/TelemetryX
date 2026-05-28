'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../../components/AppLayout';
import RoleGuard from '../../components/RoleGuard';
import api from '../../lib/api';
import { MODULES, MODULE_CAPABILITIES } from '../../lib/moduleCapabilities';

function PermissionPill({ module, perms }) {
  const caps = MODULE_CAPABILITIES[module] || { actions: [], labels: {} };
  return (
    <div className="card" style={{ padding: '0.9rem 1rem' }}>
      <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>{module}</div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {caps.actions.map((action) => {
          const label = caps.labels?.[action] || action;
          const allowed = Boolean(perms?.[action]);
          const cls = allowed ? (action === 'canRead' ? 'badge-ok' : action === 'canWrite' ? 'badge-warning' : 'badge-critical') : 'badge-closed';
          return (
            <span key={action} className={`badge ${cls}`}>{label} {allowed ? 'Yes' : 'No'}</span>
          );
        })}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, permissions, canAccess, refreshSession } = useAuth();
  const canEdit = canAccess?.('PROFILE', 'canWrite') ?? false;
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
      }));
    }
  }, [user]);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      // Only send editable fields (name and password). Email is read-only here.
      const payload = { name: form.name };
      if (form.password) payload.password = form.password;
      await api.put('/api/auth/me', payload);
      await refreshSession?.();
      setForm((prev) => ({ ...prev, password: '' }));
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  // Build ordered permissions snapshot from the canonical MODULES list so it aligns with the permission matrix
  const effectivePermissions = MODULES.map((module) => ({ module, perms: permissions?.[module] || {} }));

  return (
    <AppLayout>
      <RoleGuard module="PROFILE" redirect>
        <div className="fade-in">
          <div className="page-header">
            <div className="flex-between">
              <div>
                <h1 className="page-title">◌ Profile</h1>
                <p className="page-subtitle">View and update your account details</p>
              </div>
            </div>
          </div>

          {success && <div className="alert alert-success">✓ {success}</div>}
          {error && <div className="alert alert-error">⚠ {error}</div>}
          {!canEdit && (
            <div className="alert alert-info">
              <span>ℹ</span>
              <span>Editing is disabled for your role. Please contact an administrator to request edit permissions.</span>
            </div>
          )}

          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Account Details</span>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="profile-name">Full Name</label>
                  <input id="profile-name" name="name" value={form.name} onChange={handleChange} placeholder="Your name" disabled={!canEdit} />
                </div>

                    <div className="form-group">
                      <label>Email</label>
                      <div style={{ padding: '0.55rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--bg-card)' }}>{form.email}</div>
                    </div>

                <div className="form-group">
                  <label htmlFor="profile-password">New Password</label>
                  <input id="profile-password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Leave blank to keep current password" disabled={!canEdit} />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Back</button>
                  <button type="submit" className="btn btn-primary" disabled={saving || !canEdit}>{saving ? 'Saving…' : 'Save Profile'}</button>
                </div>
              </form>
            </div>

            <div style={{ display: 'grid', gap: '1.25rem' }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Profile Summary</span>
                </div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>User ID</label>
                    <div className="value mono">{user?.id || '—'}</div>
                  </div>
                  <div className="detail-item">
                    <label>Role</label>
                    <div className="value"><span className={`badge badge-${user?.role?.toLowerCase()}`}>{user?.role}</span></div>
                  </div>
                  <div className="detail-item">
                    <label>Name</label>
                    <div className="value">{user?.name || '—'}</div>
                  </div>
                  <div className="detail-item">
                    <label>Email</label>
                    <div className="value">{user?.email || '—'}</div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Permissions Snapshot</span>
                </div>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {effectivePermissions.map((p) => (
                    <PermissionPill key={p.module} module={p.module} perms={p.perms} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </RoleGuard>
    </AppLayout>
  );
}