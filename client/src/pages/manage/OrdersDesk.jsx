import { useEffect, useRef, useState } from 'react';
import SoundToggle from '../../components/SoundToggle';
import { playChime } from '../../utils/chime';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useApi, useQueryState } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Alert, Badge, ConfirmDialog, EmptyState, ErrorState, Loading, Modal, PageHeader, Pagination, Spinner, StatusBadge } from '../../components/ui';
import { apiErrorMessage } from '../../utils/validation';
import { dateTime, timeAgo, won } from '../../utils/format';

const STATUSES = ['pending', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'completed', 'cancelled'];
const DEFAULTS = { status: '', active: '', orderType: '', restaurantId: '', from: '', to: '', sort: 'newest', page: 1 };

function OrderDetailModal({ id, onClose }) {
  const { t } = useTranslation();
  const { data } = useApi(() => api.get(`/orders/${id}`), [id]);
  const o = data?.data;
  return (
    <Modal open onClose={onClose} title={o ? `#${o.orderNumber} · ${o.restaurantName}` : '…'}>
      {!o ? <Loading /> : (
        <div className="stack">
          <dl className="kv">
            <dt>{t('orders.customer')}</dt><dd>{o.customerName} · <a href={`tel:${o.contactPhone}`}>{o.contactPhone}</a></dd>
            <dt>{t('orders.receiveBy')}</dt><dd>{t(`orderType.${o.orderType}`)}</dd>
            {o.deliveryAddress && (<><dt>{t('checkout.deliveryAddress')}</dt><dd>{o.deliveryAddress}</dd></>)}
            {o.customerNote && (<><dt>{t('checkout.note')}</dt><dd className="note-highlight">{o.customerNote}</dd></>)}
            <dt>{t('orders.paidWith')}</dt><dd>{o.cardLabel} · {t(`payment.${o.paymentStatus}`)}</dd>
          </dl>
          <ul className="summary-lines">
            {o.items.map((i) => <li key={i.id} className="row-between"><span>{i.itemNameSnapshot} × {i.quantity}</span><span>{won(i.subtotal)}</span></li>)}
          </ul>
          <div className="summary"><div className="row-between total"><span>{t('cart.total')}</span><strong>{won(o.totalAmount)}</strong></div></div>
        </div>
      )}
    </Modal>
  );
}

