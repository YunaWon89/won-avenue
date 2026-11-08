import i18n from '../i18n';

const LOCALES = {
  en: 'en-US', ko: 'ko-KR', zh: 'zh-CN', vi: 'vi-VN', th: 'th-TH-u-ca-gregory', ru: 'ru-RU', ja: 'ja-JP',
};
const locale = () => LOCALES[i18n.language] || 'en-US';

/** ₩12,000 */
export const won = (amount) => new Intl.NumberFormat(locale(), { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount || 0);

export const dateTime = (iso) => new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
export const dateOnly = (iso) => new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }).format(new Date(iso));

export const timeAgo = (iso) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  if (diff < 60) return rtf.format(-Math.round(diff), 'second');
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  return rtf.format(-Math.round(diff / 86400), 'day');
};

/**
 * Seller content in the viewer's language.
 * Returns { text, translated } — translated=true when an automatic translation was used.
 */
export function localized(entity, field, lang = i18n.language, preferOriginal = false) {
  if (!entity) return { text: '', translated: false };
  const original = entity[field] ?? '';
  if (preferOriginal || !lang || entity.sourceLanguage === lang) return { text: original, translated: false };
  const tr = entity.translations?.[lang]?.[field];
  return tr ? { text: tr, translated: true } : { text: original, translated: false };
}

export const lt = (entity, field, lang, preferOriginal) => localized(entity, field, lang, preferOriginal).text;

/** Emoji placeholder by cuisine when a restaurant/dish has no photo. */
const EMOJI = {
  korean: '🍲', chicken: '🍗', pizza: '🍕', chinese: '🥟', japanese: '🍜', western: '🍝', snack: '🍢',
  cafe_dessert: '🍰', asian: '🍛', halal: '🥙', vegan: '🥗', fast_food: '🍔',
};
export const cuisineEmoji = (c) => EMOJI[c] || '🍽️';

/** Soft tint behind each cuisine icon (CSS var so dark theme can override). */
const TINT = {
  korean: '#ffe1d1', chicken: '#ffefc2', pizza: '#ffd9df', chinese: '#ffdcd2', japanese: '#ffe4dc', western: '#fff0cc',
  snack: '#ffe0c7', cafe_dessert: '#ffdff0', asian: '#fff2bf', halal: '#d9f5e5', vegan: '#e6f9d4', fast_food: '#ffe8bd',
};
export const cuisineTint = (c) => `var(--tint-${c}, ${TINT[c] || '#fff0e6'})`;

/** Format a Korean phone number as the user types: 01012345678 -> 010-1234-5678 */
export function formatPhone(value) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.startsWith('02')) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

export const fullAddress = (u) => [u?.addressLine1, u?.addressLine2].filter(Boolean).join(', ');

/** "11:00:00" -> "11:00" (opening hours come from Postgres TIME columns). */
export const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
