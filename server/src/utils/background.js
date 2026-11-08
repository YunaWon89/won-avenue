const env = require('../config/env');

let waitUntil = null;
if (env.serverless) {
  try { ({ waitUntil } = require('@vercel/functions')); } catch { /* package missing: fall back to fire-and-forget */ }
}

/**
 * Run work after the response is sent (e.g. translating a review).
 * On Vercel the instance may be frozen once the response is out, so the promise is handed to
 * `waitUntil`, which keeps it alive until it finishes. Locally it simply runs on.
 * Errors are logged, never thrown.
 */
function runInBackground(work, label = 'background') {
  const promise = Promise.resolve()
    .then(typeof work === 'function' ? work : () => work)
    .catch((err) => console.warn(`[${label}] failed: ${err.message}`));
  if (waitUntil) {
    try { waitUntil(promise); } catch { /* outside a Vercel request: the promise still runs */ }
  }
  return promise;
}

module.exports = { runInBackground };
