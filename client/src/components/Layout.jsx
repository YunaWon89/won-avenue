import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { LANGUAGES, LANGUAGE_NAMES, markLanguageChosen } from '../i18n';
import { api } from '../api/client';
import { Loading } from './ui';
import { LogoFull } from './Logo';
import ReviewPrompt from './ReviewPrompt';
import { AccessDenied } from '../pages/StatusPages';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const { user, setUser } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const change = (lng) => {
    setOpen(false);
    i18n.changeLanguage(lng);
    markLanguageChosen();
    // Persist to the profile too, so the choice follows the user across devices.
    if (user && user.preferredLanguage !== lng) {
      api.patch('/auth/me', { preferredLanguage: lng }).then((r) => setUser(r.data)).catch(() => {});
    }
  };
  return (
    <div className="lang-menu" ref={ref}>
      <button type="button" className="lang-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox" aria-label={t('nav.language')}>
        <span aria-hidden>🌐</span>{i18n.language.toUpperCase()}<span className="caret" aria-hidden>▾</span>
      </button>
      {open && (
        <ul className="dropdown lang-dropdown" role="listbox" aria-label={t('nav.language')}>
          {LANGUAGES.map((l) => (
            <li key={l} role="option" aria-selected={i18n.language === l}>
              <button type="button" className={i18n.language === l ? 'is-active' : ''} onClick={() => change(l)}>
                <span className="lang-code">{l.toUpperCase()}</span><span lang={l}>{LANGUAGE_NAMES[l]}</span>{i18n.language === l && <span className="check">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Light / dark theme switch (saved on this device; initial value set in index.html). */
export function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* ignore */ }
    setTheme(next);
  };
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'} title={theme === 'dark' ? 'Light' : 'Dark'}>
      <span aria-hidden style={{ fontSize: 19 }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
    </button>
  );
}

function UserMenu() {
  const { t } = useTranslation();
  const { user, logout, isCustomer } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="user-menu" ref={ref}>
      <button type="button" className="avatar-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
        <span className="hide-sm">{user.name}</span>
      </button>
      {open && (
        <div className="dropdown" role="menu">
          <div className="dropdown-head">
            <strong>{user.name}</strong>
            <span className="muted small">{t(`roles.${user.role}`)}</span>
          </div>
          <Link to="/profile" role="menuitem" onClick={() => setOpen(false)}>{t('nav.profile')}</Link>
          {isCustomer && <Link to="/orders" role="menuitem" onClick={() => setOpen(false)}>{t('nav.orders')}</Link>}
          <button type="button" role="menuitem" onClick={async () => { setOpen(false); await logout(); navigate('/'); }}>{t('nav.logout')}</button>
        </div>
      )}
    </div>
  );
}

function Header() {
  const { t } = useTranslation();
  const { user, isCustomer, isManager, isAdmin, isCourier } = useAuth();
  const { count } = useCart();
  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo" aria-label={t('app.name')}>
          <LogoFull height={64} />
        </Link>
        <nav className="header-nav hide-sm" aria-label="main">
          <NavLink to="/" end>{t('nav.home')}</NavLink>
          {isCustomer && <NavLink to="/orders">{t('nav.orders')}</NavLink>}
          {isManager && <NavLink to="/manage" end>{t('nav.manage')}</NavLink>}
          {isManager && <NavLink to="/manage/orders">{t('nav.manageOrders')}</NavLink>}
          {isCourier && <NavLink to="/courier">🛵 {t('nav.courier')}</NavLink>}
          {isAdmin && <NavLink to="/admin">{t('nav.admin')}</NavLink>}
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          <LanguageSwitcher />
          {(!user || isCustomer) && (
            <Link to="/cart" className="icon-btn cart-btn hide-sm" aria-label={t('nav.cart')} data-cart-target>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 6h15l-1.5 9h-12z" /><path d="M6 6 5 3H2" /><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /></svg>
              {count > 0 && <span className="cart-count">{count}</span>}
            </Link>
          )}
          {user ? <UserMenu /> : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">{t('nav.login')}</Link>
              <Link to="/register" className="btn btn-primary btn-sm hide-sm">{t('nav.register')}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

const Icon = ({ d }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);

/** App-style tab bar on phones. */
function BottomNav() {
  const { t } = useTranslation();
  const { user, isCustomer, isManager, isAdmin, isCourier } = useAuth();
  const { count } = useCart();
  const home = <Icon d={<><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /></>} />;
  const receipt = <Icon d={<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>} />;
  const bag = <Icon d={<><path d="M6 7h12l-1 13H7z" /><path d="M9 7a3 3 0 0 1 6 0" /></>} />;
  const person = <Icon d={<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>} />;
  const store = <Icon d={<><path d="M4 9 5.5 4h13L20 9" /><path d="M4 9h16v2a3 3 0 0 1-5.3 2 3 3 0 0 1-5.4 0A3 3 0 0 1 4 11z" /><path d="M5 13v7h14v-7" /></>} />;
  const shield = <Icon d={<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />} />;
  return (
    <nav className="bottom-nav show-sm" aria-label="tabs">
      <NavLink to="/" end>{home}<span>{t('nav.home')}</span></NavLink>
      {isManager && <NavLink to="/manage" end>{store}<span>{t('nav.manage')}</span></NavLink>}
      {isManager && <NavLink to="/manage/orders">{receipt}<span>{t('nav.manageOrders')}</span></NavLink>}
      {isCourier && <NavLink to="/courier"><span style={{ fontSize: 22 }} aria-hidden>🛵</span><span>{t('nav.courier')}</span></NavLink>}
      {isAdmin && <NavLink to="/admin">{shield}<span>{t('nav.admin')}</span></NavLink>}
      {(!user || isCustomer) && <NavLink to="/orders">{receipt}<span>{t('nav.orders')}</span></NavLink>}
      {(!user || isCustomer) && (
        <NavLink to="/cart" className="bn-cart" data-cart-target>{bag}{count > 0 && <span className="cart-count">{count}</span>}<span>{t('nav.cart')}</span></NavLink>
      )}
      <NavLink to={user ? '/profile' : '/login'}>{person}<span>{user ? t('nav.profile') : t('nav.login')}</span></NavLink>
    </nav>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="app">
      <Header />
      <main className="main" key={pathname}><Outlet /></main>
      <ReviewPrompt />
      <BottomNav />
    </div>
  );
}

/** Requires login; redirects to /login and comes back afterwards. */
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

/** Requires one of the given roles; shows Access denied otherwise. */
export function RoleRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!roles.includes(user.role)) return <AccessDenied />;
  return children;
}
