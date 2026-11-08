import { useState } from 'react';
import ReviewText from '../../components/ReviewText';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useApi } from '../../hooks/useApi';
import { Thumb } from '../../components/Cards';
import { Badge, EmptyState, ErrorState, Loading, PageHeader, Pagination, Rating, Stars } from '../../components/ui';
import { dateOnly } from '../../utils/format';
import { FlaggedDishesNotice } from '../admin/AdminDishes';

function RestaurantReviews({ restaurant }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data } = useApi(() => api.get(`/restaurants/${restaurant.id}/reviews`, { page, limit: 5 }), [restaurant.id, page]);
  if (!data) return <Loading />;
  if (!data.items.length) return <p className="muted small">{t('restaurant.noReviews')}</p>;
  return (
    <div className="stack-sm">
      {data.items.map((r) => (
        <div key={r.id} className="review compact">
          <div className="row-between"><span><Stars value={r.rating} size="sm" /> <strong className="small">{r.customerName}</strong></span><span className="muted small">{dateOnly(r.createdAt)}</span></div>
          <ReviewText review={r} className="small" />
          {!r.isApproved && <Badge>{t('review.hidden')}</Badge>}
        </div>
      ))}
      <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
    </div>
  );
}

export default function ManagerDashboard() {
  const { t } = useTranslation();
  const rq = useApi(() => api.get('/restaurants', { managed: true, limit: 50, sort: 'name' }), []);
  const oq = useApi(() => api.get('/orders', { active: true, limit: 1 }), []);
  const pq = useApi(() => api.get('/orders', { status: 'pending', limit: 1 }), []);
  const [openReviews, setOpenReviews] = useState(null);

  if (rq.error) return <ErrorState error={rq.error} onRetry={rq.reload} />;
  if (!rq.data) return <Loading />;
  const restaurants = rq.data.items;

  return (
    <div className="container">
      <PageHeader title={t('manage.title')} actions={<Link to="/manage/restaurants/new" className="btn btn-primary btn-sm">+ {t('manage.addRestaurant')}</Link>} />
      <FlaggedDishesNotice />
      <div className="stat-grid">
        <Link to="/manage/orders?status=pending" className="card stat">
          <span className="stat-label">{t('manage.newOrders')}</span>
          <strong className="stat-value accent">{pq.data?.totalCount ?? '–'}</strong>
        </Link>
        <Link to="/manage/orders?active=true" className="card stat">
          <span className="stat-label">{t('manage.activeOrders')}</span>
          <strong className="stat-value">{oq.data?.totalCount ?? '–'}</strong>
        </Link>
        <Link to="/manage/orders" className="card stat stat-cta">
          <span className="stat-label">{t('manage.openOrderDesk')}</span>
          <strong className="stat-value">→</strong>
        </Link>
      </div>

      {restaurants.length === 0 ? (
        <EmptyState icon="🏪" title={t('manage.noRestaurants')} action={<Link to="/manage/restaurants/new" className="btn btn-primary">+ {t('manage.addRestaurant')}</Link>} />
      ) : (
        <div className="stack">
          {restaurants.map((r) => (
            <article key={r.id} className="card pad manage-restaurant">
              <div className="row gap-md">
                <Thumb src={r.imageUrl} cuisine={r.cuisineType} className="thumb-md" />
                <div className="grow">
                  <div className="row gap-sm wrap">
                    <h2 className="section-title">{r.name}</h2>
                    {r.isActive ? <Badge tone="green">{t('common.active')}</Badge> : <Badge tone="amber">{t('restaurant.pendingApproval')}</Badge>}
                  </div>
                  <Rating value={r.averageRating} count={r.reviewCount} />
                </div>
              </div>
              <div className="row gap-sm wrap">
                <Link to={`/manage/restaurants/${r.id}/menu`} className="btn btn-secondary btn-sm">🍽️ {t('manage.menu')}</Link>
                <Link to={`/manage/restaurants/${r.id}/edit`} className="btn btn-ghost btn-sm">✏️ {t('manage.editProfile')}</Link>
                <Link to={`/manage/orders?restaurantId=${r.id}`} className="btn btn-ghost btn-sm">🧾 {t('manage.orders')}</Link>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpenReviews(openReviews === r.id ? null : r.id)}>💬 {t('manage.reviews')}</button>
              </div>
              {openReviews === r.id && <RestaurantReviews restaurant={r} />}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
