'use client';
import { useState, useEffect, useCallback } from 'react';
import RoleGuard from '../../components/RoleGuard';
import AppLayout from '../../components/AppLayout';
import PermissionsEditor from '../../components/PermissionsEditor';
import UserForm from '../../components/UserForm';
import api from '../../lib/api';

export default function UsersPage() {
  const [users, setUsers]           = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState('users');
  const [showForm, setShowForm]     = useState(false);
  const [editUser, setEditUser]     = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError]   = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

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
      <RoleGuard roles={['ADMIN']}>
      <div className="fade-in">
        <div className="page-header">
          <div className="flex-between">
            <div>
              <h1 className="page-title">👥 User Management</h1>
              <p className="page-subtitle">Manage users, roles, and module permissions</p>
            </div>
            {tab === 'users' && (
              <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditUser(null); setFormError(''); }} id="add-user-btn">
                + Add User
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <button className={`btn ${tab === 'users' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('users')} id="tab-users">Users</button>
          <button className={`btn ${tab === 'permissions' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('permissions')} id="tab-permissions">Permissions Matrix</button>
        </div>

        {loading ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : tab === 'users' ? (
          <div>
            {/* User Form Modal */}
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
                            <button className="btn btn-secondary btn-sm" onClick={() => { setEditUser(u); setShowForm(false); setFormError(''); }} id={`edit-user-${u.id}`}>Edit</button>
                            {deleteConfirm === u.id ? (
                              <>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id)} id={`confirm-delete-${u.id}`}>Confirm</button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirm(null)} id={`cancel-delete-${u.id}`}>Cancel</button>
                              </>
                            ) : (
                              <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(u.id)} id={`delete-user-${u.id}`}>Delete</button>
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
        ) : (
          <div className="card">
            <div className="card-header">
              <span className="card-title">🔐 RBAC Permissions Matrix</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Toggle permissions per role × module</span>
            </div>
            <PermissionsEditor permissions={permissions} onUpdated={fetchData} />
          </div>
        )}
      </div>
      </RoleGuard>
    </AppLayout>
  );
}
