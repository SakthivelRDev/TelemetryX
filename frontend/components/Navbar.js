'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard',      icon: '⬡', roles: ['ADMIN', 'ENGINEER', 'VIEWER'] },
  { href: '/alarms',    label: 'Alarms',          icon: '🔔', roles: ['ADMIN', 'ENGINEER'] },
  { href: '/map',       label: 'Network Map',     icon: '🗺', roles: ['ADMIN', 'ENGINEER', 'VIEWER'] },
  { href: '/sources',   label: 'API Sources',     icon: '⚡', roles: ['ADMIN', 'ENGINEER'] },
  { href: '/users',     label: 'User Management', icon: '👥', roles: ['ADMIN'] },
];

export default function Navbar() {
  const pathname          = usePathname();
  const { user, logout }  = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const initials     = user.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <nav className="navbar">
      {/* Brand + Theme Toggle */}
      <div className="navbar-brand">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="navbar-logo">App360</div>
            <div className="navbar-tagline">Network Operations Center</div>
          </div>
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            id="theme-toggle"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="nav-links">
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 0.875rem', marginBottom: '0.5rem' }}>
          Navigation
        </div>
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${pathname.startsWith(item.href) ? 'active' : ''}`}
            id={`nav-${item.href.replace('/', '')}`}
          >
            <span className="nav-link-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      {/* User Footer */}
      <div className="navbar-footer">
        <div className="user-info">
          <div className="user-avatar">{initials}</div>
          <div>
            <div className="user-name">{user.name}</div>
            <div className="user-role">
              <span className={`badge badge-${user.role?.toLowerCase()}`} style={{ fontSize: '0.6rem', padding: '0.1rem 0.5rem' }}>{user.role}</span>
            </div>
          </div>
        </div>
        <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={logout} id="logout-btn">
          ↩ Sign Out
        </button>
      </div>
    </nav>
  );
}
