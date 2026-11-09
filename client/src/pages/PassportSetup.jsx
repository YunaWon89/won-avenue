import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useMeta } from '../context/MetaContext';
import { usePassport } from '../context/PassportContext';
import { useToast } from '../context/ToastContext';
import { Checkbox, Chip, Spinner } from '../components/ui';
import { apiErrorMessage } from '../utils/validation';

const DIET_ICONS = { halal: '☪️', vegetarian: '🥦', vegan: '🌱', no_pork: '🚫🐷', gluten_free: '🌾' };
const ALLERGEN_ICONS = {
  peanut: '🥜', shrimp: '🦐', egg: '🥚', milk: '🥛', soy: '🫘', wheat: '🌾', crab: '🦀', shellfish: '🦪', fish: '🐟',
  sesame: '⚪', tree_nuts: '🌰', walnut: '🌰', pine_nut: '🌰', pork: '🐖', beef: '🐄', chicken: '🐔', squid: '🦑',
  mackerel: '🐟', buckwheat: '🌾', peach: '🍑', tomato: '🍅', sulfites: '🍷',
};
const COMMON = ['peanut', 'shrimp', 'egg', 'milk', 'soy', 'wheat', 'crab', 'shellfish', 'fish', 'sesame', 'tree_nuts'];

export default function PassportSetup() {
  const { t } = useTranslation();
  const meta = useMeta();
  const { user } = useAuth();
  const { passport, save } = usePassport();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const onboarding = params.get('onboarding') === '1';
  const [draft, setDraft] = useState({ ...passport, enabled: true });
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  // Diet / allergy info is health-related: ask before keeping it (once per account; guests keep it on the device).
  const needsConsent = !user?.passportConsentAt && !passport.consent;
  const [consent, setConsent] = useState(false);

  const toggle = (key, v) => setDraft((d) => ({ ...d, [key]: d[key].includes(v) ? d[key].filter((x) => x !== v) : [...d[key], v] }));
  // Full list from the server; if it hasn't arrived (slow network), the same list built into the app.
  const allAllergens = meta.allergens.length ? meta.allergens : Object.keys(ALLERGEN_ICONS);
  const allergens = showAll ? allAllergens : COMMON.filter((a) => allAllergens.includes(a));
  const hiddenCount = allAllergens.length - allergens.length;
  const extraSelected = draft.allergens.filter((a) => !COMMON.includes(a)).length;

  const submit = async () => {
    setBusy(true);
    try {
      await save({ ...draft, consent: passport.consent || consent }, { consent: consent || undefined });
      toast.success(`🛂 ${t('passport.saved')}`);
      if (onboarding || window.history.length <= 1) navigate('/');
      else navigate(-1);
    } catch (err) { toast.error(apiErrorMessage(t, err)); } finally { setBusy(false); }
  };

  const pills = [
    ...draft.diet.map((d) => `${DIET_ICONS[d] || ''} ${t(`diet.${d}`)}`),
    ...draft.allergens.map((a) => `${ALLERGEN_ICONS[a] || '⚠️'} ${t('passport.noList', { list: t(`allergens.${a}`) })}`),
    ...((draft.maxSpice ?? 3) < 3 ? [`🌶️ ${t(`spice.${draft.maxSpice}`)}`] : []),
  ];

  return (
    <div className="container narrow passport-page">
      {onboarding && <div className="steps" aria-hidden><i className="on" /><i className="on" /><i /></div>}
      <h1 className="passport-title">{t('passport.onboardTitle')}</h1>
      <p className="muted">{t('passport.onboardSub')}</p>

      <div className="passport-card" key={pills.join()}>
        <span className="passport-card-label">{t('passport.cardLabel')}</span>
        <strong className="passport-card-name">{user?.name || t('passport.you')}</strong>
        <div className="passport-card-pills">
          {pills.length ? pills.map((p, i) => <span key={p} style={{ animationDelay: `${i * 60}ms` }}>{p}</span>) : <span className="empty">{t('passport.emptyCard')}</span>}
        </div>
        {pills.length > 0 && <span className="stamp">✓ {t('passport.active')}</span>}
      </div>

      <section className="passport-q">
        <h2>{t('passport.iEat')}</h2>
        <div className="chip-row wrap">
          {(meta.passportDiets || Object.keys(DIET_ICONS)).map((d) => (
            <Chip key={d} tone="green" active={draft.diet.includes(d)} onClick={() => toggle('diet', d)}>{DIET_ICONS[d]} {t(`diet.${d}`)}</Chip>
          ))}
        </div>
      </section>

      <section className="passport-q">
        <h2>{t('passport.allergic')}</h2>
        <div className="chip-row wrap">
          {allergens.map((a) => (
            <Chip key={a} tone="danger" active={draft.allergens.includes(a)} onClick={() => toggle('allergens', a)}>{ALLERGEN_ICONS[a] || '⚠️'} {t(`allergens.${a}`)}</Chip>
          ))}
          {!showAll && hiddenCount > 0 && (
            <Chip onClick={() => setShowAll(true)}>+{hiddenCount}{extraSelected ? ` (${extraSelected})` : ''}</Chip>
          )}
        </div>
      </section>

      <section className="passport-q">
        <h2>{t('passport.spicy')}</h2>
        <div className="spice-picker" role="radiogroup" aria-label={t('passport.spicy')}>
          {[0, 1, 2, 3].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={draft.maxSpice === n} className={draft.maxSpice === n ? 'is-active' : ''}
              onClick={() => setDraft((d) => ({ ...d, maxSpice: n }))}>
              <span aria-hidden>{['😌', '🌶️', '🌶️🌶️', '🔥'][n]}</span>{n === 3 ? t('passport.veryHot') : t(`spice.${n}`)}
            </button>
          ))}
        </div>
      </section>


      <section className="passport-q passport-legal">
        <p className="small muted">ℹ️ {t('passport.disclaimer')}</p>
        {needsConsent && (
          <Checkbox checked={consent} onChange={setConsent} label={user ? t('passport.consentAccount') : t('passport.consentGuest')} />
        )}
      </section>

      <div className="sticky-cta">
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={submit} disabled={busy || (needsConsent && !consent)}>
          {busy ? <Spinner size={18} /> : `${t('passport.save')} →`}
        </button>
        {onboarding && <button type="button" className="link-btn skip-link" onClick={() => navigate('/')}>{t('passport.skip')}</button>}
      </div>
    </div>
  );
}
