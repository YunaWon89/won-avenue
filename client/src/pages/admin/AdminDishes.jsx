import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useApi, useQueryState } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { DietTags, Thumb } from '../../components/Cards';
import { Badge, EmptyState, ErrorState, Loading, Modal, PageHeader, Pagination, Segmented, Spinner, Textarea } from '../../components/ui';
import { AdminTabs } from './Admin';
import { apiErrorMessage } from '../../utils/validation';
import { dateOnly, dateTime, localized, timeAgo, won } from '../../utils/format';

const TONE = { new: 'blue', ok: 'green', needs_changes: 'amber', removed: 'gray' };

export function DishStatusBadge({ status }) {
  const { t } = useTranslation();
  return <Badge tone={TONE[status] || 'gray'}>{t(`dishCheck.status.${status}`)}</Badge>;
}

/**
 * Admin: dishes are published immediately; the admin checks them when there is time.
 * "OK" -> checked. "Needs changes" -> message to the owner; not fixed in N days -> hidden automatically.
 */
export default function AdminDishes() {
  const { t } = useTranslation();
  const toast = useToast();
  const [q, setQ] = useQueryState({ status: 'new', search: '', page: 1 });
  const [asking, setAsking] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);
  const { data, error, loading, reload } = useApi(() => api.get('/admin/dishes', { ...q, limit: 12 }), [JSON.stringify(q)]);

  const review = async (dish, action, message) => {
    setBusy(dish.id);
    try {
      await api.patch(`/admin/dishes/${dish.id}/review`, { action, note: message });
      toast.success(action === 'approve' ? t('dishCheck.approved') : t('dishCheck.sent'));
      setAsking(null); setNote('');
      reload({ quiet: true });
    } catch (err) { toast.error(apiErrorMessage(t, err)); } finally { setBusy(null); }
  };

  return (
    <div className="container">
      <PageHeader title={t('dishCheck.title')} subtitle={t('dishCheck.subtitle')} />
      <AdminTabs />
      <div className="filters-panel card pad">
        <Segmented value={q.status} onChange={(status) => setQ({ status })} ariaLabel={t('common.status')} options={
          ['new', 'needs_changes', 'removed', 'ok', 'all'].map((s) => ({ value: s, label: t(`dishCheck.tab.${s}`) }))
        } />
        <input type="search" className="input input-sm grow" placeholder={t('dishCheck.search')} defaultValue={q.search}
          onKeyDown={(e) => e.key === 'Enter' && setQ({ search: e.currentTarget.value })} onBlur={(e) => setQ({ search: e.target.value })} aria-label={t('common.search')} />
      </div>
      {error ? <ErrorState error={error} onRetry={reload} /> : !data ? <Loading /> : data.items.length === 0 ? (
        <EmptyState icon="✅" title={q.status === 'new' ? t('dishCheck.allChecked') : t('common.empty')} />
      ) : (
        <>
          <div className={`stack-sm ${loading ? 'is-loading' : ''}`}>
            {data.items.map((d) => {
              const tr = localized(d, 'name');
              return (
                <article key={d.id} className="card pad dish-check">
                  <Thumb src={d.imageUrl} cuisine={d.cuisineType} className="thumb-md" />
                  <div className="grow">
                    <div className="row gap-sm wrap">
                      <strong>{d.name}</strong>
                      {tr.translated && <span className="muted small">· {tr.text}</span>}
                      <DishStatusBadge status={d.reviewStatus} />
                    </div>
                    <p className="small">
                      <Link to={`/restaurants/${d.restaurantId}`}>{d.restaurantName}</Link>
                      <span className="muted"> · {d.ownerName || '—'} · {won(d.price)} · {timeAgo(d.updatedAt)}</span>
                    </p>
                    {d.description && <p className="small muted">{d.description}</p>}
                    <p className="small">⚠️ {d.allergens.length ? d.allergens.map((a) => t(`allergens.${a}`)).join(', ') : t('menuItem.allergensNone')}
                      {d.spiceLevel > 0 && ` · ${'🌶️'.repeat(d.spiceLevel)}`}</p>
                    <DietTags tags={d.dietaryTags} max={6} />
                    {d.adminNote && (
                      <div className="admin-note">
                        ✉️ {d.adminNote}
                        {d.fixDeadline && <small> · {t('dishCheck.deadline', { date: dateTime(d.fixDeadline) })}</small>}
                      </div>
                    )}
                  </div>
                  <div className="dish-check-actions">
                    {d.reviewStatus !== 'ok' && (
                      <button type="button" className="btn btn-secondary btn-sm" disabled={busy === d.id} onClick={() => review(d, 'approve')}>✓ OK</button>
                    )}
                    {d.reviewStatus !== 'removed' && (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy === d.id} onClick={() => { setAsking(d); setNote(d.adminNote || ''); }}>
                        ✉️ {t('dishCheck.requestChanges')}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={(page) => setQ({ page })} />
        </>
      )}
      <Modal open={Boolean(asking)} onClose={() => setAsking(null)} title={`${t('dishCheck.requestChanges')} · ${asking?.name || ''}`}
        footer={(
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAsking(null)}>{t('common.cancel')}</button>
            <button type="button" className="btn btn-primary" disabled={note.trim().length < 5 || busy === asking?.id}
              onClick={() => review(asking, 'request_changes', note.trim())}>
              {busy === asking?.id ? <Spinner size={16} /> : t('dishCheck.send')}
            </button>
          </>
        )}>
        <Textarea label={t('dishCheck.messageLabel')} rows={4} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder={t('dishCheck.messagePlaceholder')} hint={t('dishCheck.messageHint')} />
      </Modal>
    </div>
  );
}

/** Owner: dishes the admin asked to fix (shown on the owner dashboard). */
export function FlaggedDishesNotice() {
  const { t } = useTranslation();
  const { data } = useApi(() => api.get('/manage/flagged-dishes'), []);
  const items = data?.data || [];
  if (!items.length) return null;
  return (
    <section className="card pad flagged-box">
      <h2 className="section-title">✉️ {t('dishCheck.ownerTitle', { count: items.length })}</h2>
      <ul className="stack-sm">
        {items.map((d) => (
          <li key={d.id} className="flagged-item">
            <div className="row-between wrap">
              <strong>{d.name} <span className="muted small">· {d.restaurantName}</span></strong>
              <DishStatusBadge status={d.reviewStatus} />
            </div>
            {d.adminNote && <p className="admin-note">💬 {d.adminNote}</p>}
            <p className="small muted">
              {d.reviewStatus === 'removed' ? t('dishCheck.hiddenHint') : t('dishCheck.fixBy', { date: d.fixDeadline ? dateOnly(d.fixDeadline) : '' })}
            </p>
            <Link to={`/manage/restaurants/${d.restaurantId}/menu?fix=${d.id}`} className="btn btn-primary btn-sm">{t('dishCheck.fixNow')}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
