import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { imageUrl } from '../api/client';
import { usePassport } from '../context/PassportContext';
import { evaluate } from '../utils/passport';
import { cuisineEmoji, hhmm, localized, lt, won } from '../utils/format';
import { Badge, Rating } from './ui';

const FAST_MINUTES = 20;

/** Photo or a colourful emoji placeholder. */
export function Thumb({ src, cuisine, alt = '', className = '' }) {
  const [failed, setFailed] = useState(false);
  const url = imageUrl(src);
  return (
    <div className={`thumb ${cuisine ? `thumb-${cuisine}` : ''} ${className}`}>
      {url && !failed
        ? <img src={url} alt={alt} loading="lazy" onError={() => setFailed(true)} />
        : <span className="thumb-emoji" aria-hidden>{cuisineEmoji(cuisine)}</span>}
    </div>
  );
}

export function DietTags({ tags = [], max = 4 }) {
  const { t } = useTranslation();
  const order = ['halal', 'vegan', 'vegetarian', 'gluten_free', 'no_pork', 'no_alcohol'];
  // vegan already implies vegetarian; halal implies no pork / no alcohol
  const shown = order.filter((x) => tags.includes(x)
    && !(x === 'vegetarian' && tags.includes('vegan'))
    && !(['no_pork', 'no_alcohol'].includes(x) && tags.includes('halal')));
  if (!shown.length) return null;
  return (
    <div className="tag-row">
      {shown.slice(0, max).map((tag) => <span key={tag} className={`diet-tag diet-${tag}`}>{t(`diet.${tag}`)}</span>)}
    </div>
  );
}

const languagesOf = (r) => 1 + Object.keys(r.translations || {}).length;

export function RestaurantCard({ restaurant: r, compact }) {
  const { t, i18n } = useTranslation();
  const { active } = usePassport();
  const name = localized(r, 'name', i18n.language);
  const fast = r.prepTimeMinutes <= FAST_MINUTES;
  return (
    <Link to={`/restaurants/${r.id}`} className={`card restaurant-card ${compact ? 'is-compact' : ''} ${r.isOpen === false ? 'is-closed' : ''}`}>
      <div className="restaurant-thumb-wrap">
        <Thumb src={r.imageUrl} cuisine={r.cuisineType} alt={name.text} className="restaurant-thumb" />
        {r.isOpen === false && <div className="closed-veil"><span>{t('restaurant.closedOpensAt', { time: hhmm(r.opensAt) })}</span></div>}
        <div className="thumb-badges">
          {r.dietaryTags?.includes('halal') && r.cuisineType === 'halal' && <span className="diet-tag diet-halal">☪️ {t('diet.halal')}</span>}
          {fast && <span className="fast-badge">⚡ {t('common.minutes', { count: r.prepTimeMinutes })}</span>}
        </div>
      </div>
      <div className="restaurant-body">
        <div className="row-between">
          <h3 className="restaurant-name">{name.text}</h3>
          <Rating value={r.averageRating} count={r.reviewCount} />
        </div>
        {name.translated && <p className="original small" lang="ko">{r.name}</p>}
        <div className="tag-row">
          {active && r.safeCount !== null && r.safeCount !== undefined && (
            r.safeCount > 0
              ? <span className="safe-tag">✅ {t('passport.safeCount', { count: r.safeCount })}</span>
              : <span className="unsafe-tag">⚠️ {t('passport.noneSafe')}</span>
          )}
          {languagesOf(r) > 1 && <span className="lang-tag">🌐 {t('home.languages', { count: languagesOf(r) })}</span>}
        </div>
        <p className="muted small">
          {t(`cuisine.${r.cuisineType}`, { defaultValue: r.cuisineType })} · {t('common.minutes', { count: r.prepTimeMinutes })}
          {r.supportsDelivery ? ` · 🛵 ${r.deliveryFee ? won(r.deliveryFee) : t('common.free')}` : ''}
        </p>
        {r.supportsDelivery && r.minItemPrice ? (
          <div className="to-door">
            <span>{t('home.toDoorLabel')}</span>
            <strong>{t('home.toDoor', { price: won(r.minItemPrice + r.deliveryFee) })}</strong>
          </div>
        ) : !r.supportsDelivery && <Badge tone="violet">🛍️ {t('restaurant.pickupOnly')}</Badge>}
        {!r.isActive && <Badge tone="amber">{t('restaurant.pendingApproval')}</Badge>}
      </div>
    </Link>
  );
}

export function MenuItemCard({ item, cuisine, onOpen, onQuickAdd }) {
  const { t } = useTranslation();
  const { passport, active } = usePassport();
  const btn = useRef(null);
  const name = localized(item, 'name');
  const desc = lt(item, 'description');
  const verdict = evaluate(item, passport);
  const blocked = active && !verdict.safe;
  return (
    <article className={`card menu-card ${item.isAvailable ? '' : 'is-soldout'} ${blocked ? 'is-blocked' : ''}`}>
      <button type="button" className="menu-open" onClick={() => onOpen(item)} aria-label={name.text} />
      <div className="menu-info">
        {active && (
          blocked
            ? <span className="verdict-chip bad">⚠️ {t('passport.notForYouShort')}</span>
            : <span className={`verdict-chip ${verdict.tooSpicy ? 'warn' : 'good'}`}>{verdict.tooSpicy ? '🌶️' : '✅'} {t(verdict.tooSpicy ? 'passport.spicyShort' : 'passport.safe')}</span>
        )}
        <h4 className="menu-name">
          {name.text}
          {item.spiceLevel > 0 && <span className="spice" title={t(`spice.${item.spiceLevel}`)} aria-label={t(`spice.${item.spiceLevel}`)}>{'🌶️'.repeat(item.spiceLevel)}</span>}
        </h4>
        {name.translated && <p className="original small" lang="ko">{item.name}</p>}
        {desc && <p className="menu-desc">{desc}</p>}
        <DietTags tags={item.dietaryTags} />
        <div className="row-between menu-bottom">
          <strong className="price">{won(item.price)}</strong>
          {!item.isAvailable ? <Badge>{t('menuItem.unavailable')}</Badge> : onQuickAdd && (
            blocked
              ? <span className="lock-btn" aria-label={t('passport.locked')}>🔒</span>
              : <button ref={btn} type="button" className="btn btn-primary btn-sm add-btn" onClick={() => onQuickAdd(item, btn.current)}>+ {t('menuItem.add')}</button>
          )}
        </div>
      </div>
      <Thumb src={item.imageUrl} cuisine={cuisine} alt={name.text} className="menu-thumb" />
    </article>
  );
}
