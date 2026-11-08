const env = require('./config/env');
const app = require('./app');
const db = require('./config/db');
const { migrate } = require('./db/migrate');

async function start() {
  // Schema is idempotent (CREATE IF NOT EXISTS) — safe to apply on every start.
  await migrate();

  // First deploy convenience: fill an empty database with demo data.
  if (process.env.SEED_ON_EMPTY === 'true') {
    const { rows } = await db.query('SELECT COUNT(*)::int AS c FROM users');
    if (rows[0].c === 0) {
      console.log('Empty database — seeding demo data');
      await require('./db/seed').seed();
    }
  }

  // Retry translations that failed earlier (e.g. provider rate limit) every 2 minutes.
  const translationService = require('./services/translationService');
  console.log(translationService.isEnabled()
    ? `[translate] auto-translation on (${translationService.providerName()})`
    : '[translate] auto-translation off: no GEMINI_API_KEY / DEEPL_API_KEY in server/.env');
  if (translationService.isEnabled()) {
    const { retryPendingTranslations } = require('./services/menuService');
    setInterval(() => retryPendingTranslations().catch((e) => console.warn('[translate] retry failed:', e.message)), 2 * 60 * 1000).unref();
    const { retryPendingReviewTranslations } = require('./services/reviewService');
    setTimeout(() => retryPendingReviewTranslations().catch((e) => console.warn('[translate] review retry failed:', e.message)), 5000).unref(); // soon after start
    setInterval(() => retryPendingReviewTranslations().catch((e) => console.warn('[translate] review retry failed:', e.message)), 2 * 60 * 1000).unref();
  }

  // Move orders forward automatically (delivered / completed / auto-cancel unanswered orders).
  const { autoProgress } = require('./services/orderService');
  setInterval(() => autoProgress().catch((e) => console.warn('[orders] auto-progress failed:', e.message)), 30 * 1000).unref();
  // Hide dishes the owner didn't fix in time after the admin asked.
  const { hideUnfixedDishes } = require('./services/menuService');
  setInterval(() => hideUnfixedDishes().catch((e) => console.warn('[dishes] auto-hide failed:', e.message)), 10 * 60 * 1000).unref();

  app.listen(env.port, () => {
    console.log(`Server listening on http://localhost:${env.port}  (API docs: /api/docs)`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
