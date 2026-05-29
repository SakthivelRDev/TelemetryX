'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard,
  BellRing,
  Map,
  Plug,
  Users,
  UserCircle,
  Sun,
  Moon,
  LogOut,
  Activity,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard',      Icon: LayoutDashboard, module: 'ALARM'   },
  { href: '/alarms',    label: 'Alarms',          Icon: BellRing,        module: 'ALARM'   },
  { href: '/map',       label: 'Network Map',     Icon: Map,             module: 'MAP'     },
  { href: '/sources',   label: 'API Sources',     Icon: Plug,            module: 'API'     },
  { href: '/users',     label: 'User Management', Icon: Users,           module: 'USER'    },
  { href: '/profile',   label: 'Profile',         Icon: UserCircle,      module: 'PROFILE' },
];

export default function Navbar() {
  const pathname              = usePathname();
  const { user, logout, canAccess } = useAuth();
  const { theme, toggleTheme }      = useTheme();

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter((item) => !item.module || canAccess(item.module, 'canRead'));
  const initials     = user.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <nav className="navbar">
      {/* Brand */}
      <div className="navbar-brand">
        <div className="navbar-logo-row">
          <div>
            <div className="navbar-logo">
              <Activity size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} />
              App360
            </div>
            <div className="navbar-tagline">Network Operations Center</div>
          </div>
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            id="theme-toggle"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark'
              ? <Sun size={14} />
              : <Moon size={14} />
            }
          </button>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="nav-links">
        <div className="nav-section-label">Navigation</div>
        {visibleItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${active ? 'active' : ''}`}
              id={`nav-${item.href.replace('/', '')}`}
            >
              <span className="nav-link-icon">
                <item.Icon size={16} strokeWidth={active ? 2.5 : 2} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="navbar-footer">
        <div className="user-info">
          <div className="user-avatar">{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name}
            </div>
            <div className="user-role">
              <span className={`badge badge-${user.role?.toLowerCase()}`} style={{ fontSize: '0.6rem', padding: '0.08rem 0.45rem' }}>
                {user.role}
              </span>
            </div>
          </div>
        </div>

        <div className="navbar-footer-actions">
          <Link
            href="/profile"
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', justifyContent: 'center' }}
            id="profile-btn"
          >
            <UserCircle size={14} />
            Profile
          </Link>
          <button
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={logout}
            id="logout-btn"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
