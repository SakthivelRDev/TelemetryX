'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import RoleGuard from '../../components/RoleGuard';
import AppLayout from '../../components/AppLayout';
import PermissionsEditor from '../../components/PermissionsEditor';
import UserPermissionsEditor from '../../components/UserPermissionsEditor';
import UserForm from '../../components/UserForm';
import api from '../../lib/api';
import { Users, UserPlus, Lock, UserCog, Edit, Trash2, ChevronRight, AlertCircle } from 'lucide-react';

export default function UsersPage() {
  const { user, refreshSession } = useAuth();
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
  const [userPermDetail, setUserPermDetail]   = useState(null);
  const [loadingEffective, setLoadingEffective] = useState(false);
  const [permLoadError, setPermLoadError]     = useState('');

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
    if (!userId) {
      setUserPermDetail(null);
      setPermLoadError('');
      return;
    }
    setLoadingEffective(true);
    setPermLoadError('');
    try {
      const res = await api.get(`/api/users/permissions/user/${userId}`);
      setUserPermDetail(res.data);
    } catch (err) {
      console.error('User permissions load error:', err);
      setUserPermDetail(null);
      setPermLoadError(
        err?.response?.data?.error
        || 'Failed to load user permissions. Restart the backend (npx prisma generate && npm run dev).'
      );
    } finally {
      setLoadingEffective(false);
    }
  };

  const onPermissionsChanged = () => {
    fetchData();
    refreshSession?.();
    if (selectedUserId) loadUserPermissions(selectedUserId);
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

  return (
    <AppLayout>
      <RoleGuard module="USER" redirect>
      <div className="fade-in">
        <div className="page-header">
          <div className="flex-between">
            <div>
              <h1 className="page-title">
                <span className="page-title-icon"><Users size={22} /></span>
                User Management
              </h1>
              <p className="page-subtitle">Manage users, roles, and module permissions</p>
            </div>
            {tab === 'users' && user?.role === 'ADMIN' && (
              <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditUser(null); setFormError(''); }} id="add-user-btn">
                <UserPlus size={15} /> Add User
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          <button className={`tab-btn ${tab === 'users'       ? 'active' : ''}`} onClick={() => setTab('users')}       id="tab-users">
            <Users size={14} /> Users
          </button>
          <button className={`tab-btn ${tab === 'permissions' ? 'active' : ''}`} onClick={() => setTab('permissions')} id="tab-permissions">
            <Lock size={14} /> Permissions Matrix
          </button>
          <button className={`tab-btn ${tab === 'user-perms'  ? 'active' : ''}`} onClick={() => setTab('user-perms')}  id="tab-user-perms">
            <UserCog size={14} /> User Permissions
          </button>
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
                            <button className="btn btn-secondary btn-sm" onClick={() => { setEditUser(u); setShowForm(false); setFormError(''); }} id={`edit-user-${u.id}`}>
                              <Edit size={12} /> Edit
                            </button>
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
              <span className="card-title"><Lock size={15} /> RBAC Permissions Matrix</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Toggle permissions per role × module</span>
            </div>
            <div className="info-banner">
              <strong>How this works:</strong> Each role (Admin, Engineer, Viewer) has a set of permissions per module (Alarm, Map, API, User).
              Toggling a switch saves immediately to the database and takes effect for new requests by users of that role.
              Admin permissions are locked (always full access).
            </div>
            <PermissionsEditor
              permissions={permissions}
              onUpdated={onPermissionsChanged}
              canEdit={isAdmin}
            />
          </div>

        ) : (
          <div>
            <div className="info-banner">
              <strong>User-specific permissions:</strong> Overrides apply on top of the user&apos;s role.
              Example: grant a Viewer <em>API → View</em> without changing the VIEWER role for everyone.
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

            {permLoadError && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                ⚠️ {permLoadError}
              </div>
            )}

            {userPermDetail && (
              <div className="card fade-in">
                <div className="card-header">
                  <div>
                    <span className="card-title">
                      Permissions for <strong style={{ color: 'var(--accent-blue)' }}>{userPermDetail.user?.name}</strong>
                    </span>
                    <div style={{ marginTop: '0.25rem' }}>
                      <span className={`badge badge-${userPermDetail.user?.role?.toLowerCase()}`}>{userPermDetail.user?.role}</span>
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{userPermDetail.user?.email}</span>
                    </div>
                  </div>
                </div>
                <UserPermissionsEditor
                  userId={selectedUserId}
                  detail={userPermDetail}
                  canEdit={isAdmin}
                  onUpdated={onPermissionsChanged}
                />
              </div>
            )}
          </div>
        )}
      </div>
      </RoleGuard>
    </AppLayout>
  );
}
