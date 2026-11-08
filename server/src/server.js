const env = require('./config/env');
const app = require('./app');
const { ensureReady } = require('./bootstrap');
const { startTimers } = require('./jobs');

// Long-running server (local, Docker, Render). On Vercel, api/index.js is used instead.
async function start() {
  await ensureReady(); // schema (+ demo data on an empty DB when SEED_ON_EMPTY=true)

  const translationService = require('./services/translationService');
  console.log(translationService.isEnabled()
    ? `[translate] auto-translation on (${translationService.providerName()})`
    : '[translate] auto-translation off: no GEMINI_API_KEY / DEEPL_API_KEY in server/.env');

  startTimers(); // move orders forward, retry translations, hide unfixed dishes

  app.listen(env.port, () => {
    console.log(`Server listening on http://localhost:${env.port}  (API docs: /api/docs)`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
