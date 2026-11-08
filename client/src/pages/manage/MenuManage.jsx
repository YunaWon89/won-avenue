import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, toFormData } from '../../api/client';
import { useApi } from '../../hooks/useApi';
import { useMeta } from '../../context/MetaContext';
import { useToast } from '../../context/ToastContext';
import { DietTags, Thumb } from '../../components/Cards';
import { ImageInput } from '../../components/ImageInput';
import {
  Alert, Badge, Checkbox, Chip, ConfirmDialog, EmptyState, ErrorState, Field, Input, Loading, Modal, PageHeader, Select, Spinner, Switch, Textarea,
} from '../../components/ui';
import { apiErrorMessage, rules, validate } from '../../utils/validation';
import { won } from '../../utils/format';
import { DishStatusBadge } from '../admin/AdminDishes';
import { LANGUAGES, LANGUAGE_NAMES } from '../../i18n';

/** Shows machine translations per language; the owner can correct any of them. */
function TranslationsPanel({ item, sourceLanguage, edits, setEdits }) {
  const { t } = useTranslation();
  const meta = useMeta();
  const [lang, setLang] = useState(LANGUAGES.find((l) => l !== sourceLanguage));
  if (!item) return <p className="muted small">🌐 {meta.autoTranslate ? t('manage.translateOnSave') : t('manage.translateOff')}</p>;
  const current = edits[lang] !== undefined ? edits[lang] : item.translations?.[lang];
  const set = (field, value) => setEdits({ ...edits, [lang]: { ...(current || {}), [field]: value } });
  const status = item.translationStatus || 'none';
  return (
    <div className="translations-panel">
      <div className="row-between wrap">
        <strong>🌐 {t('manage.translations')}</strong>
        <span className={`badge badge-${status === 'done' ? 'green' : status === 'pending' ? 'amber' : 'gray'}`}>{t(`manage.trStatus.${status}`)}</span>
      </div>
      <div className="chip-row">
        {LANGUAGES.filter((l) => l !== sourceLanguage).map((l) => (
          <Chip key={l} size="sm" active={lang === l} onClick={() => setLang(l)}>
            {l.toUpperCase()}{(edits[l] || item.translations?.[l])?.manual ? ' ✎' : ''}
          </Chip>
        ))}
      </div>
      <div className="stack-sm" lang={lang}>
        <Input label={`${t('manage.itemName')} · ${LANGUAGE_NAMES[lang]}`} value={current?.name || ''} onChange={(e) => set('name', e.target.value)} maxLength={100} />
        <Textarea label={t('manage.description')} rows={2} value={current?.description || ''} onChange={(e) => set('description', e.target.value)} maxLength={1000} />
        <Textarea label={t('manage.explanation')} rows={2} value={current?.explanation || ''} onChange={(e) => set('explanation', e.target.value)} maxLength={1000} />
        <div className="row-between wrap small">
          <span className="muted">{current?.manual || edits[lang] ? `✎ ${t('manage.manualHint')}` : t('manage.autoHint')}</span>
          {(current?.manual || edits[lang]) && <button type="button" className="link-btn small" onClick={() => setEdits({ ...edits, [lang]: null })}>{t('manage.resetAuto')}</button>}
        </div>
      </div>
    </div>
  );
}

