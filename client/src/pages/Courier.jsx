import { useEffect, useRef, useState } from 'react';
import SoundToggle from '../components/SoundToggle';
import { playChime } from '../utils/chime';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { Badge, EmptyState, ErrorState, Loading, PageHeader, Segmented, Spinner, StatusBadge } from '../components/ui';
import { apiErrorMessage } from '../utils/validation';
import { localized, timeAgo, won } from '../utils/format';

/**
 * Courier screen: deliveries handed over by restaurants.
 * "Available" — waiting for a courier (tap "Take"), "Mine" — my deliveries (tap "Delivered").
 */
export default function Courier() {
  const { t } = useTranslation();
  const toast = useToast();
  const [tab, setTab] = useState('available');
  const [busy, setBusy] = useState(null);
  const query = tab === 'available' ? { scope: 'available' } : tab === 'mine' ? { scope: 'mine', status: 'out_for_delivery' } : { scope: 'mine', sort: 'newest' };
  const { data, error, loading, reload } = useApi(() => api.get('/orders', { ...query, limit: 30 }), [tab]);

  useEffect(() => {
    const timer = setInterval(() => reload({ quiet: true }), 15000);
    return () => clearInterval(timer);
  }, [reload]);

  // Chime when a new delivery appears in "available".
  const seen = useRef(null);
  useEffect(() => {
    if (!data || tab !== 'available') { seen.current = null; return; }
    const ids = data.items.map((o) => o.id);
    if (seen.current && ids.some((id) => !seen.current.has(id))) playChime();
    seen.current = new Set(ids);
  }, [data, tab]);

  const act = async (order, action) => {
    setBusy(order.id);
    try {
      if (action === 'claim') {
        await api.post(`/orders/${order.id}/claim`);
        toast.success(t('courier.taken'));
        setTab('mine');
      } else {
        await api.patch(`/orders/${order.id}/status`, { status: 'delivered' });
        toast.success(t('courier.deliveredToast'));
      }
      reload({ quiet: true });
    } catch (err) { toast.error(apiErrorMessage(t, err)); reload({ quiet: true }); } finally { setBusy(null); }
  };

  const items = data?.items || [];
  return (
    <div className="container narrow">
      <PageHeader title={t('courier.title')} subtitle={`🔄 ${t('manage.autoRefresh')}`} actions={<SoundToggle />} />
      <Segmented value={tab} onChange={setTab} ariaLabel={t('courier.title')} options={[
        { value: 'available', label: t('courier.available') },
        { value: 'mine', label: t('courier.mine') },
        { value: 'history', label: t('courier.history') },
      ]} />
      {error ? <ErrorState error={error} onRetry={reload} /> : !data ? <Loading /> : items.length === 0 ? (
        <EmptyState icon="🛵" title={tab === 'available' ? t('courier.noneAvailable') : t('common.empty')} />
      ) : (
        <div className={`stack ${loading ? 'is-loading' : ''}`} style={{ marginTop: 14 }}>
          {items.map((o) => {
            const restaurant = localized({ name: o.restaurantName, translations: o.restaurantTranslations, sourceLanguage: 'ko' }, 'name').text;
            return (
              <article key={o.id} className="card pad delivery-card">
                <div className="row-between">
                  <strong>#{o.orderNumber} · {won(o.totalAmount)}</strong>
                  {o.status === 'out_for_delivery' && !o.courierId ? <Badge tone="amber">{t('courier.waiting')}</Badge> : <StatusBadge status={o.status} />}
                </div>
                <div className="route">
                  <div><span className="route-dot from" aria-hidden />
                    <div><small>{t('courier.pickupFrom')}</small><strong>{restaurant}</strong><p className="muted small">{o.restaurantAddress}</p></div>
                  </div>
                  <div><span className="route-dot to" aria-hidden />
                    <div><small>{t('courier.deliverTo')}</small><strong>{o.customerName}</strong><p className="muted small">{o.deliveryAddress}</p></div>
                  </div>
                </div>
                <p className="small muted">🍱 {t('cart.itemsCount', { count: o.itemCount })} · {timeAgo(o.updatedAt)}{o.customerNote ? ` · 📝 ${o.customerNote}` : ''}</p>
                <div className="row gap-sm wrap">
                  {o.courierId && o.status === 'out_for_delivery' && (
                    <>
                      <a className="btn btn-ghost btn-sm" href={`tel:${o.contactPhone}`}>📞 {t('courier.callCustomer')}</a>
                      {o.restaurantPhone && <a className="btn btn-ghost btn-sm" href={`tel:${o.restaurantPhone}`}>🏪 {t('courier.callRestaurant')}</a>}
                    </>
                  )}
                  <span className="grow" />
                  {tab === 'available' && (
                    <button type="button" className="btn btn-primary" disabled={busy === o.id} onClick={() => act(o, 'claim')}>
                      {busy === o.id ? <Spinner size={16} /> : t('courier.take')}
                    </button>
                  )}
                  {tab === 'mine' && (
                    <button type="button" className="btn btn-primary" disabled={busy === o.id} onClick={() => act(o, 'delivered')}>
                      {busy === o.id ? <Spinner size={16} /> : `✅ ${t('courier.markDelivered')}`}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
