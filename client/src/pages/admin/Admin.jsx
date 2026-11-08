import { useState } from 'react';
import ReviewText from '../../components/ReviewText';
import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useApi, useQueryState } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useMeta } from '../../context/MetaContext';
import { Thumb } from '../../components/Cards';
import {
  Alert, Badge, ConfirmDialog, EmptyState, ErrorState, Input, Loading, Modal, PageHeader, Pagination, Rating, Select, Spinner, Stars, StatusBadge,
} from '../../components/ui';
import { apiErrorMessage, rules, validate } from '../../utils/validation';
import { dateOnly, won } from '../../utils/format';

export function AdminTabs() {
  const { t } = useTranslation();
  const links = [['/admin', 'admin.stats'], ['/admin/users', 'admin.users'], ['/admin/restaurants', 'admin.restaurants'], ['/admin/dishes', 'admin.dishes'], ['/manage/orders', 'admin.orders'], ['/admin/reviews', 'admin.reviews']];
  return (
    <nav className="sub-nav" aria-label={t('admin.title')}>
      {links.map(([to, key]) => <NavLink key={to} to={to} end>{t(key)}</NavLink>)}
    </nav>
  );
}

function DemoReset({ onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const reset = async () => {
    setBusy(true);
    try {
      await api.post('/admin/demo/reset');
      try { localStorage.removeItem('cart.v1'); } catch { /* ignore */ }
      toast.success(t('admin.demoResetDone'));
      setOpen(false);
      onDone();
    } catch (err) { toast.error(apiErrorMessage(t, err)); } finally { setBusy(false); }
  };
  return (
    <section className="card pad demo-card">
      <div className="grow">
        <h2 className="section-title">🎬 {t('admin.demoTitle')}</h2>
        <p className="muted small">{t('admin.demoText')}</p>
      </div>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>↺ {t('admin.demoReset')}</button>
      <ConfirmDialog open={open} title={t('admin.demoReset')} text={t('admin.demoResetConfirm')} busy={busy} onCancel={() => setOpen(false)} onConfirm={reset} />
    </section>
  );
}

export function AdminDashboard() {
  const { t } = useTranslation();
  const meta = useMeta();
  const { data, error, reload } = useApi(() => api.get('/admin/stats'), []);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const s = data.data;
  const tiles = [
    [t('admin.revenue'), won(s.revenue), 'accent'], [t('admin.ordersToday'), s.ordersToday], [t('admin.orders'), s.orders],
    [t('admin.users'), `${s.users}`], [t('roles.manager'), s.managers], [t('admin.restaurants'), `${s.activeRestaurants} / ${s.restaurants}`],
    [t('admin.pendingRestaurants'), s.pendingRestaurants, s.pendingRestaurants ? 'warn' : ''], [t('admin.reviews'), s.reviews],
    [t('admin.newDishes'), s.newDishes, s.newDishes ? 'warn' : ''],
  ];
  return (
    <div className="container">
      <PageHeader title={t('admin.title')} />
      <AdminTabs />
      <div className="stat-grid">
        {tiles.map(([label, value, tone]) => (
          <div key={label} className="card stat"><span className="stat-label">{label}</span><strong className={`stat-value ${tone || ''}`}>{value}</strong></div>
        ))}
      </div>
      <section className="card pad">
        <h2 className="section-title">{t('orders.track')}</h2>
        <div className="status-bars">
          {Object.entries(s.ordersByStatus).map(([status, count]) => (
            <div key={status} className="status-bar">
              <StatusBadge status={status} />
              <div className="bar"><span style={{ width: `${(count / Math.max(1, s.orders)) * 100}%` }} /></div>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </section>
      {s.newDishes > 0 && (
        <Link to="/admin/dishes" className="btn btn-secondary" style={{ marginBottom: 12 }}>🍽️ {t('admin.newDishes')}: {s.newDishes} →</Link>
      )}
      {meta.demoMode && <DemoReset onDone={() => reload()} />}
      {s.pendingRestaurants > 0 && (
        <Link to="/admin/restaurants?isActive=false" className="btn btn-secondary">🏪 {t('admin.pendingRestaurants')}: {s.pendingRestaurants} →</Link>
      )}
    </div>
  );
}

function CreateUserModal({ open, onClose, onCreated }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [v, setV] = useState({ name: '', email: '', password: '', role: 'manager' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const errs = validate({ name: [rules.required, rules.name], email: [rules.required, rules.email], password: [rules.required, rules.password] }, v);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try { await api.post('/admin/users', v); toast.success(t('common.saved')); onCreated(); onClose(); } catch (err) { setErrors(err.fieldErrors || {}); toast.error(apiErrorMessage(t, err)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('admin.createUser')}
      footer={<button type="submit" form="create-user" className="btn btn-primary" disabled={busy}>{busy ? <Spinner size={16} /> : t('common.create')}</button>}>
      <form id="create-user" className="stack" onSubmit={submit} noValidate>
        <Input label={t('auth.name')} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={errors.name} required />
        <Input label={t('auth.email')} type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} error={errors.email} required />
        <Input label={t('auth.password')} type="password" value={v.password} hint={t('auth.passwordHint')} onChange={(e) => setV({ ...v, password: e.target.value })} error={errors.password} required />
        <Select label={t('admin.role')} value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>
          {['customer', 'manager', 'courier', 'admin'].map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
        </Select>
      </form>
    </Modal>
  );
}

export function AdminUsers() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user: me } = useAuth();
  const [q, setQ] = useQueryState({ search: '', role: '', isActive: '', page: 1 });
  const [creating, setCreating] = useState(false);
  const { data, error, loading, reload } = useApi(() => api.get('/admin/users', { ...q, limit: 15 }), [JSON.stringify(q)]);

  const update = async (u, patch) => {
    try { await api.patch(`/admin/users/${u.id}`, patch); toast.success(t('admin.userUpdated')); reload({ quiet: true }); } catch (err) { toast.error(apiErrorMessage(t, err)); }
  };

  return (
    <div className="container">
      <PageHeader title={t('admin.users')} actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ {t('admin.createUser')}</button>} />
      <AdminTabs />
      <div className="filters-panel card pad">
        <input type="search" className="input input-sm grow" placeholder={`${t('auth.name')} / ${t('auth.email')}`} defaultValue={q.search}
          onKeyDown={(e) => e.key === 'Enter' && setQ({ search: e.currentTarget.value })} onBlur={(e) => setQ({ search: e.target.value })} aria-label={t('common.search')} />
        <select className="input select input-sm" value={q.role} onChange={(e) => setQ({ role: e.target.value })} aria-label={t('admin.role')}>
          <option value="">{t('admin.role')}: {t('common.all')}</option>
          {['customer', 'manager', 'courier', 'admin'].map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
        </select>
        <select className="input select input-sm" value={q.isActive} onChange={(e) => setQ({ isActive: e.target.value })} aria-label={t('common.status')}>
          <option value="">{t('common.status')}: {t('common.all')}</option>
          <option value="true">{t('common.active')}</option>
          <option value="false">{t('common.inactive')}</option>
        </select>
      </div>
      {error ? <ErrorState error={error} onRetry={reload} /> : !data ? <Loading /> : (
        <>
          <p className="muted small">{t('common.results', { count: data.totalCount })}</p>
          <div className={`table-wrap card ${loading ? 'is-loading' : ''}`}>
            <table className="table">
              <thead><tr><th>{t('auth.name')}</th><th>{t('auth.email')}</th><th>{t('admin.role')}</th><th>{t('nav.manage')}</th><th>{t('admin.joined')}</th><th>{t('common.status')}</th></tr></thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td data-label={t('auth.name')}><strong>{u.name}</strong></td>
                    <td data-label={t('auth.email')}>{u.email}</td>
                    <td data-label={t('admin.role')}>
                      <select className="input select input-sm" value={u.role} disabled={u.id === me.id} onChange={(e) => update(u, { role: e.target.value })} aria-label={t('admin.role')}>
                        {['customer', 'manager', 'courier', 'admin'].map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
                      </select>
                    </td>
                    <td data-label={t('nav.manage')} className="small">{u.restaurants.map((r) => r.name).join(', ') || (u.role === 'customer' ? `${t('admin.ordersCount')}: ${u.orderCount}` : '—')}</td>
                    <td data-label={t('admin.joined')} className="small">{dateOnly(u.createdAt)}</td>
                    <td data-label={t('common.status')}>
                      <button type="button" className={`btn btn-sm ${u.isActive ? 'btn-ghost' : 'btn-secondary'}`} disabled={u.id === me.id} onClick={() => update(u, { isActive: !u.isActive })}>
                        {u.isActive ? `✓ ${t('common.active')}` : t('admin.activate')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={(page) => setQ({ page })} />
        </>
      )}
      <CreateUserModal open={creating} onClose={() => setCreating(false)} onCreated={() => reload({ quiet: true })} />
    </div>
  );
}

export function AdminRestaurants() {
  const { t } = useTranslation();
  const toast = useToast();
  const [q, setQ] = useQueryState({ search: '', isActive: '', sort: 'newest', page: 1 });
  const [deleting, setDeleting] = useState(null);
  const { data, error, loading, reload } = useApi(() => api.get('/restaurants', { ...q, limit: 12 }), [JSON.stringify(q)]);
  const managers = useApi(() => api.get('/admin/users', { role: 'manager', limit: 50 }), []);

  const patch = async (r, body) => {
    try { await api.patch(`/restaurants/${r.id}`, body); toast.success(t('manage.restaurantSaved')); reload({ quiet: true }); } catch (err) { toast.error(apiErrorMessage(t, err)); }
  };
  const remove = async () => {
    try { const res = await api.delete(`/restaurants/${deleting.id}`); toast.success(res.deleted ? t('manage.deleted') : t('common.inactive')); reload({ quiet: true }); } catch (err) { toast.error(apiErrorMessage(t, err)); }
    setDeleting(null);
  };

  return (
    <div className="container">
      <PageHeader title={t('admin.restaurants')} actions={<Link to="/admin/restaurants/new" className="btn btn-primary btn-sm">+ {t('manage.addRestaurant')}</Link>} />
      <AdminTabs />
      <div className="filters-panel card pad">
        <input type="search" className="input input-sm grow" placeholder={t('home.searchPlaceholder')} defaultValue={q.search}
          onKeyDown={(e) => e.key === 'Enter' && setQ({ search: e.currentTarget.value })} onBlur={(e) => setQ({ search: e.target.value })} aria-label={t('common.search')} />
        <select className="input select input-sm" value={q.isActive} onChange={(e) => setQ({ isActive: e.target.value })} aria-label={t('common.status')}>
          <option value="">{t('common.status')}: {t('common.all')}</option>
          <option value="true">{t('common.active')}</option>
          <option value="false">{t('admin.pendingRestaurants')} / {t('common.inactive')}</option>
        </select>
        <select className="input select input-sm" value={q.sort} onChange={(e) => setQ({ sort: e.target.value })} aria-label={t('common.sortBy')}>
          {['newest', 'rating', 'name'].map((s) => <option key={s} value={s}>{t(`home.sort.${s}`)}</option>)}
        </select>
      </div>
      {error ? <ErrorState error={error} onRetry={reload} /> : !data ? <Loading /> : data.items.length === 0 ? <EmptyState title={t('common.empty')} /> : (
        <>
          <div className={`stack-sm ${loading ? 'is-loading' : ''}`}>
            {data.items.map((r) => (
              <article key={r.id} className="card pad admin-restaurant">
                <Thumb src={r.imageUrl} cuisine={r.cuisineType} className="thumb-sm" />
                <div className="grow">
                  <div className="row gap-sm wrap">
                    <Link to={`/restaurants/${r.id}`}><strong>{r.name}</strong></Link>
                    {r.isActive ? <Badge tone="green">{t('common.active')}</Badge> : <Badge tone="amber">{t('common.inactive')}</Badge>}
                  </div>
                  <p className="small muted">{t(`cuisine.${r.cuisineType}`, { defaultValue: r.cuisineType })} · <Rating value={r.averageRating} count={r.reviewCount} /></p>
                </div>
                <select className="input select input-sm" value={r.managerId || ''} onChange={(e) => patch(r, { managerId: e.target.value || null })} aria-label={t('admin.assignManager')}>
                  <option value="">{t('manage.manager')}: {t('manage.unassigned')}</option>
                  {(managers.data?.items || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <div className="row gap-sm">
                  <button type="button" className={`btn btn-sm ${r.isActive ? 'btn-ghost' : 'btn-primary'}`} onClick={() => patch(r, { isActive: !r.isActive })}>
                    {r.isActive ? t('admin.deactivate') : t('admin.approve')}
                  </button>
                  <Link to={`/manage/restaurants/${r.id}/edit`} className="btn btn-ghost btn-sm">{t('common.edit')}</Link>
                  <Link to={`/manage/restaurants/${r.id}/menu`} className="btn btn-ghost btn-sm">{t('manage.menu')}</Link>
                  <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => setDeleting(r)}>{t('common.delete')}</button>
                </div>
              </article>
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={(page) => setQ({ page })} />
        </>
      )}
      <ConfirmDialog open={Boolean(deleting)} title={t('common.delete')} text={t('admin.deleteRestaurantConfirm')} danger onCancel={() => setDeleting(null)} onConfirm={remove} />
    </div>
  );
}

export function AdminReviews() {
  const { t } = useTranslation();
  const toast = useToast();
  const [q, setQ] = useQueryState({ isApproved: '', page: 1 });
  const { data, error, reload } = useApi(() => api.get('/reviews', { ...q, limit: 15 }), [JSON.stringify(q)]);
  const moderate = async (r) => {
    try { await api.patch(`/reviews/${r.id}`, { isApproved: !r.isApproved }); reload({ quiet: true }); } catch (err) { toast.error(apiErrorMessage(t, err)); }
  };
  return (
    <div className="container">
      <PageHeader title={t('admin.reviews')} />
      <AdminTabs />
      <div className="filters-panel card pad">
        <select className="input select input-sm" value={q.isApproved} onChange={(e) => setQ({ isApproved: e.target.value })} aria-label={t('common.status')}>
          <option value="">{t('common.all')}</option>
          <option value="true">{t('review.approve')}</option>
          <option value="false">{t('review.hidden')}</option>
        </select>
      </div>
      {error ? <ErrorState error={error} onRetry={reload} /> : !data ? <Loading /> : data.items.length === 0 ? <EmptyState icon="💬" title={t('common.empty')} /> : (
        <>
          <div className="stack-sm">
            {data.items.map((r) => (
              <article key={r.id} className={`card pad review ${r.isApproved ? '' : 'is-hidden'}`}>
                <div className="row-between">
                  <span><Stars value={r.rating} size="sm" /> <strong>{r.restaurantName}</strong> <span className="muted small">· {r.customerName} · {dateOnly(r.createdAt)}</span></span>
                  <button type="button" className={`btn btn-sm ${r.isApproved ? 'btn-ghost' : 'btn-secondary'}`} onClick={() => moderate(r)}>
                    {r.isApproved ? t('review.hide') : t('review.approve')}
                  </button>
                </div>
                <ReviewText review={r} />
                {!r.isApproved && <Alert tone="warning">{t('review.hidden')}</Alert>}
              </article>
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={(page) => setQ({ page })} />
        </>
      )}
    </div>
  );
}
