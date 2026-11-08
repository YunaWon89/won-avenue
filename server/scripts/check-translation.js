/**
 * Checks the translation setup from server/.env without starting the app:
 *   npm run check:translation
 * Prints which provider is used, then makes one tiny real request (and, if the model fails,
 * tries a few other Flash models so you know what to put in GEMINI_MODEL). The key is never printed.
 */
const env = require('../src/config/env');
const { providerName, geminiError } = require('../src/services/translationService');

const BACKUP_MODELS = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-flash-lite-latest'];
const TIMEOUT_MS = 90000;

async function tryModel(model, key) {
  const started = Date.now();
  const seconds = () => ((Date.now() - started) / 1000).toFixed(1);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Translate to Korean, reply with the translation only: Very tasty' }] }] }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();
      return { ok: true, status: res.status, message: `answered in ${seconds()} s: ${text}` };
    }
    return { ok: false, status: res.status, message: `${await geminiError(res)} (${seconds()} s)` };
  } catch (e) {
    if (e.name === 'TimeoutError') return { ok: false, status: 'timeout', message: `no answer within ${TIMEOUT_MS / 1000} s — the model is busy or slow right now` };
    return { ok: false, status: 'network', message: `could not reach Google (${e.message}) — check the internet connection, VPN or firewall` };
  }
}

async function listFlashModels(key) {
  const list = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
  if (!list.ok) return [];
  return ((await list.json()).models || [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && /flash/.test(m.name) && !/tts|image/.test(m.name))
    .map((m) => m.name.replace('models/', ''));
}

async function main() {
  const provider = providerName();
  console.log(`Provider: ${provider}`);
  if (provider === 'none') {
    console.log('No translation key found in server/.env (GEMINI_API_KEY or DEEPL_API_KEY is empty), or TRANSLATION_PROVIDER=none.');
    process.exitCode = 1;
    return;
  }
  if (provider !== 'gemini') {
    console.log('This check only tests Gemini.');
    return;
  }
  const key = env.geminiApiKey;
  console.log(`Key: ${key.length} characters${/\s|"|'/.test(key) ? ' — WARNING: contains spaces or quotes, remove them' : ''}`);
  console.log(`Model: ${env.geminiModel}  (waiting up to ${TIMEOUT_MS / 1000} s)`);

  const main = await tryModel(env.geminiModel, key);
  if (main.ok) {
    console.log(`OK — ${main.message}`);
    return;
  }
  console.log(`FAILED — ${main.message}`);
  process.exitCode = 1;

  if (main.status === 400 || main.status === 403) {
    console.log('The key is not accepted. Copy it again from aistudio.google.com (Get API key), without spaces or quotes.');
    return;
  }
  if (main.status === 429) {
    console.log('Free limit reached for now. Wait a minute (or until tomorrow for the daily limit) and try again.');
    return;
  }
  if (main.status === 'network') return;

  // Model retired (404), overloaded (503) or too slow: find one that works now.
  const available = await listFlashModels(key);
  const candidates = BACKUP_MODELS.filter((m) => m !== env.geminiModel && (!available.length || available.includes(m)));
  console.log('\nTrying other models:');
  for (const model of candidates) {
    const r = await tryModel(model, key);
    console.log(`  ${model}: ${r.ok ? 'OK — ' : 'FAILED — '}${r.message}`);
    if (r.ok) {
      console.log(`\nPut this line into server/.env and restart the server:\nGEMINI_MODEL=${model}`);
      return;
    }
  }
  if (available.length) console.log(`\nFlash models available to this key: ${available.join(', ')}`);
  console.log('None answered right now. Try again in a few minutes.');
}

main().catch((e) => {
  console.log(`FAILED — ${e.message}`);
  process.exitCode = 1;
});
