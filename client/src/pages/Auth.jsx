import { useState } from 'react';
import { LogoFull } from '../components/Logo';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AddressFields } from '../components/AddressFields';
import { Alert, Input, Segmented, Spinner } from '../components/ui';
import { rules, validate, apiErrorMessage } from '../utils/validation';
import { formatPhone } from '../utils/format';

const homeFor = (role) => ({ admin: '/admin', manager: '/manage', courier: '/courier' }[role] || '/');

const DEMO = [
  ['customer@demo.com', 'roles.customer'],
  ['owner@demo.com', 'roles.manager'],
  ['courier@demo.com', 'roles.courier'],
  ['admin@demo.com', 'roles.admin'],
];

export function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [v, setV] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate({ email: [rules.required, rules.email], password: [rules.required] }, v);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setFormError('');
    try {
      const user = await login(v.email, v.password);
      toast.success(t('auth.welcome', { name: user.name, lng: user.preferredLanguage }));
      navigate(location.state?.from || homeFor(user.role), { replace: true });
    } catch (err) {
      setFormError(apiErrorMessage(t, err));
    } finally { setBusy(false); }
  };

  return (
    <div className="container auth-page">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <div className="auth-logo"><LogoFull width={140} /></div>
        <h1>{t('auth.loginTitle')}</h1>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Input label={t('auth.email')} type="email" autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} error={errors.email} required />
        <Input label={t('auth.password')} type="password" autoComplete="current-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} error={errors.password} required />
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? <Spinner size={18} /> : t('auth.loginCta')}</button>
        <p className="center muted">{t('auth.noAccount')} <Link to="/register">{t('nav.register')}</Link></p>
        <details className="demo-box">
          <summary>{t('auth.demo')}</summary>
          <div className="stack-sm">
            {DEMO.map(([email, role]) => (
              <button key={email} type="button" className="demo-account" onClick={() => setV({ email, password: 'Demo1234!' })}>
                <span>{t(role)}</span><code>{email}</code>
              </button>
            ))}
            <p className="muted small">Password: <code>Demo1234!</code></p>
          </div>
        </details>
      </form>
    </div>
  );
}

export function Register() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [v, setV] = useState({ accountType: 'customer', name: '', email: '', password: '', phone: '', postalCode: '', addressLine1: '', addressLine2: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const isCustomer = v.accountType === 'customer';

  const submit = async (e) => {
    e.preventDefault();
    const schema = {
      name: [rules.required, rules.name],
      email: [rules.required, rules.email],
      password: [rules.required, rules.password],
      phone: [rules.required, rules.phone],
    };
    if (isCustomer) schema.addressLine1 = [rules.required, rules.min(5)];
    const errs = validate(schema, v);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setFormError('');
    try {
      const payload = isCustomer ? v : { ...v, postalCode: undefined, addressLine1: undefined, addressLine2: undefined };
      const user = await register(Object.fromEntries(Object.entries(payload).filter(([, val]) => val !== '' && val !== undefined)));
      if (user.role === 'courier') {
        toast.success(t('auth.welcome', { name: user.name }));
        navigate('/courier');
      } else if (user.role === 'manager') {
        toast.success(t('auth.welcome', { name: user.name }));
        navigate('/manage/restaurants/new');
      } else {
        toast.success(t('auth.registered'));
        navigate('/profile?tab=cards&next=checkout');
      }
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setFormError(apiErrorMessage(t, err));
    } finally { setBusy(false); }
  };

  return (
    <div className="container auth-page">
      <form className="card auth-card auth-card-wide" onSubmit={submit} noValidate>
        <h1>{t('auth.registerTitle')}</h1>
        {formError && <Alert tone="error">{formError}</Alert>}
        <div className="field">
          <span className="field-label">{t('auth.accountType')}</span>
          <Segmented value={v.accountType} onChange={(accountType) => setV({ ...v, accountType })}
            options={[
              { value: 'customer', label: t('auth.asCustomer'), icon: '🍜' },
              { value: 'manager', label: t('auth.asOwner'), icon: '🏪' },
              { value: 'courier', label: t('auth.asCourier'), icon: '🛵' },
            ]} />
        </div>
        <Input label={t('auth.name')} autoComplete="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={errors.name} required />
        <Input label={t('auth.email')} type="email" autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} error={errors.email} required />
        <Input label={t('auth.password')} type="password" autoComplete="new-password" value={v.password} hint={t('auth.passwordHint')}
          onChange={(e) => setV({ ...v, password: e.target.value })} error={errors.password} required />
        <Input label={t('auth.phone')} type="tel" autoComplete="tel" placeholder="010-1234-5678" value={v.phone}
          onChange={(e) => setV({ ...v, phone: formatPhone(e.target.value) })} error={errors.phone} required />
        {isCustomer && (
          <fieldset className="fieldset">
            <legend>{t('auth.addressSection')}</legend>
            <AddressFields value={v} onChange={(a) => setV({ ...v, ...a })} errors={errors} required />
          </fieldset>
        )}
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? <Spinner size={18} /> : t('auth.registerCta')}</button>
        <p className="center muted">{t('auth.haveAccount')} <Link to="/login">{t('nav.login')}</Link></p>
      </form>
    </div>
  );
}
