'use client';
import { useState } from 'react';

const ROLES = ['ADMIN', 'ENGINEER', 'VIEWER'];

export default function UserForm({ onSubmit, onCancel, loading, error, initialData = null }) {
  const [form, setForm] = useState({
    name:     initialData?.name     || '',
    email:    initialData?.email    || '',
    password: '',
    role:     initialData?.role     || 'VIEWER',
  });

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    if (!data.password && initialData) delete data.password; // Don't send empty password on edit
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">⚠ {error}</div>}

      <div className="form-group">
        <label htmlFor="user-name">Full Name</label>
        <input id="user-name" name="name" type="text" value={form.name} onChange={handleChange} required placeholder="e.g. John Smith" />
      </div>

      <div className="form-group">
        <label htmlFor="user-email">Email Address</label>
        <input id="user-email" name="email" type="email" value={form.email} onChange={handleChange} required placeholder="user@app360.com" />
      </div>

      <div className="form-group">
        <label htmlFor="user-password">{initialData ? 'New Password (leave blank to keep current)' : 'Password'}</label>
        <input id="user-password" name="password" type="password" value={form.password} onChange={handleChange} required={!initialData} placeholder="••••••••" />
      </div>

      <div className="form-group">
        <label htmlFor="user-role">Role</label>
        <select id="user-role" name="role" value={form.role} onChange={handleChange}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} id="user-form-cancel">
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading} id="user-form-submit">
          {loading ? 'Saving…' : initialData ? 'Update User' : 'Create User'}
        </button>
      </div>
    </form>
  );
}
