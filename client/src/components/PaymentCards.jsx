import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useMeta } from '../context/MetaContext';
import { useToast } from '../context/ToastContext';
import { apiErrorMessage } from '../utils/validation';
import { Alert, Checkbox, Input, Modal, Spinner } from './ui';

const formatCard = (v) => v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
const formatExpiry = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

function luhn(num) {
  let sum = 0; let dbl = false;
  for (let i = num.length - 1; i >= 0; i -= 1) {
    let d = Number(num[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d; dbl = !dbl;
  }
  return sum % 10 === 0;
}

const loadToss = () => new Promise((resolve, reject) => {
  if (window.TossPayments) return resolve(window.TossPayments);
  const s = document.createElement('script');
  s.src = 'https://js.tosspayments.com/v2/standard';
  s.onload = () => resolve(window.TossPayments);
  s.onerror = reject;
  document.head.appendChild(s);
});

/** Demo card form (mock provider). Card number never leaves this request and is not stored. */
function DemoCardForm({ onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [v, setV] = useState({ number: '', expiry: '', cvc: '', isForeign: false });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const digits = v.number.replace(/\D/g, '');
    const [mm, yy] = v.expiry.split('/');
    const errs = {};
    if (digits.length < 13 || !luhn(digits)) errs.number = 'errors.cardNumber';
    if (!/^\d{2}\/\d{2}$/.test(v.expiry) || Number(mm) < 1 || Number(mm) > 12) errs.expiry = 'errors.expiry';
    if (!/^\d{3,4}$/.test(v.cvc)) errs.cvc = 'errors.cvc';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const res = await api.post('/payment-methods', { cardNumber: digits, expMonth: Number(mm), expYear: Number(yy), cvc: v.cvc, isForeign: v.isForeign });
      toast.success(t('cards.added'));
      onSaved(res.data);
    } catch (err) {
      setErrors({ number: err.fieldErrors?.cardNumber, expiry: err.fieldErrors?.expiry });
      toast.error(apiErrorMessage(t, err));
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} noValidate className="stack">
      <Alert tone="info">{t('cards.demoNotice')}</Alert>
      <Input label={t('cards.number')} value={v.number} inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000"
        onChange={(e) => setV({ ...v, number: formatCard(e.target.value) })} error={errors.number} required />
      <div className="grid-2">
        <Input label={t('cards.expiry')} value={v.expiry} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY"
          onChange={(e) => setV({ ...v, expiry: formatExpiry(e.target.value) })} error={errors.expiry} required />
        <Input label={t('cards.cvc')} value={v.cvc} inputMode="numeric" autoComplete="cc-csc" type="password" maxLength={4}
          onChange={(e) => setV({ ...v, cvc: e.target.value.replace(/\D/g, '') })} error={errors.cvc} required />
      </div>
      <Checkbox label={t('cards.foreign')} checked={v.isForeign} onChange={(c) => setV({ ...v, isForeign: c })} />
      <p className="muted small">🔒 {t('cards.accepted')}</p>
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? <Spinner size={16} /> : t('common.save')}</button>
    </form>
  );
}

/** Toss Payments billing auth: card details are entered on the Toss page, we get an authKey back. */
function TossCardButton() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { payment } = useMeta();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      const TossPayments = await loadToss();
      const toss = TossPayments(payment.tossClientKey);
      const p = toss.payment({ customerKey: payment.customerKey });
      sessionStorage.setItem('cardReturnTo', window.location.pathname);
      await p.requestBillingAuth({
        method: 'CARD',
        successUrl: `${window.location.origin}/cards/callback`,
        failUrl: `${window.location.origin}/cards/callback?fail=1`,
        customerEmail: user.email,
        customerName: user.name,
      });
    } catch (err) {
      toast.error(err?.message || t('cards.failed'));
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      <Alert tone="info">{t('cards.tossNotice')}</Alert>
      <button type="button" className="btn btn-primary btn-block" onClick={start} disabled={busy}>{busy ? <Spinner size={16} /> : t('cards.tossButton')}</button>
    </div>
  );
}

export function AddCardModal({ open, onClose, onSaved }) {
  const { t } = useTranslation();
  const { payment } = useMeta();
  return (
    <Modal open={open} onClose={onClose} title={t('cards.title')}>
      {payment.provider === 'toss' ? <TossCardButton /> : <DemoCardForm onSaved={(c) => { onSaved?.(c); onClose(); }} />}
    </Modal>
  );
}

export function CardLabel({ card }) {
  const { t } = useTranslation();
  return (
    <span className="card-label">
      <span className="card-chip" aria-hidden>💳</span>
      <span>
        <strong>{card.cardBrand}</strong> •••• {card.last4}
        <span className="muted small"> · {card.isForeign ? t('cards.international') : t('cards.domestic')}</span>
      </span>
    </span>
  );
}
