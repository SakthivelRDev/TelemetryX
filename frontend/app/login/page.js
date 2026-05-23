'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login }   = useAuth();
  const router      = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (role) => {
    const creds = {
      ADMIN:    { email: 'admin@app360.com',    password: 'admin123' },
      ENGINEER: { email: 'engineer@app360.com', password: 'eng123'   },
      VIEWER:   { email: 'viewer@app360.com',   password: 'view123'  },
    };
    setEmail(creds[role].email);
    setPassword(creds[role].password);
  };

  return (
    <div className="login-page">
      <div className="login-card fade-in">
        <div className="login-logo">
          <div className="login-logo-text">⬡ App360</div>
          <div className="login-subtitle">Network Operations Center</div>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">⚠ {error}</div>}

          <div className="form-group">
            <label htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@app360.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} id="login-submit" style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        {/* Quick Login Shortcuts */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem', textAlign: 'center' }}>
            Quick Login (Demo)
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['ADMIN', 'ENGINEER', 'VIEWER'].map((role) => (
              <button key={role} onClick={() => quickLogin(role)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem', padding: '0.4rem' }} id={`quick-login-${role.toLowerCase()}`}>
                <span className={`badge badge-${role.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>{role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
