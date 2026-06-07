import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { auth } from '../api.js';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '⊞', exact: true },
  { to: '/reservations', label: 'Reserveringen', icon: '📋' },
  { to: '/walk-in', label: 'Direct uitleen', icon: '⚡' },
  { to: '/waitlist', label: 'Wachtlijst', icon: '⏳' },
];
const NAV_ADMIN = [
  { to: '/articles', label: 'Bad beheer', icon: '🛁' },
  { to: '/users', label: 'Gebruikers', icon: '👥' },
  { to: '/settings', label: 'Instellingen', icon: '⚙️' },
];

export default function Layout({ children }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleLogout() {
    await auth.logout().catch(() => {});
    setUser(null);
    navigate('/login');
  }

  const initials = user ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';

  return (
    <div className="app-layout">
      {/* Mobile header */}
      <div className="mobile-header">
        <button className="hamburger-btn" onClick={() => setSidebarOpen(o => !o)}
          data-testid="hamburger-btn" aria-label="Menu openen">
          <div className="hamburger-icon"><span /><span /><span /></div>
        </button>
        <div className="mobile-logo">
          <img src="/logo_small.jpg" alt="'t Hart" className="mobile-logo-img" />
          <span>'t Hart Verhuur</span>
        </div>
        <div className="mobile-avatar">{initials}</div>
      </div>

      {/* Sidebar */}
      <nav className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`} data-testid="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo-row">
            <img src="/logo_small.jpg" alt="'t Hart" className="sidebar-logo-img" />
            <div>
              <div className="sidebar-logo-text">'T HART</div>
              <div className="sidebar-logo-sub">Verhuurdashboard</div>
            </div>
          </div>
        </div>

        <div className="sidebar-nav">
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.exact}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              onClick={() => setSidebarOpen(false)}
              data-testid={`nav-${item.to.replace('/', '') || 'home'}`}>
              <span className="sidebar-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
          {user?.role === 'ADMIN' && (
            <>
              <div className="sidebar-section-label">Beheer</div>
              {NAV_ADMIN.map(item => (
                <NavLink key={item.to} to={item.to}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                  data-testid={`nav-${item.to.replace('/', '')}`}>
                  <span className="sidebar-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-role">{user?.role === 'ADMIN' ? 'Beheerder' : 'Assistent'}</div>
            </div>
          </div>
          <button className="sidebar-logout-btn" onClick={handleLogout}
            data-testid="logout-btn" title="Uitloggen">↩</button>
        </div>
      </nav>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="main-content" data-testid="main-content">
        {children}
      </main>
    </div>
  );
}
