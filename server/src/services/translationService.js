/**
 * Automatic translation of seller-written content (dish names, descriptions, "What is it?"
 * explanations, categories, restaurant descriptions) into every supported language.
 *
 * Providers (TRANSLATION_PROVIDER, or picked automatically from the keys that are set):
 *  - gemini: Google Gemini API. Translates with food/menu context and can write a short
 *            "What is it?" explanation for foreigners. Free tier is enough for demos.
 *  - deepl:  DeepL API (free tier available).
 *  - none:   no translation; customers see the original text.
 *
 * Content is translated ONCE when it is saved and stored in the `translations` JSONB column,
 * so viewing a menu never calls the provider. A language marked { manual: true } (edited by
 * the owner) is never overwritten. Failures never block saving: the row is marked
 * translation_status = 'pending' and retried by a background job.
 */
const env = require('../config/env');
const { LANGUAGES } = require('../config/catalog');

const LANG_NAMES = {
  en: 'English', ko: 'Korean', zh: 'Simplified Chinese', vi: 'Vietnamese', th: 'Thai', ru: 'Russian', ja: 'Japanese',
};
const DEEPL_CODES = { en: 'EN-US', ko: 'KO', zh: 'ZH-HANS', vi: 'VI', th: 'TH', ru: 'RU', ja: 'JA' };

function providerName() {
  if (env.isTest) return 'none';
  const p = env.translationProvider;
  if (p === 'gemini' && env.geminiApiKey) return 'gemini';
  if (p === 'deepl' && env.deeplApiKey) return 'deepl';
  if (p === 'auto' || !p) {
    if (env.geminiApiKey) return 'gemini';
    if (env.deeplApiKey) return 'deepl';
  }
  return 'none';
}

const isEnabled = () => providerName() !== 'none';

const targetsFor = (sourceLang) => LANGUAGES.filter((l) => l !== sourceLang);

// ---------------------------------------------------------------- Gemini
function geminiPrompt(fields, sourceLang, targets, ctx) {
  const wantsExplanation = ctx.kind === 'dish' && !fields.explanation;
  return `You are a professional menu translator for a food delivery app in South Korea used by foreigners.
Translate the ${ctx.kind} below from ${LANG_NAMES[sourceLang]} into: ${targets.map((l) => `${l} (${LANG_NAMES[l]})`).join(', ')}.

Rules:
- Write natural, appetising menu language, short and clear. Never translate word-by-word.
- Korean dish names: use the name people of that language actually know, e.g. English "Kimchi stew", "Bibimbap".
  Keep well-known Korean names (bibimbap, tteokbokki, bulgogi) recognisable.
- Keep ingredients, allergens, quantities and prices exactly as in the source. Never add or remove information.
- Brand names stay as they are.
- Describe only the food itself. Never make statements about nationalities or groups of people
  (no "Koreans eat…", "popular in Korea", "loved by locals", "for foreigners").
${ctx.restaurant ? `- Restaurant: ${ctx.restaurant}${ctx.cuisine ? ` (${ctx.cuisine})` : ''}.` : ''}
${wantsExplanation ? `- Also write "explanation": 1–2 friendly sentences for someone who has never tried the dish: what it is, how it tastes, how it can be eaten. Only about the food. Base it only on common knowledge of the dish and the given description.` : ''}
${ctx.kind === 'dish' && sourceLang === 'ko' ? '- Also return "romanization": the Korean name in Revised Romanization, syllable groups joined with hyphens (e.g. "kimchi-jjigae").' : ''}

Source (${LANG_NAMES[sourceLang]}):
${JSON.stringify(fields, null, 2)}

Reply with JSON only, in this shape:
{"translations": {${targets.map((l) => `"${l}": {${Object.keys(fields).map((k) => `"${k}": "..."`).join(', ')}${wantsExplanation && !('explanation' in fields) ? ', "explanation": "..."' : ''}}`).join(', ')}}${ctx.kind === 'dish' && sourceLang === 'ko' ? ', "romanization": "..."' : ''}}`;
}

