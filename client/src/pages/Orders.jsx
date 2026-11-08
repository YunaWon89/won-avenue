import { useEffect, useState } from 'react';
import { ReviewPhotoPicker } from '../components/ReviewPhotos';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useApi, useQueryState } from '../hooks/useApi';
import { useToast } from '../context/ToastContext';
import { Thumb } from '../components/Cards';
import { Alert, Badge, ConfirmDialog, EmptyState, ErrorState, Loading, PageHeader, Pagination, Segmented, Spinner, StatusBadge, Textarea } from '../components/ui';
import { NotFound } from './StatusPages';
import OrderScene from '../components/OrderScene';
import ReviewText from '../components/ReviewText';
import { apiErrorMessage } from '../utils/validation';
import { cuisineEmoji, dateTime, localized, won } from '../utils/format';

const FILTERS = { status: '', active: '', page: 1 };

/** Orders paid in one checkout (same checkoutId) are listed together as one payment. */
function groupByCheckout(items) {
  const groups = [];
  items.forEach((o) => {
    const last = groups[groups.length - 1];
    if (o.checkoutId && last && last.key === o.checkoutId) last.orders.push(o);
    else groups.push({ key: o.checkoutId || o.id, orders: [o] });
  });
  return groups;
}

function OrderRow({ o, className }) {
  const { t } = useTranslation();
  return (
    <Link to={`/orders/${o.id}`} className={className}>
      <Thumb src={o.restaurantImageUrl} className="thumb-sm" />
      <div className="order-row-body">
        <div className="row-between">
          <strong>{localized({ name: o.restaurantName, translations: o.restaurantTranslations, sourceLanguage: 'ko' }, 'name').text}</strong>
          <StatusBadge status={o.status} />
        </div>
        <p className="muted small ellipsis">{(o.lines || []).map((l) => `${localized(l, 'name').text} ×${l.quantity}`).join(', ') || o.itemsSummary}</p>
        <div className="row-between small">
          <span className="muted">{dateTime(o.createdAt)} · {t(`orderType.${o.orderType}`)}</span>
          <strong>{won(o.totalAmount)}</strong>
        </div>
        {o.status === 'completed' && !o.hasReview && <span className="link-text small">✍️ {t('orders.review')}</span>}
      </div>
    </Link>
  );
}

export function OrderList() {
  const { t } = useTranslation();
  const [q, setQ] = useQueryState(FILTERS);
  const { data, loading, error, reload } = useApi(() => api.get('/orders', { ...q, limit: 10 }), [JSON.stringify(q)]);
  const tab = q.active ? 'active' : q.status || 'all';

  return (
    <div className="container narrow">
      <PageHeader title={t('orders.title')} />
      <Segmented value={tab} onChange={(v) => setQ(v === 'active' ? { active: 'true', status: '' } : { active: '', status: v === 'all' ? '' : v })}
        options={[
          { value: 'all', label: t('common.all') },
          { value: 'active', label: t('orders.active') },
          { value: 'completed', label: t('status.completed') },
          { value: 'cancelled', label: t('status.cancelled') },
        ]} />
      {error ? <ErrorState error={error} onRetry={reload} /> : !data ? <Loading /> : data.items.length === 0 ? (
        <EmptyState icon="🧾" title={t('orders.empty')} action={<Link to="/" className="btn btn-primary">{t('cart.browse')}</Link>} />
      ) : (
        <div className={`stack ${loading ? 'is-loading' : ''}`}>
          {groupByCheckout(data.items).map((g) => (g.orders.length === 1 ? (
            <OrderRow key={g.key} o={g.orders[0]} className="card order-row" />
          ) : (
            <section key={g.key} className="card order-group" aria-label={t('orders.paidTogether', { count: g.orders.length })}>
              <header className="order-group-head">
                <span>🧾 {t('orders.paidTogether', { count: g.orders.length })}</span>
                <strong>{won(g.orders.reduce((sum, o) => sum + o.totalAmount, 0))}</strong>
              </header>
              {g.orders[0].cardLabel && <p className="muted small order-group-card">💳 {g.orders[0].cardLabel}</p>}
              {g.orders.map((o) => <OrderRow key={o.id} o={o} className="order-row in-group" />)}
            </section>
          )))}
          <Pagination page={data.page} totalPages={data.totalPages} onChange={(page) => setQ({ page })} />
        </div>
      )}
    </div>
  );
}

const STEPS = {
  // Customers see delivery end at "Delivered"; the order completes on its own a few minutes later.
  delivery: ['pending', 'preparing', 'out_for_delivery', 'delivered'],
  pickup: ['pending', 'preparing', 'ready_for_pickup', 'completed'],
};

