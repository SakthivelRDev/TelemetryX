'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '../lib/api';
import { getToken, setToken, removeToken, getUser, setUser, removeUser } from '../lib/auth';
import { EMPTY_PERMISSIONS, canAccessModule } from '../lib/permissions';

const PERMS_KEY = 'app360_permissions';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUserState]           = useState(null);
  const [permissions, setPermissions] = useState(EMPTY_PERMISSIONS);
  const [loading, setLoading]         = useState(true);
  const router = useRouter();

  const savePermissions = (perms) => {
    setPermissions(perms || EMPTY_PERMISSIONS);
    if (typeof window !== 'undefined') {
      localStorage.setItem(PERMS_KEY, JSON.stringify(perms || EMPTY_PERMISSIONS));
    }
  };

  const loadStoredPermissions = () => {
    if (typeof window === 'undefined') return EMPTY_PERMISSIONS;
    try {
      const raw = localStorage.getItem(PERMS_KEY);
      return raw ? JSON.parse(raw) : EMPTY_PERMISSIONS;
    } catch {
      return EMPTY_PERMISSIONS;
    }
  };

  const refreshSession = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUserState(null);
      setPermissions(EMPTY_PERMISSIONS);
      return;
    }
    try {
      const res = await api.get('/api/auth/me');
      setUserState(res.data.user);
      setUser(res.data.user);
      savePermissions(res.data.permissions);
    } catch {
      removeToken();
      removeUser();
      if (typeof window !== 'undefined') localStorage.removeItem(PERMS_KEY);
      setUserState(null);
      setPermissions(EMPTY_PERMISSIONS);
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    const storedUser = getUser();
    if (token && storedUser) {
      setUserState(storedUser);
      setPermissions(loadStoredPermissions());
      refreshSession();
    }
    setLoading(false);
  }, [refreshSession]);

  const login = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    const { token, user: userData, permissions: perms } = res.data;
    setToken(token);
    setUser(userData);
    setUserState(userData);
    savePermissions(perms);
    return userData;
  };

  const logout = async () => {
    try { await api.post('/api/auth/logout'); } catch {}
    removeToken();
    removeUser();
    if (typeof window !== 'undefined') localStorage.removeItem(PERMS_KEY);
    setUserState(null);
    setPermissions(EMPTY_PERMISSIONS);
    router.push('/login');
  };

  const hasRole = (...roles) => user && roles.includes(user.role);

  const canAccess = (module, action = 'canRead') =>
    canAccessModule(permissions, module, action, user?.role);

  return (
    <AuthContext.Provider value={{ user, permissions, loading, login, logout, hasRole, canAccess, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
