'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

/**
 * RoleGuard – wraps content that requires specific roles.
 * Usage: <RoleGuard roles={['ADMIN', 'ENGINEER']}>...</RoleGuard>
 * If 'redirect' is true, unauthorized users are sent to /dashboard.
 * Otherwise, the content is simply hidden.
 */
export default function RoleGuard({ roles, children, redirect = false, fallback = null }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!user) return null;

  const hasAccess = !roles || roles.includes(user.role);

  if (!hasAccess) {
    if (redirect) {
      router.push('/dashboard');
      return null;
    }
    return fallback || (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
        <div style={{ color: 'var(--text-muted)' }}>
          Access denied. Your role (<strong>{user.role}</strong>) does not have permission to view this section.
        </div>
      </div>
    );
  }

  return children;
}
