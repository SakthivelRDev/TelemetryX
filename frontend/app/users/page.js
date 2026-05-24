'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import RoleGuard from '../../components/RoleGuard';
import AppLayout from '../../components/AppLayout';
import PermissionsEditor from '../../components/PermissionsEditor';
import UserForm from '../../components/UserForm';
import api from '../../lib/api';

const MODULES  = ['ALARM', 'MAP', 'API', 'USER'];
const ACTIONS  = ['canRead', 'canWrite', 'canDelete'];
const ACT_LABELS = { canRead: 'READ', canWrite: 'WRITE', canDelete: 'DELETE' };

/**
 * Convert permissions array [{role, module, canRead, canWrite, canDelete}, ...]
 * OR permissions object { ALARM: {...}, MAP: {...} }
 * into a unified { MODULE: { canRead, canWrite, canDelete } } map.
 */
function buildPermMap(perms) {
  if (!perms) return {};
  // If it's already an object keyed by module name (from login/me)
  if (!Array.isArray(perms)) return perms;
  // If it's an array (from /permissions/user/:id)
  const map = {};
  perms.forEach((p) => {
    map[p.module] = { canRead: Boolean(p.canRead), canWrite: Boolean(p.canWrite), canDelete: Boolean(p.canDelete) };
  });
  return map;
}