export default function OrdersDesk() {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin, isManager } = useAuth();
  const [q, setQ] = useQueryState(DEFAULTS);
  const [busyId, setBusyId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const restaurants = useApi(() => api.get('/restaurants', isManager ? { managed: true, limit: 50 } : { limit: 50 }), []);
  const { data, error, loading, reload } = useApi(() => api.get('/orders', { ...q, limit: 15 }), [JSON.stringify(q)]);

  // Auto-refresh + alert on new pending orders.
  const seenPending = useRef(null);
  useEffect(() => {
    const timer = setInterval(() => reload({ quiet: true }), 20000);
    return () => clearInterval(timer);
  }, [reload]);
  useEffect(() => {
    if (!data) return;
    const pendingIds = data.items.filter((o) => o.status === 'pending').map((o) => o.id);
    if (seenPending.current && pendingIds.some((pid) => !seenPending.current.has(pid))) { toast.info(`🔔 ${t('manage.newOrderAlert')}`); playChime(); }
    seenPending.current = new Set(pendingIds);
  }, [data, toast, t]);

  const setStatus = async (order, status) => {
    setBusyId(order.id);
    try {
      await api.patch(`/orders/${order.id}/status`, { status });
      toast.success(t('manage.statusUpdated'));
      reload({ quiet: true });
    } catch (err) { toast.error(apiErrorMessage(t, err)); } finally { setBusyId(null); setConfirmCancel(null); }
  };

  return (
    <div className="container">
      <PageHeader title={isAdmin ? t('admin.orders') : t('nav.manageOrders')} subtitle={`🔄 ${t('manage.autoRefresh')}`} actions={isAdmin ? null : <SoundToggle />} />
      {isAdmin && <Alert tone="info">ℹ️ {t('admin.ordersReadOnly')}</Alert>}
      <div className="filters-panel card pad">
        <select className="input select input-sm" value={q.active ? 'active' : q.status} aria-label={t('orders.filterStatus')}
          onChange={(e) => setQ(e.target.value === 'active' ? { active: 'true', status: '' } : { status: e.target.value, active: '' })}>
          <option value="">{t('common.all')}</option>
          <option value="active">{t('orders.active')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </select>
        <select className="input select input-sm" value={q.orderType} onChange={(e) => setQ({ orderType: e.target.value })} aria-label={t('orders.receiveBy')}>
          <option value="">{t('orderType.deliveryAndPickup')}</option>
          <option value="delivery">{t('orderType.delivery')}</option>
          <option value="pickup">{t('orderType.pickup')}</option>
        </select>
        <select className="input select input-sm" value={q.restaurantId} onChange={(e) => setQ({ restaurantId: e.target.value })} aria-label={t('orders.restaurant')}>
          <option value="">{t('orders.restaurant')}: {t('common.all')}</option>
          {(restaurants.data?.items || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <label className="date-filter">{t('orders.from')}<input type="date" className="input input-sm" value={q.from} onChange={(e) => setQ({ from: e.target.value })} /></label>
        <label className="date-filter">{t('orders.to')}<input type="date" className="input input-sm" value={q.to} onChange={(e) => setQ({ to: e.target.value })} /></label>
        <select className="input select input-sm" value={q.sort} onChange={(e) => setQ({ sort: e.target.value })} aria-label={t('common.sortBy')}>
          <option value="newest">{t('orders.sortNewest')}</option>
          <option value="oldest">{t('orders.sortOldest')}</option>
          <option value="status">{t('orders.sortStatus')}</option>
        </select>
      </div>

      {error ? <ErrorState error={error} onRetry={reload} /> : !data ? <Loading /> : data.items.length === 0 ? <EmptyState icon="🧾" title={t('common.empty')} /> : (
        <>
          <div className={`order-board ${loading ? 'is-loading' : ''}`}>
            {data.items.map((o) => {
              const forward = o.allowedTransitions.filter((s) => s !== 'cancelled');
              return (
                <article key={o.id} className={`card order-ticket status-${o.status}`}>
                  <header className="row-between">
                    <button type="button" className="link-btn" onClick={() => setDetail(o.id)}><strong>#{o.orderNumber}</strong> · {o.restaurantName}</button>
                    <StatusBadge status={o.status} />
                  </header>
                  <p className="small">{o.itemsSummary}</p>
                  <div className="row gap-sm wrap small">
                    <Badge tone={o.orderType === 'pickup' ? 'violet' : 'blue'}>{o.orderType === 'pickup' ? '🛍️' : '🛵'} {t(`orderType.${o.orderType}`)}</Badge>
                    <span className="muted" title={dateTime(o.createdAt)}>{timeAgo(o.createdAt)}</span>
                    <span className="muted">· {o.customerName}</span>
                    <strong className="push-right">{won(o.totalAmount)}</strong>
                  </div>
                  {o.deliveryAddress && <p className="muted small ellipsis">📍 {o.deliveryAddress}</p>}
                  {o.status === 'out_for_delivery' && (
                    <p className="small courier-note">{o.courierId ? `🛵 ${t('manage.courierOnWay')}` : `⏳ ${t('manage.waitingCourier')}`}</p>
                  )}
                  {!isAdmin && o.allowedTransitions.length > 0 && (
                    <div className="row gap-sm wrap ticket-actions">
                      {forward.map((s) => (
                        <button key={s} type="button" className="btn btn-primary btn-sm" disabled={busyId === o.id} onClick={() => setStatus(o, s)}>
                          {busyId === o.id ? <Spinner size={14} /> : t(`statusAction.${s}`)}
                        </button>
                      ))}
                      {o.allowedTransitions.includes('cancelled') && (
                        <button type="button" className="btn btn-danger-ghost btn-sm" disabled={busyId === o.id} onClick={() => setConfirmCancel(o)}>{t('statusAction.cancelled')}</button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={(page) => setQ({ page })} />
        </>
      )}
      {detail && <OrderDetailModal id={detail} onClose={() => setDetail(null)} />}
      <ConfirmDialog open={Boolean(confirmCancel)} title={t('statusAction.cancelled')} text={t('orders.cancelConfirm')} danger busy={Boolean(busyId)}
        onCancel={() => setConfirmCancel(null)} onConfirm={() => setStatus(confirmCancel, 'cancelled')} />
    </div>
  );
}
