import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext';
import { usePassport } from '../context/PassportContext';
import { evaluate } from '../utils/passport';
import { Thumb } from '../components/Cards';
import { EmptyState, PageHeader } from '../components/ui';
import { lt, won } from '../utils/format';

export function QtyStepper({ value, onChange, label }) {
  return (
    <div className="qty" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} aria-label="-">−</button>
      <span>{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} aria-label="+" disabled={value >= 99}>+</button>
    </div>
  );
}

export default function Cart() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cart = useCart();
  const { passport, active } = usePassport();

  if (!cart.items.length) {
    return (
      <div className="container">
        <EmptyState icon="🛒" title={t('cart.empty')} action={<Link to="/" className="btn btn-primary">{t('cart.browse')}</Link>} />
      </div>
    );
  }
  const several = cart.groups.length > 1;

  return (
    <div className="container narrow">
      <PageHeader title={t('cart.title')} actions={<button type="button" className="link-btn" onClick={cart.clear}>{t('cart.clear')}</button>} />
      {several && <p className="notice info">🧾 {t('cart.multiNote', { count: cart.groups.length })}</p>}
      <div className="stack">
        {cart.groups.map(({ restaurant: r, items, itemsTotal }) => {
          const shortfall = r.supportsDelivery ? Math.max(0, r.minOrderAmount - itemsTotal) : 0;
          return (
            <div key={r.id} className="card cart-group">
              <div className="cart-restaurant">
                <Link to={`/restaurants/${r.id}`} className="cart-restaurant-link">
                  <Thumb src={r.imageUrl} cuisine={r.cuisineType} className="thumb-sm" />
                  <strong>{lt(r, 'name')}</strong>
                  <span className="muted">›</span>
                </Link>
                {several && (
                  <button type="button" className="link-btn small" onClick={() => cart.removeRestaurant(r.id)}>{t('cart.removeRestaurant')}</button>
                )}
              </div>
              <ul className="cart-list">
                {items.map((i) => (
                  <li key={i.id} className="cart-item">
                    <div>
                      <p className="cart-item-name">{lt(i, 'name')}</p>
                      {active && i.allergens && !evaluate(i, passport).safe && <p className="small danger-text">⚠️ {t('passport.notForYouShort')}</p>}
                      <p className="muted small">{won(i.price)}</p>
                    </div>
                    <div className="row gap-sm">
                      <QtyStepper value={i.quantity} onChange={(q) => cart.setQuantity(i.id, q)} label={lt(i, 'name')} />
                      <strong className="cart-line-total">{won(i.price * i.quantity)}</strong>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="summary">
                <div className="row-between"><span>{t('cart.itemsTotal')}</span><strong>{won(itemsTotal)}</strong></div>
              </div>
              {shortfall > 0 && <p className="notice cart-group-notice">{t('cart.minOrderNotMet', { amount: won(shortfall), min: won(r.minOrderAmount) })}</p>}
            </div>
          );
        })}
      </div>
      <div className="sticky-cta">
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => navigate('/checkout')}>
          {t('cart.checkout')} · {won(cart.itemsTotal)}
        </button>
      </div>
    </div>
  );
}
