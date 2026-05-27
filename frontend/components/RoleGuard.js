'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

/**
 * RoleGuard – page access by DB permissions or legacy role list.
 * Usage: <RoleGuard module="USER" redirect>...</RoleGuard>
 *        <RoleGuard roles={['ADMIN']}>...</RoleGuard>
 */
export default function RoleGuard({ roles, module, action = 'canRead', children, redirect = false, fallback = null }) {
  const { user, loading, canAccess } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user && module && redirect && !canAccess(module, action)) {
      router.replace('/dashboard');
    }
  }, [user, loading, module, action, redirect, canAccess, router]);

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!user) return null;

  const hasAccess = module
    ? canAccess(module, action)
    : (!roles || roles.includes(user.role));

  if (!hasAccess) {
    if (redirect) return null;
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