function Progress({ order }) {
  const { t } = useTranslation();
  if (order.status === 'cancelled') return <Alert tone="error">{t('status.cancelled')} · {t(`payment.${order.paymentStatus}`)}</Alert>;
  const steps = STEPS[order.orderType];
  let idx = steps.indexOf(order.status === 'accepted' ? 'preparing' : order.status);
  if (idx === -1 && order.status === 'completed') idx = steps.length; // every step done
  return (
    <ol className="progress">
      {steps.map((s, i) => (
        <li key={s} className={i < idx ? 'is-done' : i === idx ? 'is-current' : ''}>
          <span className="progress-dot" aria-hidden>{i < idx ? '✓' : i + 1}</span>
          <span className="progress-label">{t(`status.${s}`)}</span>
        </li>
      ))}
    </ol>
  );
}

function ReviewForm({ orderId, onDone, initialRating = 0 }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState();
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!rating) { setError('errors.rating'); return; }
    if (comment.length > 1000) { setError(['errors.maxLength', { max: 1000 }]); return; }
    setBusy(true);
    try {
      if (photos.length) {
        const fd = new FormData();
        fd.append('orderId', orderId); fd.append('rating', String(rating));
        if (comment) fd.append('comment', comment);
        photos.forEach((f) => fd.append('photos', f));
        await api.post('/reviews', fd);
      } else {
        await api.post('/reviews', { orderId, rating, comment: comment || undefined });
      }
      toast.success(t('review.thanks'));
      onDone();
    } catch (err) { toast.error(apiErrorMessage(t, err)); } finally { setBusy(false); }
  };
  return (
    <form id="review" className="card pad stack" onSubmit={submit} noValidate>
      <h2 className="section-title">{t('review.title')}</h2>
      <div className="star-input" role="radiogroup" aria-label={t('review.rating')} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}`}
            className={(hover || rating) >= n ? 'is-on' : ''} onMouseEnter={() => setHover(n)} onClick={() => { setRating(n); setError(); }}>★</button>
        ))}
      </div>
      {error && <p className="field-error">{Array.isArray(error) ? t(error[0], error[1]) : t(error)}</p>}
      <Textarea label={t('review.comment')} rows={3} maxLength={1000} placeholder={t('review.commentPlaceholder')} value={comment}
        onChange={(e) => setComment(e.target.value)} hint={`${comment.length} / 1000`} />
      <ReviewPhotoPicker files={photos} onChange={setPhotos} />
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner size={16} /> : t('review.submit')}</button>
    </form>
  );
}

export function OrderDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data, error, reload } = useApi(() => api.get(`/orders/${id}`), [id]);
  const order = data?.data;
  const [params] = useSearchParams();
  const rateFromLink = Math.min(5, Math.max(0, Number(params.get('rate')) || 0));
  useEffect(() => {
    if (order && window.location.hash === '#review') document.getElementById('review')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [order]);

  // Live tracking: poll while the order is in progress.
  useEffect(() => {
    if (!order || ['completed', 'cancelled'].includes(order.status)) return undefined;
    const timer = setInterval(() => reload({ quiet: true }), 15000);
    return () => clearInterval(timer);
  }, [order, reload]);

  // A new review is translated in the background: refresh until the translation is in.
  const reviewPending = order?.review?.translationStatus === 'pending';
  useEffect(() => {
    if (!reviewPending) return undefined;
    const timer = setInterval(() => reload({ quiet: true }), 5000);
    return () => clearInterval(timer);
  }, [reviewPending, reload]);

  if (error?.status === 404) return <NotFound />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!order) return <Loading />;

  const setStatus = async (status) => {
    setBusy(true);
    try {
      await api.patch(`/orders/${id}/status`, { status });
      if (status === 'cancelled') toast.success(t('orders.cancelled'));
      setConfirm(false);
      reload({ quiet: true });
    } catch (err) { toast.error(apiErrorMessage(t, err)); } finally { setBusy(false); }
  };
  const cancel = () => setStatus('cancelled');
  const recentlyDone = order.status === 'completed' && Date.now() - new Date(order.updatedAt).getTime() < 2 * 3600 * 1000;
  const showCourier = Boolean(order.courierName) && (['out_for_delivery', 'delivered'].includes(order.status) || recentlyDone);

  return (
    <div className="container narrow">
      <PageHeader title={localized({ name: order.restaurantName, translations: order.restaurantTranslations, sourceLanguage: 'ko' }, 'name').text} subtitle={`${t('orders.orderNo', { n: order.orderNumber })} · ${dateTime(order.createdAt)}`}
        back={<Link to="/orders" className="back-link">‹ {t('orders.title')}</Link>} />

      <section className="card pad stack">
        <div className="row-between">
          <h2 className="section-title">{t('orders.track')}</h2>
          <StatusBadge status={order.status} />
        </div>
        <OrderScene order={order} emoji={cuisineEmoji(order.cuisineType)} />
        <Progress order={order} />
        {['accepted', 'preparing'].includes(order.status) && <p className="muted small">⏱ {t('orders.estimated', { min: order.prepTimeMinutes })}</p>}
        {!['completed', 'cancelled'].includes(order.status) && <p className="muted small">🔄 {t('orders.autoNote')}</p>}
        {showCourier && (
          <div className="courier-contact">
            <span className="courier-contact-avatar" aria-hidden>🛵</span>
            <div className="grow">
              <strong>{order.courierName}</strong> <span className="muted small">· {t('orders.courierRole')}</span>
              <p className="muted small">{order.status === 'out_for_delivery' ? t('orders.courierOnWayHint') : t('orders.wrongPlaceHint')}</p>
            </div>
            {order.courierPhone && <a className="btn btn-secondary btn-sm" href={`tel:${order.courierPhone}`}>📞 {t('orders.callCourier')}</a>}
          </div>
        )}
        {order.allowedTransitions.includes('cancelled') && (
          <button type="button" className="btn btn-danger-ghost" onClick={() => setConfirm(true)}>{t('orders.cancel')}</button>
        )}
      </section>

      {order.status === 'completed' && !order.review && <ReviewForm orderId={order.id} initialRating={rateFromLink} onDone={() => reload({ quiet: true })} />}
      {order.review && (
        <section className="card pad">
          <p className="muted small">{t('orders.reviewed')}</p>
          <p className="stars-inline">{'★'.repeat(order.review.rating)}{'☆'.repeat(5 - order.review.rating)}</p>
          <ReviewText review={order.review} />
        </section>
      )}

      <section className="card pad">
        <dl className="kv">
          <dt>{t('orders.receiveBy')}</dt><dd>{t(`orderType.${order.orderType}`)}</dd>
          {order.deliveryAddress && (<><dt>{t('checkout.deliveryAddress')}</dt><dd>{order.deliveryAddress}</dd></>)}
          {order.orderType === 'pickup' && (<><dt>{t('checkout.pickupAt')}</dt><dd>{order.restaurantAddress}</dd></>)}
          <dt>{t('checkout.contactPhone')}</dt><dd>{order.contactPhone}</dd>
          {order.customerNote && (<><dt>{t('checkout.note')}</dt><dd>{order.customerNote}</dd></>)}
          <dt>{t('orders.paidWith')}</dt><dd>{order.cardLabel} <Badge tone={order.paymentStatus === 'paid' ? 'green' : 'gray'}>{t(`payment.${order.paymentStatus}`)}</Badge></dd>
          {order.restaurantPhone && (<><dt>{t('restaurant.phone')}</dt><dd><a href={`tel:${order.restaurantPhone}`}>{order.restaurantPhone}</a></dd></>)}
        </dl>
      </section>

      <section className="card pad">
        <h2 className="section-title">{t('orders.items')}</h2>
        <ul className="summary-lines">
          {order.items.map((i) => (
            <li key={i.id} className="row-between"><span>{localized({ name: i.itemNameSnapshot, translations: i.translations, sourceLanguage: i.sourceLanguage }, 'name').text} × {i.quantity}</span><span>{won(i.subtotal)}</span></li>
          ))}
        </ul>
        <div className="summary">
          <div className="row-between"><span>{t('cart.itemsTotal')}</span><span>{won(order.itemsAmount)}</span></div>
          {order.orderType === 'delivery' && <div className="row-between"><span>{t('cart.deliveryFee')}</span><span>{won(order.deliveryFee)}</span></div>}
          <div className="row-between total"><span>{t('cart.total')}</span><strong>{won(order.totalAmount)}</strong></div>
        </div>
        <Link to={`/restaurants/${order.restaurantId}`} className="btn btn-secondary btn-block">{t('orders.reorder')}</Link>
      </section>

      <ConfirmDialog open={confirm} title={t('orders.cancel')} text={t('orders.cancelConfirm')} danger busy={busy}
        confirmLabel={t('orders.cancel')} onCancel={() => setConfirm(false)} onConfirm={cancel} />
    </div>
  );
}
