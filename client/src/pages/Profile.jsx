import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePassport } from '../context/PassportContext';
import { PassportBar, usePassportSummary } from '../components/Passport';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { AddressFields } from '../components/AddressFields';
import { AddCardModal, CardLabel } from '../components/PaymentCards';
import { Badge, ConfirmDialog, EmptyState, Input, Loading, PageHeader, Spinner } from '../components/ui';
import { apiErrorMessage, rules, validate } from '../utils/validation';
import { formatPhone } from '../utils/format';

function InfoSection() {
  const { t } = useTranslation();
  const { user, updateProfile, isCustomer } = useAuth();
  const toast = useToast();
  const [v, setV] = useState({
    name: user.name, phone: user.phone || '', postalCode: user.postalCode || '', addressLine1: user.addressLine1 || '', addressLine2: user.addressLine2 || '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    const errs = validate({ name: [rules.required, rules.name], phone: [rules.phone] }, v);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await updateProfile(Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '')));
      toast.success(t('profile.updated'));
    } catch (err) { setErrors(err.fieldErrors || {}); toast.error(apiErrorMessage(t, err)); } finally { setBusy(false); }
  };
  return (
    <form className="card pad stack" onSubmit={save} noValidate>
      <h2 className="section-title">{t('profile.info')}</h2>
      <Input label={t('auth.email')} value={user.email} disabled />
      <Input label={t('auth.name')} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={errors.name} required />
      <Input label={t('auth.phone')} type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: formatPhone(e.target.value) })} error={errors.phone} />
      {isCustomer && (
        <fieldset className="fieldset">
          <legend>{t('profile.addressTitle')}</legend>
          <AddressFields value={v} onChange={(a) => setV({ ...v, ...a })} errors={errors} />
        </fieldset>
      )}
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner size={16} /> : t('common.save')}</button>
    </form>
  );
}

function CardsSection({ autoOpen }) {
  const { t } = useTranslation();
  const toast = useToast();
  const cart = useCart();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(autoOpen);
  const [removing, setRemoving] = useState(null);
  const { data, loading, reload } = useApi(() => api.get('/payment-methods'), []);
  const cards = data?.data || [];

  const afterSave = () => {
    reload();
    if (params.get('next') === 'checkout' && cart.count) navigate('/checkout');
  };
  const makeDefault = async (id) => {
    await api.patch(`/payment-methods/${id}/default`).catch((err) => toast.error(apiErrorMessage(t, err)));
    reload({ quiet: true });
  };
  const remove = async () => {
    try { await api.delete(`/payment-methods/${removing}`); reload({ quiet: true }); } catch (err) { toast.error(apiErrorMessage(t, err)); }
    setRemoving(null);
  };

  return (
    <section className="card pad stack" id="cards">
      <div className="row-between">
        <h2 className="section-title">{t('profile.cards')}</h2>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>+ {t('checkout.addCard')}</button>
      </div>
      {loading ? <Loading /> : cards.length === 0 ? <EmptyState icon="💳" title={t('cards.empty')} text={t('cards.accepted')} /> : (
        <ul className="stack-sm">
          {cards.map((c) => (
            <li key={c.id} className="saved-card">
              <CardLabel card={c} />
              <div className="row gap-sm">
                {c.isDefault ? <Badge tone="green">{t('cards.default')}</Badge>
                  : <button type="button" className="link-btn small" onClick={() => makeDefault(c.id)}>{t('cards.makeDefault')}</button>}
                <button type="button" className="link-btn small danger" onClick={() => setRemoving(c.id)}>{t('cards.remove')}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <AddCardModal open={open} onClose={() => setOpen(false)} onSaved={afterSave} />
      <ConfirmDialog open={Boolean(removing)} title={t('cards.remove')} text={t('cards.removeConfirm')} danger onCancel={() => setRemoving(null)} onConfirm={remove} />
    </section>
  );
}

function PassportSection() {
  const { t } = useTranslation();
  const { configured } = usePassport();
  const summary = usePassportSummary();
  return (
    <section className="card pad stack">
      <div className="row-between">
        <h2 className="section-title">🛂 {t('passport.title')}</h2>
        <Link to="/passport" className="btn btn-secondary btn-sm">{configured ? t('common.edit') : t('passport.setupShort')}</Link>
      </div>
      <p className="muted">{configured ? summary : t('passport.setupText')}</p>
      {configured && <PassportBar compact />}
    </section>
  );
}

function PasswordSection() {
  const { t } = useTranslation();
  const toast = useToast();
  const [v, setV] = useState({ currentPassword: '', newPassword: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const errs = validate({ currentPassword: [rules.required], newPassword: [rules.required, rules.password] }, v);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api.post('/auth/me/password', v);
      toast.success(t('profile.passwordChanged'));
      setV({ currentPassword: '', newPassword: '' });
    } catch (err) {
      setErrors({ currentPassword: err.code === 'WRONG_PASSWORD' ? t('errors.WRONG_PASSWORD') : err.fieldErrors?.currentPassword, newPassword: err.fieldErrors?.newPassword });
    } finally { setBusy(false); }
  };
  return (
    <form className="card pad stack" onSubmit={submit} noValidate>
      <h2 className="section-title">{t('profile.security')}</h2>
      <Input label={t('profile.currentPassword')} type="password" autoComplete="current-password" value={v.currentPassword} onChange={(e) => setV({ ...v, currentPassword: e.target.value })} error={errors.currentPassword} />
      <Input label={t('profile.newPassword')} type="password" autoComplete="new-password" hint={t('auth.passwordHint')} value={v.newPassword} onChange={(e) => setV({ ...v, newPassword: e.target.value })} error={errors.newPassword} />
      <button type="submit" className="btn btn-secondary" disabled={busy}>{t('profile.changePassword')}</button>
    </form>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const { user, isCustomer } = useAuth();
  const [params] = useSearchParams();
  const cardsTab = params.get('tab') === 'cards';
  useEffect(() => { if (cardsTab) document.getElementById('cards')?.scrollIntoView({ behavior: 'smooth' }); }, [cardsTab]);
  return (
    <div className="container narrow">
      <PageHeader title={t('profile.title')} subtitle={`${user.email} · ${t(`roles.${user.role}`)}`} />
      <div className="stack">
        {isCustomer && <CardsSection autoOpen={cardsTab} />}
        <InfoSection />
        {isCustomer && <PassportSection />}
        <PasswordSection />
      </div>
    </div>
  );
}

/** Return page for Toss billing auth: exchanges authKey for a saved card. */
export function CardCallback() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState('');
  useEffect(() => {
    const back = sessionStorage.getItem('cardReturnTo') || '/profile';
    if (params.get('fail')) { setError(params.get('message') || t('cards.failed')); return; }
    api.post('/payment-methods', { authKey: params.get('authKey'), customerKey: params.get('customerKey') })
      .then(() => { toast.success(t('cards.added')); navigate(back, { replace: true }); })
      .catch((err) => setError(apiErrorMessage(t, err)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="container narrow">
      {error ? <EmptyState icon="⚠️" title={t('cards.failed')} text={error} /> : <div className="state"><Spinner /><p>{t('cards.registering')}</p></div>}
    </div>
  );
}
