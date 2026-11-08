import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePassport } from '../context/PassportContext';

/** "Halal · no peanut, shrimp · 🌶️ mild" */
export function usePassportSummary() {
  const { t } = useTranslation();
  const { passport } = usePassport();
  const parts = [];
  if (passport.diet.length) parts.push(passport.diet.map((d) => t(`diet.${d}`)).join(', '));
  if (passport.allergens.length) parts.push(t('passport.noList', { list: passport.allergens.map((a) => t(`allergens.${a}`)).join(', ') }));
  if ((passport.maxSpice ?? 3) < 3) parts.push(`🌶️ ≤ ${t(`spice.${passport.maxSpice}`)}`);
  return parts.join(' · ');
}

export function Toggle({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle ${on ? 'is-on' : ''}`} onClick={() => onChange(!on)}>
      <span className="toggle-thumb" />
    </button>
  );
}

/**
 * Food passport switch (home screen, restaurant menu, checkout).
 * ON  -> every dish is checked against the passport.
 * OFF -> the menu is shown like in any other app, without passport marks.
 */
export function PassportBar({ compact }) {
  const { t } = useTranslation();
  const { passport, configured, usable, setEnabled } = usePassport();
  const summary = usePassportSummary();
  if (!usable) return null;
  if (!configured) {
    return (
      <Link to="/passport" className="passport-cta">
        <span className="passport-cta-icon" aria-hidden>🛂</span>
        <span className="grow"><strong>{t('passport.setupTitle')}</strong><small>{t('passport.setupText')}</small></span>
        <span className="passport-cta-arrow" aria-hidden>›</span>
      </Link>
    );
  }
  const on = passport.enabled;
  return (
    <div className={`passport-bar ${on ? 'is-on' : 'is-off'} ${compact ? 'compact' : ''}`}>
      <span className="passport-bar-icon" aria-hidden>🛂</span>
      <div className="grow">
        <strong>{on ? t('passport.on') : t('passport.off')}</strong>
        <small>{on ? summary : t('passport.offSub')}</small>
      </div>
      <Link to="/passport" className="passport-edit">{t('common.edit')}</Link>
      <Toggle on={on} label={t('passport.title')} onChange={setEnabled} />
    </div>
  );
}

/** Small on/off pill in the dish sheet. */
export function PassportPill() {
  const { t } = useTranslation();
  const { passport, configured, setEnabled } = usePassport();
  if (!configured) return null;
  const on = passport.enabled;
  return (
    <button type="button" className={`passport-pill ${on ? 'is-on' : 'is-off'}`} aria-pressed={on} onClick={() => setEnabled(!on)}>
      🛂 {on ? t('passport.pillOn') : t('passport.pillOff')}
    </button>
  );
}
