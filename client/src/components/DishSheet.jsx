import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { usePassport } from '../context/PassportContext';
import { evaluate } from '../utils/passport';
import { cuisineEmoji, localized, lt, won } from '../utils/format';
import { flyToCart } from '../utils/fly';
import { Thumb, DietTags } from './Cards';
import { PassportPill } from './Passport';
import { QtyStepper } from '../pages/Cart';

/** Read the Korean name aloud (browser speech synthesis — free, works offline on most phones). */
function speakKorean(text) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* not supported */ }
}

/** Verdict block shared by the sheet. */
export function Verdict({ item, alternatives = [], onPick }) {
  const { t } = useTranslation();
  const { passport, active } = usePassport();
  const v = evaluate(item, passport);
  const reasons = [
    ...(v.blockedAllergens.length ? [t('passport.contains', { list: v.blockedAllergens.map((a) => t(`allergens.${a}`)).join(', ') })] : []),
    ...v.missingDiets.map((d) => t('passport.notDiet', { diet: t(`diet.${d}`) })),
  ];

  if (!active) return null;
  if (!v.safe) {
    const alt = alternatives.find((a) => a.id !== item.id && evaluate(a, passport).safe);
    return (
      <div className="verdict verdict-bad" role="alert">
        <strong>⚠️ {t('passport.notForYou', { reasons: reasons.join(', ') })}</strong>
        {alt && <p>{t('passport.tryInstead')} <button type="button" className="link-btn" onClick={() => onPick(alt)}>{lt(alt, 'name')} →</button></p>}
      </div>
    );
  }
  return (
    <div className={`verdict ${v.tooSpicy ? 'verdict-warn' : 'verdict-good'}`}>
      <strong>✅ {t('passport.safe')}</strong>
      {v.tooSpicy && <p>🌶️ {t('passport.spiceWarn')}</p>}
    </div>
  );
}

/**
 * Bottom sheet with full dish details: photo, local + Korean name with pronunciation,
 * passport verdict, "What is it?" for foreigners, facts, quantity and add button.
 */
export default function DishSheet({ item, restaurant, alternatives, canOrder, onAdd, onClose, onPick }) {
  const { t, i18n } = useTranslation();
  const { passport, active } = usePassport();
  const [qty, setQty] = useState(1);
  const [closing, setClosing] = useState(false);
  const addRef = useRef(null);
  const sheetRef = useRef(null);

  const close = useCallback(() => { setClosing(true); setTimeout(onClose, 220); }, [onClose]);

  useEffect(() => { setQty(1); sheetRef.current?.scrollTo?.(0, 0); }, [item?.id]);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);
  useEffect(() => {
    document.body.classList.add('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, []);

  if (!item) return null;

  const name = localized(item, 'name');
  const desc = lt(item, 'description');
  const explanation = i18n.language === item.sourceLanguage ? null : item.translations?.[i18n.language]?.explanation;
  const blocked = active && !evaluate(item, passport).safe;
  const showKorean = item.sourceLanguage === 'ko' && i18n.language !== 'ko';

  const add = () => {
    if (onAdd(item, qty) === false) return; // e.g. the cart already has the maximum number of restaurants
    flyToCart(addRef.current, cuisineEmoji(restaurant.cuisineType), item.imageUrl);
    close();
  };

  return createPortal(
    <div className={`sheet-backdrop ${closing ? 'is-closing' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={name.text} ref={sheetRef}>
        <div className="sheet-media">
          <Thumb src={item.imageUrl} cuisine={restaurant.cuisineType} alt={name.text} className="sheet-thumb" />
          <span className="sheet-grab" aria-hidden />
          <button type="button" className="sheet-close" onClick={close} aria-label={t('common.close')}>✕</button>
          <div className="sheet-pill"><PassportPill /></div>
        </div>
        <div className="sheet-body">
          <div className="row-between sheet-title">
            <div className="grow">
              <h2>{name.text}{item.spiceLevel > 0 && <span className="spice">{' '}{'🌶️'.repeat(item.spiceLevel)}</span>}</h2>
              {showKorean && (
                <button type="button" className="korean-name" onClick={() => speakKorean(item.name)} title={t('dish.listen')}>
                  <span lang="ko">{item.name}</span>{item.romanization && <span className="muted"> · {item.romanization}</span>} <span aria-hidden>🔊</span>
                </button>
              )}
            </div>
            <strong className="sheet-price">{won(item.price)}</strong>
          </div>
          {desc && <p className="sheet-desc">{desc}</p>}
          {name.translated && <p className="muted small">🌐 {t('common.autoTranslated')}</p>}

          <Verdict item={item} alternatives={alternatives} onPick={onPick} />

          {explanation && (
            <div className="explain">
              <h3>🧑‍🍳 {t('dish.whatIsIt')}</h3>
              <p>{explanation}</p>
            </div>
          )}

          <div className="facts-grid">
            <div><span>{t('restaurant.spice')}</span><strong>{item.spiceLevel ? '🌶️'.repeat(item.spiceLevel) : '😌'} {t(`spice.${item.spiceLevel}`)}</strong></div>
            <div className="span-2"><span>{t('restaurant.contains')}</span><strong>{item.allergens.length ? item.allergens.map((a) => t(`allergens.${a}`)).join(', ') : t('common.none')}</strong></div>
          </div>
          <DietTags tags={item.dietaryTags} max={6} />
          <p className="muted small dish-note">ℹ️ {t('dish.allergenNote')}</p>
        </div>
        {canOrder && (
          <div className="sheet-cta">
            <QtyStepper value={qty} onChange={(q) => setQty(Math.max(1, q))} label={name.text} />
            {item.isAvailable ? (
              <button ref={addRef} type="button" className={`btn btn-lg grow ${blocked ? 'btn-locked' : 'btn-primary btn-pulse'}`} disabled={blocked} onClick={add}>
                {blocked ? `🔒 ${t('passport.locked')}` : t('dish.add', { price: won(item.price * qty) })}
              </button>
            ) : <button type="button" className="btn btn-lg grow btn-locked" disabled>{t('menuItem.unavailable')}</button>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
