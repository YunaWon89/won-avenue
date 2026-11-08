import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { AddressFields } from '../components/AddressFields';
import { AddCardModal, CardLabel } from '../components/PaymentCards';
import { PassportBar } from '../components/Passport';
import { Alert, Input, Loading, PageHeader, Segmented, Spinner, Textarea } from '../components/ui';
import { apiErrorMessage, rules, validate } from '../utils/validation';
import { formatPhone, fullAddress, lt, won } from '../utils/format';

export default function Checkout() {
  const { t } = useTranslation();
  const { user, isCustomer } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const { groups } = cart;
  // One choice for the whole checkout: it must work for every restaurant in the cart.
  const noDelivery = groups.filter((g) => !g.restaurant.supportsDelivery);
  const noPickup = groups.filter((g) => !g.restaurant.supportsPickup);
  const canDeliver = noDelivery.length === 0;
  const canPickup = noPickup.length === 0;

  const [orderType, setOrderType] = useState(canDeliver ? 'delivery' : 'pickup');
  const [address, setAddress] = useState({ postalCode: user?.postalCode || '', addressLine1: user?.addressLine1 || '', addressLine2: user?.addressLine2 || '' });
  const [editAddress, setEditAddress] = useState(!user?.addressLine1);
  const [phone, setPhone] = useState(user?.phone || '');
  const [note, setNote] = useState('');
  const [pickedCardId, setCardId] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState(null);

  const cardsQ = useApi(() => api.get('/payment-methods'), [], { enabled: isCustomer });
  const cards = cardsQ.data?.data || [];
  // Default card is pre-selected until the user picks another one.
  const cardId = pickedCardId || (cards.find((c) => c.isDefault) || cards[0])?.id || '';

  if (placed) return <Navigate to={placed} replace />;
  if (!isCustomer) return <Navigate to="/" replace />;
  if (!cart.items.length) return <Navigate to="/cart" replace />;

  const delivery = orderType === 'delivery';
  const parts = groups.map((g) => ({
    ...g,
    deliveryFee: delivery ? g.restaurant.deliveryFee : 0,
    shortfall: delivery ? Math.max(0, g.restaurant.minOrderAmount - g.itemsTotal) : 0,
  }));
  const deliveryFee = parts.reduce((s, p) => s + p.deliveryFee, 0);
  const total = cart.itemsTotal + deliveryFee;
  const shortfall = parts.some((p) => p.shortfall > 0);
  const typeBlocked = (delivery && !canDeliver) || (!delivery && !canPickup);
  const nameOf = (restaurantId) => {
    const g = groups.find((x) => x.restaurant.id === restaurantId);
    return g ? lt(g.restaurant, 'name') : '';
  };

  const placeOrder = async () => {
    const errs = validate({ phone: [rules.required, rules.phone] }, { phone });
    if (orderType === 'delivery' && (!address.addressLine1 || address.addressLine1.trim().length < 5)) errs.addressLine1 = 'errors.address';
    if (!cardId) errs.card = t('checkout.noCards');
    setErrors(errs);
    if (Object.keys(errs).length) { if (errs.addressLine1) setEditAddress(true); return; }

    setBusy(true); setFormError('');
    try {
      // One checkout -> one order per restaurant (validated together; nothing is charged if any part is invalid).
      const res = await api.post('/orders/batch', {
        orderType,
        orders: groups.map((g) => ({ restaurantId: g.restaurant.id, items: g.items.map((i) => ({ menuItemId: i.id, quantity: i.quantity })) })),
        deliveryAddress: delivery ? fullAddress(address) : undefined,
        contactPhone: phone,
        customerNote: note || undefined,
        paymentMethodId: cardId,
      });
      const orders = res.data;
      // Redirect via state so the empty-cart guard below doesn't send us to /cart.
      setPlaced(orders.length === 1 ? `/orders/${orders[0].id}` : '/orders');
      cart.clear();
      toast.success(orders.length === 1 ? t('checkout.success') : t('checkout.successMany', { count: orders.length }));
    } catch (err) {
      let msg = apiErrorMessage(t, err);
      if (err.fieldErrors?.items) msg = `${msg} — ${err.fieldErrors.items}`;
      if (err.restaurantId) msg = `${nameOf(err.restaurantId)}: ${msg}`;
      setFormError(msg);
    } finally { setBusy(false); }
  };

  return (
    <div className="container narrow">
      <PageHeader title={t('checkout.title')} />
      {formError && <Alert tone="error">{formError}</Alert>}
      <div className="checkout-passport"><PassportBar compact /></div>

      <section className="card pad stack">
        <h2 className="section-title">{t('checkout.howToReceive')}</h2>
        <Segmented value={orderType} onChange={setOrderType} options={[
          { value: 'delivery', label: t('orderType.delivery'), icon: '🛵', disabled: !canDeliver },
          { value: 'pickup', label: t('orderType.pickup'), icon: '🛍️', disabled: !canPickup },
        ]} />
        {!canDeliver && <p className="muted small">{t('checkout.pickupOnly', { names: noDelivery.map((g) => lt(g.restaurant, 'name')).join(', ') })}</p>}
        {!canPickup && <p className="muted small">{t('checkout.deliveryOnly', { names: noPickup.map((g) => lt(g.restaurant, 'name')).join(', ') })}</p>}
        {typeBlocked && (
          <Alert tone="error">{t('checkout.noCommonOption')} <button type="button" className="link-btn" onClick={() => navigate('/cart')}>{t('cart.title')} ›</button></Alert>
        )}
        {delivery ? (
          <div>
            <div className="row-between">
              <h3 className="label">{t('checkout.deliveryAddress')}</h3>
              {!editAddress && <button type="button" className="link-btn" onClick={() => setEditAddress(true)}>{t('checkout.changeAddress')}</button>}
            </div>
            {editAddress
              ? <AddressFields value={address} onChange={setAddress} errors={errors} required />
              : <p className="address-box">📍 {fullAddress(address)}{address.postalCode && <span className="muted small"> ({address.postalCode})</span>}</p>}
          </div>
        ) : (
          <div>
            <h3 className="label">{t('checkout.pickupAt')}</h3>
            {groups.map(({ restaurant: r }) => (
              <p key={r.id} className="address-box">🏪 {lt(r, 'name')}{r.address && ` · ${r.address}`}</p>
            ))}
          </div>
        )}
        <Input label={t('checkout.contactPhone')} type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} error={errors.phone} required />
        <Textarea label={t('checkout.note')} rows={2} maxLength={500} placeholder={t('checkout.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
      </section>

      <section className="card pad stack">
        <div className="row-between">
          <h2 className="section-title">{t('checkout.payment')}</h2>
          <button type="button" className="link-btn" onClick={() => setAddOpen(true)}>+ {t('checkout.addCard')}</button>
        </div>
        {cardsQ.loading ? <Loading /> : cards.length === 0 ? (
          <button type="button" className="add-card-tile" onClick={() => setAddOpen(true)}>💳 {t('checkout.noCards')}</button>
        ) : (
          <div className="stack-sm" role="radiogroup" aria-label={t('checkout.payment')}>
            {cards.map((c) => (
              <label key={c.id} className={`radio-card ${cardId === c.id ? 'is-active' : ''}`}>
                <input type="radio" name="card" checked={cardId === c.id} onChange={() => setCardId(c.id)} />
                <CardLabel card={c} />
              </label>
            ))}
          </div>
        )}
        {errors.card && <p className="field-error">{errors.card}</p>}
        <p className="muted small">🔒 {t('checkout.secure')}</p>
      </section>

      <section className="card pad">
        <h2 className="section-title">{t('checkout.summary')}</h2>
        {parts.length > 1 && <p className="muted small">{t('cart.multiNote', { count: parts.length })}</p>}
        {parts.map((p) => (
          <div key={p.restaurant.id} className="checkout-group">
            <p className="checkout-group-title">
              <Link to={`/restaurants/${p.restaurant.id}`}>{lt(p.restaurant, 'name')}</Link>
              {parts.length > 1 && <span>{won(p.itemsTotal + p.deliveryFee)}</span>}
            </p>
            <ul className="summary-lines">
              {p.items.map((i) => (
                <li key={i.id} className="row-between"><span>{lt(i, 'name')} × {i.quantity}</span><span>{won(i.price * i.quantity)}</span></li>
              ))}
              {delivery && (
                <li className="row-between muted"><span>{t('cart.deliveryFee')}</span><span>{p.deliveryFee ? won(p.deliveryFee) : t('common.free')}</span></li>
              )}
            </ul>
            {p.shortfall > 0 && <p className="notice">{t('cart.minOrderNotMet', { amount: won(p.shortfall), min: won(p.restaurant.minOrderAmount) })}</p>}
          </div>
        ))}
        <div className="summary">
          <div className="row-between"><span>{t('cart.itemsTotal')}</span><span>{won(cart.itemsTotal)}</span></div>
          {delivery && <div className="row-between"><span>{t('cart.deliveryFee')}</span><span>{deliveryFee ? won(deliveryFee) : t('common.free')}</span></div>}
          <div className="row-between total"><span>{t('cart.total')}</span><strong>{won(total)}</strong></div>
        </div>
      </section>

      <div className="sticky-cta">
        <button type="button" className="btn btn-primary btn-lg btn-block" disabled={busy || shortfall || typeBlocked} onClick={placeOrder}>
          {busy ? <><Spinner size={18} /> {t('checkout.paying')}</> : t('checkout.pay', { amount: won(total) })}
        </button>
      </div>

      <AddCardModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={(c) => { cardsQ.reload(); setCardId(c.id); }} />
    </div>
  );
}
