import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useApi, useQueryState } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useMeta } from '../context/MetaContext';
import { usePassport } from '../context/PassportContext';
import { RestaurantCard } from '../components/Cards';
import { PassportBar } from '../components/Passport';
import { Chip, EmptyState, ErrorState, Pagination, Segmented } from '../components/ui';
import { cuisineEmoji, cuisineTint } from '../utils/format';
import { passportQuery } from '../utils/passport';

const DEFAULTS = { search: '', cuisine: '', diet: [], minRating: '', orderType: '', mood: '', sort: 'rating', page: 1 };
const MOODS = [
  ['spicy', '🔥'], ['light', '🥗'], ['comfort', '🍲'], ['sweet', '🍰'], ['late_night', '🌙'], ['fast', '⚡'],
];

function MoodGrid({ value, onPick }) {
  const { t } = useTranslation();
  const { fastMinutes = 20 } = useMeta();
  return (
    <div className="mood-grid" role="group" aria-label={t('moods.title')}>
      {MOODS.map(([m, emoji], i) => (
        <button key={m} type="button" className={`mood mood-${m} ${value === m ? 'is-active' : ''}`} aria-pressed={value === m}
          onClick={() => onPick(value === m ? '' : m)}>
          <span className="mood-label">{t(`moods.${m}`, { min: fastMinutes })}</span>
          <span className="mood-emoji" style={{ animationDelay: `${i * 0.3}s` }} aria-hidden>{emoji}</span>
        </button>
      ))}
    </div>
  );
}

function SafeForYou() {
  const { t } = useTranslation();
  const { passport, active } = usePassport();
  const key = JSON.stringify(passportQuery(passport));
  const { data } = useApi(() => api.get('/restaurants', { ...passportQuery(passport), safeOnly: true, sort: 'safe', limit: 8 }), [key], { enabled: active });
  if (!active || !data?.items.length) return null;
  return (
    <section className="home-section">
      <div className="row-between section-head">
        <h2 className="section-title">✅ {t('home.safeForYou')}</h2>
      </div>
      <div className="h-scroll">
        {data.items.map((r) => <RestaurantCard key={r.id} restaurant={r} compact />)}
      </div>
    </section>
  );
}