// Newer Gemini models think before answering and can be slow when busy; translation runs in the background, so wait.
const GEMINI_TIMEOUT_MS = 180000;

/** Readable Gemini error: status + Google's own message (never includes the key). */
async function geminiError(res) {
  let detail = '';
  try { detail = (await res.json())?.error?.message || ''; } catch { /* body was not JSON */ }
  return `Gemini responded ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`;
}

async function geminiTranslate(fields, sourceLang, targets, ctx) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.geminiModel)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.geminiApiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: geminiPrompt(fields, sourceLang, targets, ctx) }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(await geminiError(res));
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  const parsed = JSON.parse(text.replace(/^```(json)?|```$/g, '').trim());
  const out = {};
  targets.forEach((l) => {
    const v = parsed.translations?.[l];
    if (v && typeof v === 'object') {
      out[l] = Object.fromEntries(Object.entries(v).filter(([, s]) => typeof s === 'string' && s.trim()).map(([k, s]) => [k, s.trim().slice(0, 1000)]));
    }
  });
  if (Object.keys(out).length !== targets.length) throw new Error('Gemini returned incomplete translations');
  return { translations: out, romanization: typeof parsed.romanization === 'string' ? parsed.romanization.slice(0, 150) : undefined };
}

// ---------------------------------------------------------------- DeepL
async function deeplTranslate(fields, sourceLang, targets) {
  const host = env.deeplApiKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  const keys = Object.keys(fields);
  const out = {};
  for (const lang of targets) {
    const res = await fetch(`${host}/v2/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${env.deeplApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: keys.map((k) => fields[k]), target_lang: DEEPL_CODES[lang], source_lang: sourceLang.toUpperCase() }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`DeepL responded ${res.status}`);
    const data = await res.json();
    out[lang] = Object.fromEntries(keys.map((k, i) => [k, data.translations[i].text]));
  }
  return { translations: out };
}

// ---------------------------------------------------------------- public API
/**
 * Translate fields into every supported language except the source.
 * @param {Record<string,string|null|undefined>} fields e.g. { name, description, explanation }
 * @param {string} sourceLang
 * @param {{kind:'dish'|'category'|'restaurant', restaurant?:string, cuisine?:string}} ctx
 * @returns {Promise<{status:'done'|'pending'|'none', translations:object, romanization?:string}>}
 *   Never throws.
 */
async function translate(fields, sourceLang, ctx = { kind: 'dish' }) {
  const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => typeof v === 'string' && v.trim()));
  const provider = providerName();
  if (provider === 'none' || !Object.keys(clean).length) return { status: provider === 'none' ? 'none' : 'done', translations: {} };
  const targets = targetsFor(sourceLang);
  try {
    const result = provider === 'gemini'
      ? await geminiTranslate(clean, sourceLang, targets, ctx)
      : await deeplTranslate(clean, sourceLang, targets);
    return { status: 'done', ...result };
  } catch (err) {
    console.warn(`[translate] ${provider} failed (${ctx.kind}): ${err.message} — will retry later`);
    return { status: 'pending', translations: {} };
  }
}

/**
 * Merge fresh machine translations into the stored ones.
 * - Languages edited by the owner (manual: true) are kept as they are.
 * - Fields listed in `changedKeys` are dropped from old machine translations (they're stale).
 */
function mergeTranslations(existing = {}, fresh = {}, changedKeys = []) {
  const merged = {};
  for (const [lang, values] of Object.entries(existing || {})) {
    if (values?.manual) { merged[lang] = values; continue; }
    const kept = Object.fromEntries(Object.entries(values || {}).filter(([k]) => !changedKeys.includes(k)));
    if (Object.keys(kept).length) merged[lang] = kept;
  }
  for (const [lang, values] of Object.entries(fresh || {})) {
    if (merged[lang]?.manual) continue;
    merged[lang] = { ...(merged[lang] || {}), ...values };
  }
  return merged;
}

/** Apply owner edits: each provided language becomes manual (locked against auto-translation). */
function applyManual(existing = {}, edits = {}) {
  const merged = { ...(existing || {}) };
  for (const [lang, values] of Object.entries(edits || {})) {
    if (!LANGUAGES.includes(lang)) continue;
    if (values === null) { delete merged[lang]; continue; } // reset to automatic
    merged[lang] = { ...values, manual: true };
  }
  return merged;
}

// ---------------------------------------------------------------- customer reviews
/**
 * Reviews are written by customers in any language, so the source language is detected from the
 * text itself (not from the UI language). The meaning, tone and emojis are kept: nothing is
 * improved, shortened, added or removed.
 * @returns {Promise<{status:'done'|'pending'|'none', sourceLanguage:string, translations:object}>} Never throws.
 */
async function translateReview(comment, fallbackLang = 'en') {
  const text = typeof comment === 'string' ? comment.trim() : '';
  const provider = providerName();
  if (provider === 'none' || !text) return { status: provider === 'none' ? 'none' : 'done', sourceLanguage: fallbackLang, translations: {} };
  try {
    const result = await (provider === 'gemini' ? geminiReview(text) : deeplReview(text));
    if (!env.isTest) console.log(`[translate] review translated (${result.sourceLanguage} → ${Object.keys(result.translations).join(', ')})`);
    return { status: 'done', ...result };
  } catch (err) {
    console.warn(`[translate] ${provider} failed (review): ${err.message} — will retry later`);
    return { status: 'pending', sourceLanguage: fallbackLang, translations: {} };
  }
}

async function geminiReview(text) {
  const prompt = `You translate customer reviews for a food delivery app.
1. Detect the language of the review: one of ${LANGUAGES.join(', ')} (or "other").
2. Translate it into each of: ${LANGUAGES.map((l) => `${l} (${LANG_NAMES[l]})`).join(', ')}.
Rules: keep the meaning, tone, slang and emojis of the reviewer. Do not improve, soften, shorten, add or remove anything.
Dish names: use the names people of that language know (e.g. "Tteokbokki", "Bibimbap").

Review:
${JSON.stringify(text)}

Reply with JSON only: {"source": "xx", "translations": {${LANGUAGES.map((l) => `"${l}": "..."`).join(', ')}}}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.geminiModel)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.geminiApiKey },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }),
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(await geminiError(res));
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  const parsed = JSON.parse(raw.replace(/^```(json)?|```$/g, '').trim());
  const source = LANGUAGES.includes(parsed.source) ? parsed.source : 'other';
  const translations = {};
  LANGUAGES.filter((l) => l !== source).forEach((l) => {
    const v = parsed.translations?.[l];
    if (typeof v === 'string' && v.trim()) translations[l] = { comment: v.trim().slice(0, 1000) };
  });
  if (Object.keys(translations).length < LANGUAGES.length - 1) throw new Error('Gemini returned incomplete translations');
  return { sourceLanguage: source, translations };
}

const FROM_DEEPL = { EN: 'en', KO: 'ko', ZH: 'zh', VI: 'vi', TH: 'th', RU: 'ru', JA: 'ja' };
async function deeplReview(text) {
  const host = env.deeplApiKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  let source = null; const translations = {};
  for (const lang of LANGUAGES) {
    if (lang === source) continue;
    const res = await fetch(`${host}/v2/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${env.deeplApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: [text], target_lang: DEEPL_CODES[lang] }), // no source_lang: DeepL detects it
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`DeepL responded ${res.status}`);
    const t = (await res.json()).translations[0];
    source = source || FROM_DEEPL[(t.detected_source_language || '').slice(0, 2)] || 'other';
    if (lang !== source) translations[lang] = { comment: t.text };
  }
  return { sourceLanguage: source, translations };
}

module.exports = { translate, translateReview, mergeTranslations, applyManual, isEnabled, providerName, geminiError, LANG_NAMES };
