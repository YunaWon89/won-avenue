import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Thumb } from './Cards';
import { localized } from '../utils/format';

/**
 * "How was it?" card after a delivery. Orders complete automatically a few minutes after the courier's
 * "Delivered", so this shows up a little while after the food arrives. One tap on a star opens the review
 * form with that rating; "Later" hides it for that order (remembered on this device). Last 3 days only.
 */
const KEY = 'reviewPrompt.dismissed';
const readDismissed = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };

export default function ReviewPrompt() {
  const { t } = useTranslation();
  const { isCustomer } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const busyPage = pathname.startsWith('/orders/') || pathname.startsWith('/checkout') || pathname.startsWith('/cart');

  useEffect(() => {
    if (!isCustomer || busyPage) { setOrder(null); return undefined; }
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/orders', { status: 'completed', limit: 5 });
        const dismissed = readDismissed();
        const since = Date.now() - 3 * 24 * 3600 * 1000;
        const next = res.items.find((o) => !o.hasReview && !dismissed.includes(o.id) && new Date(o.updatedAt).getTime() > since);
        if (alive) setOrder(next || null);
      } catch { /* not important */ }
    }, 1500);
    return () => { alive = false; clearTimeout(timer); };
  }, [isCustomer, busyPage, pathname]);

  if (!order) return null;
  const name = localized({ name: order.restaurantName, translations: order.restaurantTranslations, sourceLanguage: 'ko' }, 'name').text;
  const later = () => {
    try { localStorage.setItem(KEY, JSON.stringify([...readDismissed(), order.id].slice(-50))); } catch { /* ignore */ }
    setOrder(null);
  };
  return (
    <aside className="review-prompt" role="dialog" aria-label={t('reviewPrompt.title', { name })}>
      <button type="button" className="review-prompt-close" onClick={later} aria-label={t('reviewPrompt.later')}>×</button>
      <Thumb src={order.restaurantImageUrl} className="thumb-sm" />
      <div className="grow">
        <strong>{t('reviewPrompt.title', { name })}</strong>
        <p className="muted small">{t('reviewPrompt.sub')}</p>
        <div className="review-prompt-stars" role="group" aria-label={t('review.rating')}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-label={`${n}`} onClick={() => navigate(`/orders/${order.id}?rate=${n}#review`)}>★</button>
          ))}
        </div>
        <button type="button" className="link-btn small" onClick={later}>{t('reviewPrompt.later')}</button>
      </div>
    </aside>
  );
}