export default function UsersPage() {
  const { user } = useAuth();
  const isAdmin  = user?.role === 'ADMIN';
  const [users, setUsers]           = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState('users');
  const [showForm, setShowForm]     = useState(false);
  const [editUser, setEditUser]     = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError]   = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Per-user permissions
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userEffective, setUserEffective]   = useState(null);
  const [loadingEffective, setLoadingEffective] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, permsRes] = await Promise.all([
        api.get('/api/users'),
        api.get('/api/users/permissions/all'),
      ]);
      setUsers(usersRes.data.users || []);
      setPermissions(permsRes.data.permissions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load effective permissions for selected user
  const loadUserPermissions = async (userId) => {
    if (!userId) { setUserEffective(null); return; }
    setLoadingEffective(true);
    try {
      const res = await api.get(`/api/users/permissions/user/${userId}`);
      setUserEffective(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEffective(false);
    }
  };

  const handleCreate = async (data) => {
    setFormLoading(true);
    setFormError('');
    try {
      await api.post('/api/users', data);
      setShowForm(false);
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdate = async (data) => {
    setFormLoading(true);
    setFormError('');
    try {
      await api.put(`/api/users/${editUser.id}`, data);
      setEditUser(null);
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to update user');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/users/${id}`);
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Build a quick-lookup map from permissions array for the user effective view
  function buildPermMap(permsArray) {
    const map = {};
    for (const p of (permsArray || [])) {
      map[p.module] = p;
    }
    return map;
  }

  return (
    <AppLayout>
      <RoleGuard module="USER" redirect>
      <div className="fade-in">
        <div className="page-header">
          <div className="flex-between">
            <div>
              <h1 className="page-title">👥 User Management</h1>
              <p className="page-subtitle">Manage users, roles, and module permissions</p>
            </div>
            {tab === 'users' && user?.role === 'ADMIN' && (
              <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditUser(null); setFormError(''); }} id="add-user-btn">
                + Add User
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <button className={`btn ${tab === 'users'       ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('users')}       id="tab-users">Users</button>
          <button className={`btn ${tab === 'permissions' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('permissions')} id="tab-permissions">Permissions Matrix</button>
          <button className={`btn ${tab === 'user-perms'  ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('user-perms')}  id="tab-user-perms">User Permissions</button>
        </div>

        {loading ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : tab === 'users' ? (
          <div>
            {/* User Form */}
            {(showForm || editUser) && (
              <div className="card fade-in" style={{ marginBottom: '1.25rem', borderColor: 'var(--accent-blue)' }}>
                <div className="card-header">
                  <span className="card-title">{editUser ? 'Edit User' : 'Create New User'}</span>
                </div>
                <UserForm
                  onSubmit={editUser ? handleUpdate : handleCreate}
                  onCancel={() => { setShowForm(false); setEditUser(null); setFormError(''); }}
                  loading={formLoading}
                  error={formError}
                  initialData={editUser}
                />
              </div>
            )}

            {/* Users Table */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">All Users ({users.length})</span>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} id={`user-row-${u.id}`}>
                        <td style={{ fontWeight: 500 }}>{u.name}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                        <td><span className={`badge badge-${u.role?.toLowerCase()}`}>{u.role}</span></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {isAdmin ? (
                              <>
                                <button className="btn btn-secondary btn-sm" onClick={() => { setEditUser(u); setShowForm(false); setFormError(''); }} id={`edit-user-${u.id}`}>Edit</button>
                                {deleteConfirm === u.id ? (
                                  <>
                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id)} id={`confirm-delete-${u.id}`}>Confirm</button>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirm(null)} id={`cancel-delete-${u.id}`}>Cancel</button>
                                  </>
                                ) : (
                                  <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(u.id)} id={`delete-user-${u.id}`}>Delete</button>
                                )}
                              </>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>View Only</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        ) : tab === 'permissions' ? (
          <div className="card">
            <div className="card-header">
              <span className="card-title">🔐 RBAC Permissions Matrix</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Toggle permissions per role × module</span>
            </div>
            <div className="info-banner">
              <strong>How this works:</strong> Each role (Admin, Engineer, Viewer) has a set of permissions per module (Alarm, Map, API, User).
              Toggling a switch saves immediately to the database and takes effect for new requests by users of that role.
              Admin permissions are locked (always full access).
            </div>
            <PermissionsEditor
              permissions={permissions}
              onUpdated={fetchData}
              canEdit={isAdmin}
            />
          </div>

        ) : (
          /* ── User-Specific Permissions View ── */
          <div>
            <div className="info-banner">
              <strong>User Permissions:</strong> Select a user to see their <em>effective permissions</em> — inherited from their assigned role.
              To change a user&apos;s permissions, change their role or edit the role&apos;s permissions in the <strong>Permissions Matrix</strong> tab.
            </div>

            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <div className="card-header">
                <span className="card-title">👤 Select User</span>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <select
                  value={selectedUserId}
                  onChange={(e) => { setSelectedUserId(e.target.value); loadUserPermissions(e.target.value); }}
                  style={{ maxWidth: 280 }}
                  id="user-permissions-select"
                >
                  <option value="">— Select a user —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
                {loadingEffective && <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />}
              </div>
            </div>

            {userEffective && (
              <div className="card fade-in">
                <div className="card-header">
                  <div>
                    <span className="card-title">
                      Effective Permissions for <strong style={{ color: 'var(--accent-blue)' }}>{userEffective.user?.name}</strong>
                    </span>
                    <div style={{ marginTop: '0.25rem' }}>
                      <span className={`badge badge-${userEffective.user?.role?.toLowerCase()}`}>{userEffective.user?.role}</span>
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{userEffective.user?.email}</span>
                    </div>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table className="perm-table">
                    <thead>
                      <tr>
                        <th>MODULE</th>
                        {ACTIONS.map((a) => <th key={a}>{ACT_LABELS[a]}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map((mod) => {
                        const permMap = buildPermMap(userEffective.permissions);
                        const perm    = permMap[mod] || {};
                        return (
                          <tr key={mod}>
                            <td>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{mod}</span>
                            </td>
                            {ACTIONS.map((action) => (
                              <td key={action}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 28, height: 28,
                                  borderRadius: '50%',
                                  background: perm[action]
                                    ? 'rgba(16,185,129,0.15)'
                                    : 'rgba(71,85,105,0.15)',
                                  border: perm[action]
                                    ? '1px solid rgba(16,185,129,0.4)'
                                    : '1px solid rgba(71,85,105,0.3)',
                                  fontSize: '0.85rem',
                                }}>
                                  {perm[action] ? '✅' : '—'}
                                </span>
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  💡 <strong>Tip:</strong> To modify permissions for this user, change their role in the <em>Users</em> tab or edit the {userEffective.user?.role} role permissions in the <em>Permissions Matrix</em> tab.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </RoleGuard>
    </AppLayout>
  );
}
