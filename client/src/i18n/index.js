import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ko from './ko.json';
import zh from './zh.json';
import vi from './vi.json';
import th from './th.json';
import ru from './ru.json';
import ja from './ja.json';

/**
 * Supported languages — chosen by the largest foreign communities and visitor groups in Korea.
 * First-time visitors get their phone's language (falls back to English) and can change it anytime.
 */
export const LANGUAGES = ['en', 'ko', 'zh', 'vi', 'th', 'ru', 'ja'];
export const LANGUAGE_NAMES = {
  en: 'English', ko: '한국어', zh: '中文 (简体)', vi: 'Tiếng Việt', th: 'ภาษาไทย', ru: 'Русский', ja: '日本語',
};
export const LANGUAGE_ENGLISH = {
  en: 'Default', ko: 'Korean', zh: 'Chinese', vi: 'Vietnamese', th: 'Thai', ru: 'Russian', ja: 'Japanese',
};

const STORAGE_KEY = 'lang';
const CHOSEN_KEY = 'lang.chosen';

/** Language of the phone / browser if we support it (Korean phone -> 한국어), otherwise English. */
export function detectLanguage() {
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
  for (const p of prefs) {
    const code = String(p).toLowerCase().slice(0, 2);
    if (LANGUAGES.includes(code)) return code;
  }
  return 'en';
}

function initialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.includes(saved)) return saved;
  } catch { /* storage unavailable */ }
  return detectLanguage();
}

/** Has the visitor picked a language on the welcome screen yet? */
export function languageChosen() {
  try { return localStorage.getItem(CHOSEN_KEY) === '1'; } catch { return true; }
}
export function markLanguageChosen() {
  try { localStorage.setItem(CHOSEN_KEY, '1'); } catch { /* ignore */ }
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en }, ko: { translation: ko }, zh: { translation: zh }, vi: { translation: vi },
    th: { translation: th }, ru: { translation: ru }, ja: { translation: ja },
  },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

/**
 * Headings use Cormorant Garamond (Latin, Cyrillic, Vietnamese). Scripts it lacks get a matching serif,
 * loaded only for the language in use (Google Fonts serves just the characters that appear on the page).
 */
const DISPLAY_FONTS = { ko: 'Noto+Serif+KR', zh: 'Noto+Serif+SC', ja: 'Noto+Serif+JP', th: 'Noto+Serif+Thai' };
function loadDisplayFont(lng) {
  const family = DISPLAY_FONTS[lng];
  if (!family || typeof document === 'undefined' || document.getElementById(`font-${lng}`)) return;
  const link = document.createElement('link');
  link.id = `font-${lng}`; link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@600;700&display=swap`;
  document.head.appendChild(link);
}

i18n.on('languageChanged', (lng) => {
  try { localStorage.setItem(STORAGE_KEY, lng); } catch { /* ignore */ }
  document.documentElement.lang = lng;
  loadDisplayFont(lng);
});
document.documentElement.lang = i18n.language;
loadDisplayFont(i18n.language);

export default i18n;
