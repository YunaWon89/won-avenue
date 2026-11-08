import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, toFormData } from '../../api/client';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useMeta } from '../../context/MetaContext';
import { useToast } from '../../context/ToastContext';
import { ImageInput } from '../../components/ImageInput';
import { Alert, Chip, ErrorState, Field, Input, Loading, PageHeader, Select, Spinner, Switch, Textarea } from '../../components/ui';
import { apiErrorMessage, rules, validate } from '../../utils/validation';
import { formatPhone, hhmm } from '../../utils/format';
import { LANGUAGES, LANGUAGE_NAMES } from '../../i18n';

const EMPTY = {
  name: '', description: '', cuisineType: 'korean', address: '', phone: '', supportsDelivery: true, supportsPickup: true,
  deliveryFee: 3000, minOrderAmount: 12000, prepTimeMinutes: 30, sourceLanguage: 'ko', managerId: '', isActive: true, moodTags: [], opensAt: '', closesAt: '',
};
const MOOD_EMOJI = { spicy: '🔥', light: '🥗', comfort: '🍲', sweet: '🍰', late_night: '🌙' };

function Form({ initial, isNew }) {
  const { t } = useTranslation();
  const meta = useMeta();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [v, setV] = useState(initial);
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const managers = useApi(() => api.get('/admin/users', { role: 'manager', limit: 50 }), [], { enabled: isAdmin });
  const set = (k) => (e) => setV({ ...v, [k]: e?.target ? e.target.value : e });

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate({
      name: [rules.required, rules.min(2), rules.max(100)], cuisineType: [rules.required], phone: [rules.phone], description: [rules.max(2000)],
    }, v);
    if (!v.supportsDelivery && !v.supportsPickup) errs.supportsPickup = t('manage.supportsPickup');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setFormError('');
    const payload = {
      name: v.name, description: v.description, cuisineType: v.cuisineType, address: v.address, phone: v.phone,
      supportsDelivery: v.supportsDelivery, supportsPickup: v.supportsPickup, deliveryFee: Number(v.deliveryFee) || 0,
      minOrderAmount: Number(v.minOrderAmount) || 0, prepTimeMinutes: Number(v.prepTimeMinutes) || 30, sourceLanguage: v.sourceLanguage,
      moodTags: v.moodTags || [],
      opensAt: hhmm(v.opensAt), closesAt: hhmm(v.closesAt), // empty = open 24 hours
      ...(isAdmin ? { managerId: v.managerId || null, isActive: v.isActive } : {}),
      ...(file ? { image: file } : {}),
    };
    try {
      const body = toFormData(payload);
      const res = isNew ? await api.post('/restaurants', body) : await api.patch(`/restaurants/${initial.id}`, body);
      toast.success(isNew && !isAdmin ? t('manage.submittedForApproval') : t('manage.restaurantSaved'));
      navigate(isAdmin ? '/admin/restaurants' : `/manage/restaurants/${res.data.id}/menu`);
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setFormError(apiErrorMessage(t, err));
    } finally { setBusy(false); }
  };

  return (
    <form className="stack" onSubmit={submit} noValidate>
      {formError && <Alert tone="error">{formError}</Alert>}
      <section className="card pad stack">
        <ImageInput label={t('manage.image')} current={initial.imageUrl} file={file} onChange={setFile} />
        <Input label={t('manage.restaurantName')} value={v.name} onChange={set('name')} error={errors.name} required maxLength={100} />
        <div className="grid-2">
          <Select label={t('manage.cuisine')} value={v.cuisineType} onChange={set('cuisineType')} error={errors.cuisineType} required>
            {meta.cuisines.map((c) => <option key={c} value={c}>{t(`cuisine.${c}`)}</option>)}
          </Select>
          <Select label={t('manage.writtenIn')} value={v.sourceLanguage} onChange={set('sourceLanguage')}>
            {LANGUAGES.map((l) => <option key={l} value={l}>{LANGUAGE_NAMES[l]}</option>)}
          </Select>
        </div>
        <Textarea label={t('manage.description')} rows={3} value={v.description || ''} onChange={set('description')} error={errors.description} maxLength={2000}
          hint={meta.autoTranslate ? t('manage.translateHint') : undefined} />
        <Field label={t('manage.moodTags')} hint={t('manage.moodTagsHint', { min: meta.fastMinutes || 20 })}>
          <div className="chip-row wrap">
            {(meta.moodTags || Object.keys(MOOD_EMOJI)).map((m) => (
              <Chip key={m} active={(v.moodTags || []).includes(m)}
                onClick={() => setV({ ...v, moodTags: (v.moodTags || []).includes(m) ? v.moodTags.filter((x) => x !== m) : [...(v.moodTags || []), m] })}>
                {MOOD_EMOJI[m]} {t(`moods.${m}`)}
              </Chip>
            ))}
          </div>
        </Field>
        <Input label={t('restaurant.address')} value={v.address || ''} onChange={set('address')} error={errors.address} />
        <Input label={t('restaurant.phone')} type="tel" value={v.phone || ''} onChange={(e) => setV({ ...v, phone: formatPhone(e.target.value) })} error={errors.phone} />
      </section>
      <section className="card pad stack">
        <Switch label={`🛵 ${t('manage.supportsDelivery')}`} checked={v.supportsDelivery} onChange={set('supportsDelivery')} />
        <Switch label={`🛍️ ${t('manage.supportsPickup')}`} checked={v.supportsPickup} onChange={set('supportsPickup')} />
        {errors.supportsPickup && <p className="field-error">{t('orderType.deliveryAndPickup')}?</p>}
        <div className="grid-3">
          <Input label={t('manage.deliveryFee')} type="number" min="0" step="500" value={v.deliveryFee} onChange={set('deliveryFee')} disabled={!v.supportsDelivery} />
          <Input label={t('manage.minOrder')} type="number" min="0" step="1000" value={v.minOrderAmount} onChange={set('minOrderAmount')} disabled={!v.supportsDelivery} />
          <Input label={t('manage.prepTime')} type="number" min="5" max="240" value={v.prepTimeMinutes} onChange={set('prepTimeMinutes')} />
        </div>
        <div className="grid-2">
          <Input label={t('manage.opensAt')} type="time" value={hhmm(v.opensAt)} onChange={set('opensAt')} error={errors.opensAt} />
          <Input label={t('manage.closesAt')} type="time" value={hhmm(v.closesAt)} onChange={set('closesAt')} error={errors.closesAt} />
        </div>
        <p className="muted small">🕘 {t('manage.hoursHint')}</p>
      </section>
      {isAdmin && (
        <section className="card pad stack">
          <Select label={t('manage.manager')} value={v.managerId || ''} onChange={set('managerId')} error={errors.managerId}>
            <option value="">{t('manage.unassigned')}</option>
            {(managers.data?.items || []).map((m) => <option key={m.id} value={m.id}>{m.name} · {m.email}</option>)}
          </Select>
          <Switch label={t('common.active')} checked={v.isActive} onChange={set('isActive')} />
        </section>
      )}
      <div className="row gap-sm">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner size={16} /> : t('common.save')}</button>
        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}

export default function RestaurantForm() {
  const { id } = useParams();
  const { t } = useTranslation();
  const isNew = !id;
  const q = useApi(() => api.get(`/restaurants/${id}`), [id], { enabled: !isNew });
  if (!isNew && q.error) return <ErrorState error={q.error} onRetry={q.reload} />;
  if (!isNew && !q.data) return <Loading />;
  const initial = isNew ? EMPTY : { ...EMPTY, ...q.data.data, managerId: q.data.data.managerId || '' };
  return (
    <div className="container narrow">
      <PageHeader title={isNew ? t('manage.addRestaurant') : t('manage.editProfile')}
        back={<button type="button" className="back-link link-btn" onClick={() => window.history.back()}>‹ {t('common.back')}</button>} />
      <Form initial={initial} isNew={isNew} />
    </div>
  );
}