/** Three dish photos fanned out in gold frames (top-rated restaurants with a photo); emoji if there aren't enough. */
function HeroFan() {
  const { data } = useApi(() => api.get('/restaurants', { sort: 'rating', limit: 20 }), []);
  const photos = (data?.items || []).filter((r) => r.imageUrl).slice(0, 3);
  if (photos.length < 3) return <span className="hero-deco" aria-hidden>🍜</span>;
  return (
    <div className="hero-fan" aria-hidden>
      {photos.map((r, i) => <img key={r.id} src={r.imageUrl} alt="" className={`f${i + 1}`} loading="eager" />)}
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const meta = useMeta();
  const { user, isCustomer } = useAuth();
  const { passport, active } = usePassport();
  const [q, setQ] = useQueryState(DEFAULTS);
  const [searchText, setSearchText] = useState(q.search);
  const listRef = useRef(null);

  // Debounced search-as-you-type.
  useEffect(() => {
    const id = setTimeout(() => searchText !== q.search && setQ({ search: searchText }), 350);
    return () => clearTimeout(id);
  }, [searchText]); // eslint-disable-line react-hooks/exhaustive-deps

  const pq = passportQuery(passport);
  const key = JSON.stringify([q, pq]);
  const { data, loading, error, reload } = useApi(() => api.get('/restaurants', { ...q, ...pq, limit: 12 }), [key]);

  const toggleDiet = (tag) => setQ({ diet: q.diet.includes(tag) ? q.diet.filter((d) => d !== tag) : [...q.diet, tag] });
  const hasFilters = q.search || q.cuisine || q.diet.length || q.minRating || q.orderType || q.mood;
  const pickMood = (mood) => {
    setQ({ mood });
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-card">
            <HeroFan />
            {isCustomer && user?.addressLine1 && (
              <Link to="/profile" className="hero-address">📍 {t('home.deliverTo')} <strong>{user.addressLine2 || user.addressLine1}</strong> ▾</Link>
            )}
            <h1>{user ? t('home.hello', { name: user.name.split(' ')[0] }) : t('home.heroTitle')}</h1>
            <p className="hero-sub">{t('app.tagline')}</p>
            <form className="search-bar" role="search" onSubmit={(e) => { e.preventDefault(); setQ({ search: searchText }); }}>
              <span aria-hidden className="search-icon">🔍</span>
              <input type="search" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder={t('home.searchPlaceholder')} aria-label={t('common.search')} />
            </form>
          </div>
          <div className="hero-controls">
            <PassportBar />
          </div>
        </div>
      </section>

      <div className="container">
        <section className="home-section">
          <h2 className="section-title">{t('moods.title')}</h2>
          <MoodGrid value={q.mood} onPick={pickMood} />
        </section>

        {!hasFilters && <SafeForYou />}

        <section className="home-section" ref={listRef}>
          <div className="row-between section-head wrap">
            <h2 className="section-title">{q.mood ? `${MOODS.find(([m]) => m === q.mood)?.[1]} ${t(`moods.${q.mood}`, { min: meta.fastMinutes || 20 })}` : t('home.allRestaurants')}</h2>
            <Segmented ariaLabel={t('checkout.howToReceive')} value={q.orderType} onChange={(v) => setQ({ orderType: v })}
              options={[
                { value: '', label: t('common.all') },
                { value: 'delivery', label: t('orderType.delivery'), icon: '🛵' },
                { value: 'pickup', label: t('orderType.pickup'), icon: '🛍️' },
              ]} />
          </div>

          <div className="cuisine-scroller" role="group" aria-label={t('home.cuisines')}>
            <button type="button" className={`cuisine-pill ${!q.cuisine ? 'is-active' : ''}`} onClick={() => setQ({ cuisine: '' })}>
              <span aria-hidden>🍽️</span>{t('common.all')}
            </button>
            {meta.cuisines.map((c) => (
              <button key={c} type="button" className={`cuisine-pill ${q.cuisine === c ? 'is-active' : ''}`} onClick={() => setQ({ cuisine: q.cuisine === c ? '' : c })}>
                <span aria-hidden style={{ '--c': cuisineTint(c) }}>{cuisineEmoji(c)}</span>{t(`cuisine.${c}`)}
              </button>
            ))}
          </div>

          <div className="filter-bar">
            <div className="chip-row" role="group" aria-label={t('home.diet')}>
              {meta.dietaryTags.map((tag) => (
                <Chip key={tag} active={q.diet.includes(tag)} onClick={() => toggleDiet(tag)}>{t(`diet.${tag}`)}</Chip>
              ))}
            </div>
            <div className="filter-selects">
              <select className="input select input-sm" value={q.minRating} onChange={(e) => setQ({ minRating: e.target.value })} aria-label={t('home.minRating')}>
                <option value="">{t('home.anyRating')}</option>
                {[4.5, 4, 3].map((r) => <option key={r} value={r}>★ {r}+</option>)}
              </select>
              <select className="input select input-sm" value={q.sort} onChange={(e) => setQ({ sort: e.target.value })} aria-label={t('common.sortBy')}>
                {[...(active ? ['safe'] : []), 'rating', 'fast', 'delivery_fee', 'newest', 'name'].map((s) => <option key={s} value={s}>{t(`home.sort.${s}`)}</option>)}
              </select>
            </div>
          </div>

          {data && (
            <div className="row-between list-meta">
              <span className="muted small">{t('common.results', { count: data.totalCount })}</span>
              {hasFilters && <button type="button" className="link-btn small" onClick={() => { setSearchText(''); setQ(DEFAULTS); }}>{t('common.reset')}</button>}
            </div>
          )}

          {error ? <ErrorState error={error} onRetry={reload} /> : loading && !data ? (
            <div className="grid-cards">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="card skeleton" />)}</div>
          ) : data.items.length === 0 ? (
            <EmptyState icon="🔎" title={t('home.noResults')} />
          ) : (
            <>
              <div className={`grid-cards ${loading ? 'is-loading' : ''}`}>
                {data.items.map((r, i) => <div key={r.id} className="appear" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}><RestaurantCard restaurant={r} /></div>)}
              </div>
              <Pagination page={data.page} totalPages={data.totalPages} onChange={(page) => setQ({ page })} />
            </>
          )}
        </section>
      </div>
    </>
  );
}
