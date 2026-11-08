import { useMemo, useState } from 'react';
import ReviewText from '../components/ReviewText';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { MAX_RESTAURANTS, useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useMeta } from '../context/MetaContext';
import { usePassport } from '../context/PassportContext';
import { MenuItemCard, Thumb } from '../components/Cards';
import DishSheet from '../components/DishSheet';
import { PassportBar, Toggle } from '../components/Passport';
import { Badge, Chip, EmptyState, ErrorState, Loading, Pagination, Rating, Stars } from '../components/ui';
import { NotFound } from './StatusPages';
import { cuisineEmoji, dateOnly, hhmm, localized, lt, won } from '../utils/format';
import { flyToCart } from '../utils/fly';
import { evaluate } from '../utils/passport';

function Reviews({ restaurantId }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi(() => api.get(`/restaurants/${restaurantId}/reviews`, { page, limit: 5 }), [restaurantId, page]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;
  if (!data.items.length) return <EmptyState icon="💬" title={t('restaurant.noReviews')} />;
  return (
    <div className="stack">
      {data.items.map((r) => (
        <article key={r.id} className="review">
          <div className="row-between">
            <div className="row gap-sm">
              <span className="avatar avatar-sm">{r.customerName.slice(0, 1)}</span>
              <strong>{r.customerName}</strong>
            </div>
            <span className="muted small">{dateOnly(r.createdAt)}</span>
          </div>
          <Stars value={r.rating} size="sm" />
          <ReviewText review={r} />
        </article>
      ))}
      <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
    </div>
  );
}

export default function RestaurantDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const meta = useMeta();
  const { user, isCustomer } = useAuth();
  const { passport, active } = usePassport();
  const cart = useCart();
  const toast = useToast();

  const [tab, setTab] = useState('menu');
  const [showOriginal, setShowOriginal] = useState(false);
  const [filters, setFilters] = useState({ search: '', categoryId: '', diet: [], sort: 'name' });
  const [safeOnly, setSafeOnly] = useState(false);
  const [openItem, setOpenItem] = useState(null);

  const restaurantQ = useApi(() => api.get(`/restaurants/${id}`), [id, user?.id]);
  const r = restaurantQ.data?.data;
  const fkey = JSON.stringify(filters);
  const itemsQ = useApi(() => api.get(`/restaurants/${id}/menu-items`, { ...filters, limit: 50 }), [id, fkey, user?.id], { enabled: Boolean(r) });

  const allItems = useMemo(() => itemsQ.data?.items || [], [itemsQ.data]);
  const visible = useMemo(
    () => (active && safeOnly ? allItems.filter((it) => evaluate(it, passport).safe) : allItems),
    [allItems, active, safeOnly, passport],
  );
  const safeCount = useMemo(() => allItems.filter((it) => evaluate(it, passport).safe).length, [allItems, passport]);

  const grouped = useMemo(() => {
    if (!r) return [];
    if (filters.sort !== 'name') return [{ category: null, items: visible }];
    const groups = new Map();
    visible.forEach((it) => {
      const k = it.categoryId || '_';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(it);
    });
    const cats = [...r.categories, { id: '_', name: t('restaurant.uncategorized'), translations: {} }];
    return cats.filter((c) => groups.has(c.id)).map((c) => ({ category: c, items: groups.get(c.id) }));
  }, [visible, r, filters.sort, t]);

  if (restaurantQ.error?.status === 404) return <NotFound />;
  if (restaurantQ.error) return <ErrorState error={restaurantQ.error} onRetry={restaurantQ.reload} />;
  if (!r) return <Loading />;

  const name = localized(r, 'name', i18n.language, showOriginal);
  const desc = localized(r, 'description', i18n.language, showOriginal);
  const canOrder = r.isActive && r.isOpen !== false && (!user || isCustomer);
  const setF = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const toggleDiet = (tag) => setF({ diet: filters.diet.includes(tag) ? filters.diet.filter((d) => d !== tag) : [...filters.diet, tag] });

  // Adding is silent: the dish flies into the cart icon and the badge bumps.
  // The cart can mix restaurants (each becomes its own order at checkout), up to MAX_RESTAURANTS.
  const add = (item, qty = 1, sourceEl) => {
    if (cart.isFull(r.id)) { toast.error(t('cart.maxRestaurants', { count: MAX_RESTAURANTS })); return false; }
    if (sourceEl) flyToCart(sourceEl, cuisineEmoji(r.cuisineType), item.imageUrl);
    cart.add(r, item, qty);
    return true;
  };

  return (
    <>
      <section className="restaurant-hero">
        <Thumb src={r.imageUrl} cuisine={r.cuisineType} alt={name.text} className="restaurant-banner" />
        <div className="container">
          <div className="restaurant-head card">
            {!r.isActive && <Badge tone="amber">{t('restaurant.pendingApproval')}</Badge>}
            <h1>{name.text}</h1>
            {name.translated && <p className="original" lang="ko">{r.name}</p>}
            <div className="row gap-sm wrap">
              <Rating value={r.averageRating} count={r.reviewCount} />
              <span className="muted">·</span>
              <span className="muted">{t(`cuisine.${r.cuisineType}`, { defaultValue: r.cuisineType })}</span>
              {r.prepTimeMinutes <= (meta.fastMinutes || 20) && <span className="fast-badge">⚡ {t('common.minutes', { count: r.prepTimeMinutes })}</span>}
            </div>
            {desc.text && <p className="muted">{desc.text}</p>}
            {r.isOpen === false && <p className="notice">🌙 {t('restaurant.closedNow', { time: hhmm(r.opensAt) })}</p>}
            <dl className="facts">
              {r.supportsDelivery && <div><dt>{t('restaurant.deliveryFee')}</dt><dd>{r.deliveryFee ? won(r.deliveryFee) : t('common.free')}</dd></div>}
              {r.supportsDelivery && <div><dt>{t('restaurant.minOrder')}</dt><dd>{won(r.minOrderAmount)}</dd></div>}
              <div><dt>{t('restaurant.prepTime')}</dt><dd>{t('common.minutes', { count: r.prepTimeMinutes })}</dd></div>
              <div><dt>{t('restaurant.hours')}</dt><dd>{r.opensAt && r.closesAt ? `${hhmm(r.opensAt)}–${hhmm(r.closesAt)}` : t('restaurant.allDay')}</dd></div>
              <div>
                <dt>{t('checkout.howToReceive')}</dt>
                <dd>{r.supportsDelivery && r.supportsPickup ? t('orderType.deliveryAndPickup') : r.supportsDelivery ? t('orderType.delivery') : t('orderType.pickup')}</dd>
              </div>
            </dl>
            {r.canManage && <Link className="btn btn-secondary btn-sm" to={`/manage/restaurants/${r.id}/menu`}>{t('manage.menu')} →</Link>}
          </div>
        </div>
      </section>

      <div className="container">
        <div className="tabs" role="tablist">
          {['menu', 'reviews', 'info'].map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>
              {t(`restaurant.${k}`)}{k === 'reviews' && ` ${r.reviewCount}`}
            </button>
          ))}
        </div>

        {tab === 'menu' && (
          <>
            {canOrder && <div className="menu-passport"><PassportBar compact /></div>}
            {active && allItems.length > 0 && (
              <div className="safe-summary">
                <span>✅ {t('passport.safeCount', { count: safeCount })} / {allItems.length}</span>
                <label className="safe-only">
                  <span>{t('passport.showOnlySafe')}</span>
                  <Toggle on={safeOnly} onChange={setSafeOnly} label={t('passport.showOnlySafe')} />
                </label>
              </div>
            )}
            <div className="menu-toolbar">
              <input type="search" className="input" placeholder={t('restaurant.searchMenu')} value={filters.search} onChange={(e) => setF({ search: e.target.value })} aria-label={t('restaurant.searchMenu')} />
              <div className="row gap-sm toolbar-row">
                <select className="input select input-sm" value={filters.categoryId} onChange={(e) => setF({ categoryId: e.target.value })} aria-label={t('manage.category')}>
                  <option value="">{t('common.all')}</option>
                  {r.categories.map((c) => <option key={c.id} value={c.id}>{lt(c, 'name', i18n.language, showOriginal)}</option>)}
                </select>
                <select className="input select input-sm" value={filters.sort} onChange={(e) => setF({ sort: e.target.value })} aria-label={t('common.sortBy')}>
                  {['name', 'price_asc', 'price_desc', 'newest'].map((s) => <option key={s} value={s}>{t(`restaurant.sort.${s}`)}</option>)}
                </select>
                {meta.dietaryTags.map((tag) => <Chip key={tag} size="sm" active={filters.diet.includes(tag)} onClick={() => toggleDiet(tag)}>{t(`diet.${tag}`)}</Chip>)}
                {(name.translated || desc.translated || i18n.language !== r.sourceLanguage) && (
                  <button type="button" className="link-btn small nowrap" onClick={() => setShowOriginal((s) => !s)}>
                    🌐 {showOriginal ? t('common.showTranslation') : t('common.showOriginal')}
                  </button>
                )}
              </div>
            </div>

            {itemsQ.error ? <ErrorState error={itemsQ.error} onRetry={itemsQ.reload} /> : !itemsQ.data ? <Loading /> : grouped.length === 0 ? (
              <EmptyState icon="🥢" title={active && safeOnly ? t('passport.noneSafe') : t('restaurant.noItems')} />
            ) : grouped.map(({ category, items }) => (
              <section key={category?.id || 'all'} className="menu-section">
                {category && <h2 className="menu-section-title">{lt(category, 'name', i18n.language, showOriginal)}</h2>}
                <div className="menu-grid">
                  {items.map((it) => (
                    <MenuItemCard key={it.id} item={showOriginal ? { ...it, translations: {} } : it} cuisine={r.cuisineType}
                      onOpen={() => setOpenItem(it)} onQuickAdd={canOrder ? (item, el) => add(it, 1, el) : undefined} />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}

        {tab === 'reviews' && <Reviews restaurantId={r.id} />}

        {tab === 'info' && (
          <div className="card pad stack">
            {r.address && <div><p className="muted small">{t('restaurant.address')}</p><p>{r.address}</p></div>}
            {r.phone && <div><p className="muted small">{t('restaurant.phone')}</p><a href={`tel:${r.phone}`}>{r.phone}</a></div>}
            {desc.text && <p>{desc.text}</p>}
          </div>
        )}
      </div>

      {openItem && (
        <DishSheet item={openItem} restaurant={r} alternatives={allItems.filter((a) => a.categoryId === openItem.categoryId)}
          canOrder={canOrder} onClose={() => setOpenItem(null)} onPick={setOpenItem}
          onAdd={(item, qty) => add(item, qty)} />
      )}
    </>
  );
}
