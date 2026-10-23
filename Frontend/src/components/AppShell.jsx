import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTracker } from '../context/TrackerContext.jsx';
import { Avatar, Logo } from './ui.jsx';

const GROUPS = [
  { id: 'learn', label: 'Learn' },
  { id: 'jobs', label: 'Job search' },
  { id: 'library', label: 'Library' },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const { status, data, error, reload } = useTracker();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setMenuOpen(false), [pathname]);

  // "3/17" style progress next to each checklist in the sidebar.
  const progress = useMemo(() => {
    if (!data) return {};
    return Object.fromEntries(
      data.sheets
        .filter((s) => s.statusSet && data.statusSets[s.statusSet].checkable)
        .map((s) => {
          const done = data.statusSets[s.statusSet].done;
          return [s.key, `${s.rows.filter((r) => r.values.status === done).length}/${s.rows.length}`];
        }),
    );
  }, [data]);

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand"><Logo size={26} /> Skill Trail</span>
        <button type="button" className="menu-button" aria-expanded={menuOpen} aria-controls="sidebar" onClick={() => setMenuOpen((o) => !o)}>
          {menuOpen ? 'Close' : 'Menu'}
        </button>
      </header>

      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

      <aside id="sidebar" className={`sidebar${menuOpen ? ' is-open' : ''}`}>
        <div className="brand brand-desktop"><Logo /> Skill Trail</div>

        <nav aria-label="Main">
          <NavLink to="/" end className="nav-link">Dashboard</NavLink>
          {data &&
            GROUPS.map((group) => (
              <div key={group.id} className="nav-group">
                <p className="nav-heading">{group.label}</p>
                {data.sheets
                  .filter((s) => s.group === group.id)
                  .map((s) => (
                    <NavLink key={s.key} to={`/sheet/${s.key}`} className="nav-link">
                      <span>{s.title}</span>
                      {progress[s.key] && <span className="nav-count">{progress[s.key]}</span>}
                    </NavLink>
                  ))}
              </div>
            ))}
        </nav>

        <div className="account">
          <Avatar user={user} />
          <div className="account-text">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button type="button" className="link-button" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <main className="main" id="main">
        {status === 'loading' && <p className="state-message">Loading your tracker…</p>}
        {status === 'error' && (
          <div className="state-message">
            <p>{error}</p>
            <button type="button" className="button" onClick={reload}>Try again</button>
          </div>
        )}
        {status === 'ready' && <Outlet />}
      </main>
    </div>
  );
}