function ItemModal({ open, onClose, restaurant, item, onSaved }) {
  const { t } = useTranslation();
  const meta = useMeta();
  const toast = useToast();
  const blank = {
    name: '', description: '', price: '', categoryId: '', isAvailable: true, allergens: [], dietaryTags: [], spiceLevel: 0,
    sourceLanguage: restaurant.sourceLanguage, romanization: '', explanation: '',
  };
  const [v, setV] = useState(item ? {
    ...blank, ...item, categoryId: item.categoryId || '', description: item.description || '', romanization: item.romanization || '', explanation: item.explanation || '',
  } : blank);
  const [edits, setEdits] = useState({});
  const [retranslate, setRetranslate] = useState(false);
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const toggle = (k, x) => setV({ ...v, [k]: v[k].includes(x) ? v[k].filter((y) => y !== x) : [...v[k], x] });

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate({ name: [rules.required, rules.min(2), rules.max(100)], price: [rules.required, rules.price], description: [rules.max(1000)] }, v);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setFormError('');
    const payload = {
      name: v.name, description: v.description, price: Number(v.price), categoryId: v.categoryId || null, isAvailable: v.isAvailable,
      allergens: v.allergens, dietaryTags: v.dietaryTags, spiceLevel: v.spiceLevel, sourceLanguage: v.sourceLanguage,
      romanization: v.romanization, explanation: v.explanation,
      ...(Object.keys(edits).length ? { translations: JSON.stringify(edits) } : {}),
      ...(retranslate ? { retranslate: true } : {}),
      ...(file ? { image: file } : {}),
    };
    try {
      const body = toFormData(item ? payload : { ...payload, restaurantId: restaurant.id });
      if (item) await api.patch(`/menu-items/${item.id}`, body); else await api.post('/menu-items', body);
      toast.success(t('manage.itemSaved'));
      onSaved();
      onClose();
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setFormError(apiErrorMessage(t, err));
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title={item ? t('manage.editItem') : t('manage.addItem')}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form="item-form" className="btn btn-primary" disabled={busy}>{busy ? <Spinner size={16} /> : t('common.save')}</button>
        </>
      )}>
      <form id="item-form" className="stack" onSubmit={submit} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        {item && ['needs_changes', 'removed'].includes(item.reviewStatus) && item.adminNote && (
          <Alert tone="warning">💬 {t('dishCheck.adminSays')}: {item.adminNote}<br /><small>{t('dishCheck.saveToResubmit')}</small></Alert>
        )}
        <div className="item-form-top">
          <ImageInput label={t('manage.image')} current={item?.imageUrl} file={file} onChange={setFile} />
          <div className="stack">
            <Input label={t('manage.itemName')} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={errors.name} required maxLength={100} />
            <div className="grid-2">
              <Input label={t('manage.price')} type="number" min="100" step="100" inputMode="numeric" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} error={errors.price} required />
              <Select label={t('manage.category')} value={v.categoryId} onChange={(e) => setV({ ...v, categoryId: e.target.value })} error={errors.categoryId}>
                <option value="">{t('restaurant.uncategorized')}</option>
                {restaurant.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
          </div>
        </div>
        <Textarea label={t('manage.description')} rows={3} maxLength={1000} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} error={errors.description}
          hint={`${v.description.length} / 1000`} />
        <div className="grid-2">
          <Select label={t('manage.writtenIn')} value={v.sourceLanguage} onChange={(e) => setV({ ...v, sourceLanguage: e.target.value })}>
            {LANGUAGES.map((l) => <option key={l} value={l}>{LANGUAGE_NAMES[l]}</option>)}
          </Select>
          <Field label={t('manage.spiceLevel')}>
            <div className="chip-row">
              {[0, 1, 2, 3].map((n) => <Chip key={n} active={v.spiceLevel === n} onClick={() => setV({ ...v, spiceLevel: n })}>{n ? '🌶️'.repeat(n) : t('spice.0')}</Chip>)}
            </div>
          </Field>
        </div>
        <p className="muted small">🌐 {meta.autoTranslate ? t('manage.translateHint') : t('manage.translateOff')}</p>

        <Field label={t('manage.allergens')} hint={t('manage.allergensHint')}>
          <div className="chip-row wrap">
            {meta.allergens.map((a) => <Chip key={a} size="sm" tone="danger" active={v.allergens.includes(a)} onClick={() => toggle('allergens', a)}>{t(`allergens.${a}`)}</Chip>)}
          </div>
        </Field>
        <Field label={t('manage.dietary')} error={errors.dietaryTags}>
          <div className="chip-row wrap">
            {meta.dietaryTags.map((d) => <Chip key={d} size="sm" active={v.dietaryTags.includes(d)} onClick={() => toggle('dietaryTags', d)}>{t(`diet.${d}`)}</Chip>)}
          </div>
        </Field>
        <div className="grid-2">
          <Input label={t('manage.romanization')} value={v.romanization} placeholder="kimchi-jjigae" maxLength={150}
            onChange={(e) => setV({ ...v, romanization: e.target.value })} hint={t('manage.romanizationHint')} />
          <Textarea label={t('manage.explanation')} rows={2} maxLength={1000} value={v.explanation} hint={t('manage.explanationHint')}
            onChange={(e) => setV({ ...v, explanation: e.target.value })} />
        </div>
        <TranslationsPanel item={item} sourceLanguage={v.sourceLanguage} edits={edits} setEdits={setEdits} />
        {item && meta.autoTranslate && <Checkbox label={t('manage.retranslate')} checked={retranslate} onChange={setRetranslate} />}
        <Switch label={t('manage.available')} checked={v.isAvailable} onChange={(c) => setV({ ...v, isAvailable: c })} />
      </form>
    </Modal>
  );
}

function Categories({ restaurant, onChange }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post('/categories', { restaurantId: restaurant.id, name: name.trim(), sortOrder: restaurant.categories.length });
      setName(''); onChange();
    } catch (err) { toast.error(apiErrorMessage(t, err)); }
  };
  const rename = async (e) => {
    e.preventDefault();
    try { await api.patch(`/categories/${editing.id}`, { name: editing.name }); setEditing(null); onChange(); } catch (err) { toast.error(apiErrorMessage(t, err)); }
  };
  const move = async (c, dir) => {
    const list = [...restaurant.categories];
    const i = list.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await Promise.all(list.map((x, idx) => api.patch(`/categories/${x.id}`, { sortOrder: idx })));
    onChange();
  };
  const remove = async () => {
    try { await api.delete(`/categories/${deleting.id}`); toast.success(t('manage.deleted')); onChange(); } catch (err) { toast.error(apiErrorMessage(t, err)); }
    setDeleting(null);
  };
  return (
    <section className="card pad stack">
      <h2 className="section-title">{t('manage.categories')}</h2>
      <p className="muted small">{t('manage.isSideHint')}</p>
      <ul className="category-list">
        {restaurant.categories.map((c, i) => (
          <li key={c.id}>
            {editing?.id === c.id ? (
              <form className="row gap-sm grow" onSubmit={rename}>
                <input className="input input-sm" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus aria-label={t('manage.categoryName')} />
                <button type="submit" className="btn btn-primary btn-sm">{t('common.save')}</button>
              </form>
            ) : (
              <div className="cat-row">
                <div className="cat-top">
                  <span className="cat-name">{c.name} <span className="muted small">({c.itemCount})</span></span>
                  <button type="button" className={`side-toggle ${c.isSide ? 'is-on' : ''}`} title={t('manage.isSideHint')} aria-pressed={c.isSide}
                    onClick={async () => { await api.patch(`/categories/${c.id}`, { isSide: !c.isSide }); onChange(); }}>
                    {c.isSide ? '🥤 ' : ''}{t('manage.isSide')}
                  </button>
                </div>
                <div className="cat-actions">
                  <button type="button" className="icon-btn sm" onClick={() => move(c, -1)} disabled={i === 0} aria-label="up">↑</button>
                  <button type="button" className="icon-btn sm" onClick={() => move(c, 1)} disabled={i === restaurant.categories.length - 1} aria-label="down">↓</button>
                  <button type="button" className="link-btn small" onClick={() => setEditing({ id: c.id, name: c.name })}>{t('common.edit')}</button>
                  <button type="button" className="link-btn small danger" onClick={() => setDeleting(c)}>{t('common.delete')}</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <form className="row gap-sm" onSubmit={add}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('manage.categoryName')} maxLength={100} aria-label={t('manage.categoryName')} />
        <button type="submit" className="btn btn-secondary" disabled={!name.trim()}>{t('common.add')}</button>
      </form>
      <ConfirmDialog open={Boolean(deleting)} title={t('common.delete')} text={t('manage.deleteCategoryConfirm')} danger onCancel={() => setDeleting(null)} onConfirm={remove} />
    </section>
  );
}

export default function MenuManage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const toast = useToast();
  const [modal, setModal] = useState(null); // { item } | { item: null }
  const [deleting, setDeleting] = useState(null);
  const [search, setSearch] = useState('');
  const rq = useApi(() => api.get(`/restaurants/${id}`), [id]);
  const iq = useApi(() => api.get(`/restaurants/${id}/menu-items`, { limit: 50, search }), [id, search]);
  const restaurant = rq.data?.data;
  const [params, setParams] = useSearchParams();
  const fixId = params.get('fix');
  useEffect(() => {
    if (!fixId || !iq.data) return;
    const it = iq.data.items.find((x) => x.id === fixId);
    if (it) { setModal({ item: it }); setParams({}, { replace: true }); }
  }, [fixId, iq.data, setParams]);

  if (rq.error) return <ErrorState error={rq.error} onRetry={rq.reload} />;
  if (!restaurant) return <Loading />;

  const refresh = () => { rq.reload({ quiet: true }); iq.reload({ quiet: true }); };
  const toggleAvailable = async (item) => {
    try { await api.patch(`/menu-items/${item.id}`, { isAvailable: !item.isAvailable }); iq.reload({ quiet: true }); } catch (err) { toast.error(apiErrorMessage(t, err)); }
  };
  const remove = async () => {
    try { await api.delete(`/menu-items/${deleting.id}`); toast.success(t('manage.deleted')); refresh(); } catch (err) { toast.error(apiErrorMessage(t, err)); }
    setDeleting(null);
  };

  return (
    <div className="container">
      <PageHeader title={restaurant.name} subtitle={t('manage.menu')}
        back={<Link to="/manage" className="back-link">‹ {t('manage.title')}</Link>}
        actions={(
          <>
            <Link to={`/manage/restaurants/${id}/edit`} className="btn btn-ghost btn-sm">{t('manage.editProfile')}</Link>
            <Link to={`/restaurants/${id}`} className="btn btn-ghost btn-sm">{t('common.view')}</Link>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal({ item: null })}>+ {t('manage.addItem')}</button>
          </>
        )} />
      {!restaurant.isActive && <Alert tone="warning">{t('restaurant.pendingApproval')}</Alert>}
      <div className="manage-layout">
        <Categories restaurant={restaurant} onChange={refresh} />
        <section className="stack">
          <input type="search" className="input" placeholder={t('restaurant.searchMenu')} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('restaurant.searchMenu')} />
          {iq.error ? <ErrorState error={iq.error} onRetry={iq.reload} /> : !iq.data ? <Loading /> : iq.data.items.length === 0 ? (
            <EmptyState icon="🍳" title={t('common.empty')} action={<button type="button" className="btn btn-primary" onClick={() => setModal({ item: null })}>+ {t('manage.addItem')}</button>} />
          ) : (
            <ul className="stack-sm">
              {iq.data.items.map((it) => (
                <li key={it.id} className={`card manage-item ${it.isAvailable ? '' : 'is-soldout'}`}>
                  <Thumb src={it.imageUrl} cuisine={restaurant.cuisineType} className="thumb-sm" />
                  <div className="grow">
                    <div className="row gap-sm wrap">
                      <strong>{it.name}</strong>
                      {it.categoryName && <Badge>{it.categoryName}</Badge>}
                      {!it.isAvailable && <Badge tone="amber">{t('manage.soldOut')}</Badge>}
                      {it.translationStatus === 'pending' && <Badge tone="amber">🌐 {t('manage.trStatus.pending')}</Badge>}
                      {['needs_changes', 'removed'].includes(it.reviewStatus) && <DishStatusBadge status={it.reviewStatus} />}
                    </div>
                    {Object.keys(it.translations || {}).length > 0 && (
                      <p className="muted small">🌐 {it.translations.en?.name || Object.values(it.translations)[0]?.name} · {Object.keys(it.translations).length + 1} {t('manage.langsShort')}</p>
                    )}
                    <p className="small"><strong>{won(it.price)}</strong>
                      {it.allergens.length > 0 && <span className="muted"> · ⚠️ {it.allergens.map((a) => t(`allergens.${a}`)).join(', ')}</span>}
                    </p>
                    <DietTags tags={it.dietaryTags} max={5} />
                    {['needs_changes', 'removed'].includes(it.reviewStatus) && it.adminNote && (
                      <p className="admin-note">💬 {it.adminNote}</p>
                    )}
                  </div>
                  <div className="manage-item-actions">
                    <Switch checked={it.isAvailable} onChange={() => toggleAvailable(it)} label={it.isAvailable ? t('manage.available') : t('manage.soldOut')} />
                    <div className="row gap-sm">
                      <button type="button" className="link-btn small" onClick={() => setModal({ item: it })}>{t('common.edit')}</button>
                      <button type="button" className="link-btn small danger" onClick={() => setDeleting(it)}>{t('common.delete')}</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {modal && <ItemModal open onClose={() => setModal(null)} restaurant={restaurant} item={modal.item} onSaved={refresh} />}
      <ConfirmDialog open={Boolean(deleting)} title={t('common.delete')} text={t('manage.deleteItemConfirm')} danger onCancel={() => setDeleting(null)} onConfirm={remove} />
    </div>
  );
}
